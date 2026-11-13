/**
 * Burn Calendar Backend API Client.
 * 
 * Communicates with the FastAPI backend under /api/v1/*.
 * Provides seamless integration for real NASA FIRMS observations,
 * spatial GeoJSON data, annual calendar rhythms, and quality reports.
 */

import type { Observation, Sensor } from './observations';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000';

export interface CalendarApiResponse {
  year: number;
  selected_month: number;
  region: string;
  sensors: string[];
  monthly_rhythm: Array<{
    month_index: number;
    month_number: number;
    month_name: string;
    month_abbr: string;
    detection_count: number;
    active_cell_days: number;
    active_days: number;
    is_unusual: boolean;
    baseline_ratio: number | null;
  }>;
  historical_trends: Array<{
    year: number;
    month: number;
    detection_count: number;
    active_cell_days: number;
    modis_count: number;
    viirs_count: number;
    data_status: string;
  }>;
  annual_total_detections: number;
  annual_active_cell_days: number;
  average_monthly_detections: number;
  unusual_period_threshold: number;
  quality_notes: string[];
}

export interface SummaryApiResponse {
  total_detections: number;
  total_active_cell_days: number;
  modis_detections: number;
  viirs_detections: number;
  total_frp_mw: number;
  mean_daily_detections: number;
  peak_date: string | null;
  peak_detections: number;
}

export const burnCalendarApi = {
  /** Check if the Python backend is live and healthy */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  },

  /** Fetch real GeoJSON observations for MapLibre rendering */
  async getObservationsGeoJSON(params: {
    region?: string;
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
    sensors?: Sensor[];
    limit?: number;
  }): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
    const url = new URL(`${API_BASE_URL}/api/v1/map/geojson`);
    if (params.region) url.searchParams.set('region', params.region);
    if (params.year !== undefined) url.searchParams.set('year', params.year.toString());
    if (params.month !== undefined) url.searchParams.set('month', params.month.toString());
    if (params.startDate) url.searchParams.set('start_date', params.startDate);
    if (params.endDate) url.searchParams.set('end_date', params.endDate);
    if (params.limit) url.searchParams.set('limit', params.limit.toString());
    (params.sensors || ['MODIS', 'VIIRS']).forEach(s => url.searchParams.append('sensors', s));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  /** Fetch 12-month calendar rhythm and multi-year historical trends */
  async getCalendar(year: number, month: number, region: string, sensors: Sensor[]): Promise<CalendarApiResponse> {
    const url = new URL(`${API_BASE_URL}/api/v1/calendar`);
    url.searchParams.set('year', year.toString());
    url.searchParams.set('month', month.toString());
    url.searchParams.set('region', region);
    sensors.forEach(s => url.searchParams.append('sensors', s));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  /** Fetch summary activity metrics */
  async getSummary(region: string, startDate: string, endDate: string, sensors: Sensor[]): Promise<SummaryApiResponse> {
    const url = new URL(`${API_BASE_URL}/api/v1/summary`);
    url.searchParams.set('region', region);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    sensors.forEach(s => url.searchParams.append('sensors', s));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  /** Build CSV export URL */
  getCsvDownloadUrl(region: string, startDate: string, endDate: string, sensors: Sensor[]): string {
    const url = new URL(`${API_BASE_URL}/api/v1/download/csv`);
    url.searchParams.set('region', region);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    sensors.forEach(s => url.searchParams.append('sensors', s));
    return url.toString();
  },
};
