export type Step = 1 | 2 | 3;
export type Tool = 'draw' | 'edit' | 'delete';

export interface ROI {
  id: string;
  points: [number, number][];
}

export interface SpaceResult {
  id: string;
  status: 'ocupado' | 'libre';
  confidence: number;
  occupied_by_count: number;
}

export interface OccupancySummary {
  total_spaces: number;
  occupied_count: number;
  available_count: number;
  occupation_percentage: number;
}

export interface ModelInfo {
  name: string;
  confidence_threshold: number;
  classes_detected: string[];
}

export interface AnalysisResult {
  success: boolean;
  inference_time_ms: number;
  model_info: ModelInfo;
  summary: OccupancySummary;
  spaces: SpaceResult[];
}
