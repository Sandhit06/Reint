import { DayAheadAnalysisResponse, ForecastEvolutionResponse } from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchDayAheadAnalysis(params: {
  cutoffTime: string;
  dateFrom: string;
  dateTo: string;
  confidenceLevel: string;
  maxLeadHours: number;
}): Promise<DayAheadAnalysisResponse> {
  const qs = new URLSearchParams({
    cutoff_time: params.cutoffTime,
    date_from: params.dateFrom,
    date_to: params.dateTo,
    confidence_level: params.confidenceLevel,
    max_lead_hours: String(params.maxLeadHours),
  });
  const res = await fetch(`${API_BASE}/api/v1/day-ahead/analysis?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchForecastEvolution(startTime: string): Promise<ForecastEvolutionResponse> {
  const qs = new URLSearchParams({ start_time: startTime });
  const res = await fetch(`${API_BASE}/api/v1/forecasts/evolution?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
