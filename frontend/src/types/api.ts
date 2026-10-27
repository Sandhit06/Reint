export interface AlignedSettlementRecord {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  actualGenerationMW: number;
  forecastGenerationMW: number;
  publishTime: string;
  leadHours: number;
  errorMW: number;
  absErrorMW: number;
  apePercent: number;
  shortfallMW: number;
}

export interface ErrorDistributionStats {
  count: number;
  maeMW: number;
  rmseMW: number;
  mbeBiasMW: number;
  mapePercent: number;
  p05MW: number;
  p10MW: number;
  p25MW: number;
  p50MedianMW: number;
  p75MW: number;
  p90ShortfallMW: number;
  p95ShortfallMW: number;
  p99ShortfallMW: number;
  shortfallFrequencyPercent: number;
  recommendedThermalBufferMW: number;
}

export interface HorizonBucketStat {
  horizonLabel: string;
  minLeadHours: number;
  maxLeadHours: number;
  sampleCount: number;
  maeMW: number;
  rmseMW: number;
  biasMW: number;
  p90ShortfallMW: number;
  p95ShortfallMW: number;
}

export interface DayAheadAnalysisResponse {
  cutoffTimeUTC: string;
  cutoffLabel: string;
  confidenceLevel: string;
  dateFrom: string;
  dateTo: string;
  metrics: ErrorDistributionStats;
  horizonCurve: HorizonBucketStat[];
  records: AlignedSettlementRecord[];
}

export interface ForecastRevision {
  publishTime: string;
  forecastGenerationMW: number;
  leadHours: number;
  errorMW: number;
}

export interface ForecastEvolutionResponse {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  actualGenerationMW: number;
  revisions: ForecastRevision[];
}
