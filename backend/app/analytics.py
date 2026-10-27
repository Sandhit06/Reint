import math
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import List, Dict, Any, Tuple
from .schemas import (
    AlignedSettlementRecord,
    ErrorDistributionStats,
    HorizonBucketStat,
    DayAheadAnalysisResponse,
)

GATE_CLOSURE_LABELS = {
    "09:20": "EPEX Day-Ahead 60-Min Auction (09:20 UTC)",
    "09:50": "N2EX Day-Ahead Hourly Auction (09:50 UTC)",
    "11:00": "UK Day-Ahead Trading Desk Cutoff (11:00 UTC)",
    "15:30": "EPEX Day-Ahead 30-Min Auction (15:30 UTC)",
    "17:30": "EPEX Intraday 1 Auction (D-1 17:30 UTC)",
}


def hourly_forecast_target(start_time: str) -> str:
    """WINDFOR is hourly; return the corresponding hourly target for a FUELHH SP."""
    target = datetime.strptime(start_time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return target.replace(minute=0).strftime("%Y-%m-%dT%H:%M:%SZ")


class WindForecastAnalyticsEngine:
    """
    Core temporal alignment and error quantification engine for Elexon FUELHH & WINDFOR streams.
    Strictly enforces Zero Data Leakage: when making Day-Ahead purchase decisions on Day D-1
    at `cutoff_hh_mm` UTC for delivery Day D, only WINDFOR publications with
    `publishTime <= D-1 @ cutoff_hh_mm` are eligible.
    """

    def __init__(self, fuelhh_records: List[Dict[str, Any]], windfor_records: List[Dict[str, Any]]):
        self.fuelhh = sorted(fuelhh_records, key=lambda r: r["startTime"])
        self.actual_map: Dict[str, Dict[str, Any]] = {r["startTime"]: r for r in self.fuelhh}
        self.forecasts_by_target: Dict[str, List[Tuple[datetime, str, float, float]]] = defaultdict(list)

        for r in windfor_records:
            st = r["startTime"]
            if st not in self.actual_map:
                continue
            p_dt = datetime.strptime(r["publishTime"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            s_dt = datetime.strptime(st, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            lead_h = (s_dt - p_dt).total_seconds() / 3600.0
            if lead_h > 0:
                self.forecasts_by_target[st].append((p_dt, r["publishTime"], float(r["generation"]), lead_h))

        for st in self.forecasts_by_target:
            self.forecasts_by_target[st].sort(key=lambda x: x[0])

        self._horizon_curve_cache = self._compute_horizon_curve()

    def _compute_horizon_curve(self) -> List[HorizonBucketStat]:
        buckets = [(0, 6), (6, 12), (12, 18), (18, 24), (24, 30), (30, 36), (36, 42), (42, 48)]
        result: List[HorizonBucketStat] = []
        for b0, b1 in buckets:
            errs: List[float] = []
            for st, cands in self.forecasts_by_target.items():
                target_dt = datetime.strptime(st, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                next_half_hour = (target_dt + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
                actual_values = [float(self.actual_map[key]["generation"]) for key in (st, next_half_hour) if key in self.actual_map]
                if not actual_values:
                    continue
                # WINDFOR publishes hourly targets. Compare each hourly forecast to the
                # mean of the two corresponding half-hour FUELHH outturn periods.
                actual = sum(actual_values) / len(actual_values)
                for _, _, fc, lh in cands:
                    if b0 < lh <= b1:
                        errs.append(fc - actual)
            if not errs:
                continue
            errs_sorted = sorted(errs)
            n = len(errs_sorted)
            mae = sum(abs(e) for e in errs_sorted) / n
            rmse = math.sqrt(sum(e * e for e in errs_sorted) / n)
            bias = sum(errs_sorted) / n
            p90 = errs_sorted[min(n - 1, int(0.90 * n))]
            p95 = errs_sorted[min(n - 1, int(0.95 * n))]
            result.append(
                HorizonBucketStat(
                    horizonLabel=f"{b0}-{b1}h",
                    minLeadHours=b0,
                    maxLeadHours=b1,
                    sampleCount=n,
                    maeMW=round(mae, 1),
                    rmseMW=round(rmse, 1),
                    biasMW=round(bias, 1),
                    p90ShortfallMW=round(p90, 1),
                    p95ShortfallMW=round(p95, 1),
                )
            )
        return result

    def analyze_day_ahead(
        self,
        cutoff_time: str = "11:00",
        date_from: str = "2026-01-01",
        date_to: str = "2026-01-31",
        confidence_level: str = "P90",
        max_lead_hours: float = 48.0,
    ) -> DayAheadAnalysisResponse:
        parts = cutoff_time.split(":")
        cutoff_h, cutoff_m = int(parts[0]), int(parts[1])

        temp_rows = []
        errors = []
        abs_errors = []
        sq_errors = []
        ape_list = []

        for r in self.fuelhh:
            s_date = r["settlementDate"]
            if s_date < date_from or s_date > date_to:
                continue
            st = r["startTime"]
            actual = float(r["generation"])
            s_dt = datetime.strptime(st, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            d_minus_1_cutoff = (s_dt - timedelta(days=1)).replace(
                hour=cutoff_h, minute=cutoff_m, second=0
            )

            forecast_target = hourly_forecast_target(st)
            source_cands = self.forecasts_by_target.get(forecast_target, [])
            cands = []
            for p_dt, p_str, fc, _ in source_cands:
                lead_h = (s_dt - p_dt).total_seconds() / 3600.0
                if p_dt <= d_minus_1_cutoff and lead_h <= max_lead_hours:
                    cands.append((p_dt, p_str, fc, lead_h))
            if not cands:
                # Fallback to latest before cutoff regardless of max_lead_hours if needed
                cands = [
                    (p_dt, p_str, fc, (s_dt - p_dt).total_seconds() / 3600.0)
                    for p_dt, p_str, fc, _ in source_cands
                    if p_dt <= d_minus_1_cutoff
                ]
            if not cands:
                continue

            p_dt, p_str, fc, lead_h = cands[-1]
            err = fc - actual  # Positive = Forecast > Actual = Wind Shortfall!
            abs_err = abs(err)
            ape = (abs_err / actual) * 100.0 if actual > 0 else 0.0
            shortfall = max(0.0, err)

            errors.append(err)
            abs_errors.append(abs_err)
            sq_errors.append(err * err)
            ape_list.append(ape)

            temp_rows.append((r, st, actual, fc, p_str, lead_h, err, abs_err, ape, shortfall))

        n = len(errors)
        if n == 0:
            raise ValueError("No aligned records found for the specified date range and cutoff.")

        sorted_err = sorted(errors)
        p05 = sorted_err[int(0.05 * n)]
        p10 = sorted_err[int(0.10 * n)]
        p25 = sorted_err[int(0.25 * n)]
        p50 = sorted_err[int(0.50 * n)]
        p75 = sorted_err[int(0.75 * n)]
        p90 = sorted_err[int(0.90 * n)]
        p95 = sorted_err[int(0.95 * n)]
        p99 = sorted_err[min(n - 1, int(0.99 * n))]

        buffer_map = {
            "P50": max(0.0, p50),
            "P75": max(0.0, p75),
            "P90": max(0.0, p90),
            "P95": max(0.0, p95),
            "P99": max(0.0, p99),
        }
        rec_buffer = round(buffer_map.get(confidence_level.upper(), max(0.0, p90)), 1)

        shortfall_count = sum(1 for e in errors if e > 0)
        stats = ErrorDistributionStats(
            count=n,
            maeMW=round(sum(abs_errors) / n, 1),
            rmseMW=round(math.sqrt(sum(sq_errors) / n), 1),
            mbeBiasMW=round(sum(errors) / n, 1),
            mapePercent=round(sum(ape_list) / n, 2),
            p05MW=round(p05, 1),
            p10MW=round(p10, 1),
            p25MW=round(p25, 1),
            p50MedianMW=round(p50, 1),
            p75MW=round(p75, 1),
            p90ShortfallMW=round(p90, 1),
            p95ShortfallMW=round(p95, 1),
            p99ShortfallMW=round(p99, 1),
            shortfallFrequencyPercent=round((shortfall_count / n) * 100.0, 1),
            recommendedThermalBufferMW=rec_buffer,
        )

        aligned_records: List[AlignedSettlementRecord] = []
        for r, st, actual, fc, p_str, lead_h, err, abs_err, ape, shortfall in temp_rows:
            aligned_records.append(
                AlignedSettlementRecord(
                    startTime=st,
                    settlementDate=r["settlementDate"],
                    settlementPeriod=int(r["settlementPeriod"]),
                    actualGenerationMW=round(actual, 1),
                    forecastGenerationMW=round(fc, 1),
                    publishTime=p_str,
                    leadHours=round(lead_h, 2),
                    errorMW=round(err, 1),
                    absErrorMW=round(abs_err, 1),
                    apePercent=round(ape, 2),
                    shortfallMW=round(shortfall, 1),
                )
            )

        return DayAheadAnalysisResponse(
            cutoffTimeUTC=cutoff_time,
            cutoffLabel=GATE_CLOSURE_LABELS.get(cutoff_time, f"Custom Day-Ahead Cutoff (D-1 {cutoff_time} UTC)"),
            confidenceLevel=confidence_level.upper(),
            dateFrom=date_from,
            dateTo=date_to,
            metrics=stats,
            horizonCurve=self._horizon_curve_cache,
            records=aligned_records,
        )
