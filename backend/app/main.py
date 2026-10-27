import os
from pathlib import Path
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .elexon_client import ElexonDataClient
from .analytics import WindForecastAnalyticsEngine, hourly_forecast_target
from .schemas import DayAheadAnalysisResponse

app = FastAPI(
    title="REint UK Day-Ahead Wind Power & Procurement Decision API",
    description=(
        "Quantitative wind forecast accuracy and shortfall-buffer analytics built on "
        "Elexon BMRS FUELHH and WINDFOR streams for January 2026."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)

use_live = os.getenv("USE_LIVE_ELEXON_API", "false").lower() == "true"
client = ElexonDataClient(use_live_api=use_live)
engine = WindForecastAnalyticsEngine(
    fuelhh_records=client.get_fuelhh_wind_jan2026(),
    windfor_records=client.get_windfor_jan2026(),
)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "reint-uk-wind-day-ahead-api",
        "period": "2026-01-01 to 2026-01-31",
        "fuelhhRecords": len(engine.fuelhh),
        "targetTimestamps": len(engine.forecasts_by_target),
    }


@app.get("/api/v1/day-ahead/analysis", response_model=DayAheadAnalysisResponse)
def get_day_ahead_analysis(
    cutoff_time: str = Query("11:00", description="Day-ahead gate closure time on D-1 in UTC (e.g. 09:20, 09:50, 11:00, 15:30, 17:30)"),
    date_from: str = Query("2026-01-01", description="Start settlement date (YYYY-MM-DD)"),
    date_to: str = Query("2026-01-31", description="End settlement date (YYYY-MM-DD)"),
    confidence_level: str = Query("P90", description="Confidence level for thermal buffer (P50, P75, P90, P95, P99)"),
    max_lead_hours: float = Query(48.0, description="Maximum forecast lead time in hours"),
):
    try:
        return engine.analyze_day_ahead(
            cutoff_time=cutoff_time,
            date_from=date_from,
            date_to=date_to,
            confidence_level=confidence_level,
            max_lead_hours=max_lead_hours,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/forecasts/evolution")
def get_forecast_evolution(
    start_time: str = Query("2026-01-05T17:00:00Z", description="Target settlement period startTime (ISO-8601 UTC)")
):
    if start_time not in engine.actual_map:
        raise HTTPException(status_code=404, detail=f"Target startTime {start_time} not found in January 2026 FUELHH dataset.")
    actual_rec = engine.actual_map[start_time]
    cands = engine.forecasts_by_target.get(hourly_forecast_target(start_time), [])
    return {
        "startTime": start_time,
        "settlementDate": actual_rec["settlementDate"],
        "settlementPeriod": actual_rec["settlementPeriod"],
        "actualGenerationMW": actual_rec["generation"],
        "revisions": [
            {
                "publishTime": p_str,
                "forecastGenerationMW": fc,
                "leadHours": round(lh, 2),
                "errorMW": round(fc - actual_rec["generation"], 1),
            }
            for _, p_str, fc, lh in cands
        ],
    }


# The root Docker image includes the compiled React app; the split Compose
# deployment serves it from Nginx instead, so this mount is optional.
static_dir = Path(__file__).resolve().parents[1] / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
