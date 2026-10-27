from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class FuelHHRecord(BaseModel):
    dataset: str = "FUELHH"
    publishTime: str
    startTime: str
    settlementDate: str
    settlementPeriod: int
    fuelType: str = "WIND"
    generation: float


class WindForRecord(BaseModel):
    dataset: str = "WINDFOR"
    publishTime: str
    startTime: str
    generation: float


class AlignedSettlementRecord(BaseModel):
    startTime: str
    settlementDate: str
    settlementPeriod: int
    actualGenerationMW: float
    forecastGenerationMW: float
    publishTime: str
    leadHours: float
    errorMW: float = Field(description="Forecast - Actual (MW). Positive = Wind Shortfall (Over-forecast)")
    absErrorMW: float
    apePercent: float
    shortfallMW: float = Field(description="max(0, Forecast - Actual) MW")


class ErrorDistributionStats(BaseModel):
    count: int
    maeMW: float
    rmseMW: float
    mbeBiasMW: float
    mapePercent: float
    p05MW: float
    p10MW: float
    p25MW: float
    p50MedianMW: float
    p75MW: float
    p90ShortfallMW: float
    p95ShortfallMW: float
    p99ShortfallMW: float
    shortfallFrequencyPercent: float
    recommendedThermalBufferMW: float


class HorizonBucketStat(BaseModel):
    horizonLabel: str
    minLeadHours: float
    maxLeadHours: float
    sampleCount: int
    maeMW: float
    rmseMW: float
    biasMW: float
    p90ShortfallMW: float
    p95ShortfallMW: float


class DayAheadAnalysisResponse(BaseModel):
    cutoffTimeUTC: str
    cutoffLabel: str
    confidenceLevel: str
    dateFrom: str
    dateTo: str
    metrics: ErrorDistributionStats
    horizonCurve: List[HorizonBucketStat]
    records: List[AlignedSettlementRecord]
