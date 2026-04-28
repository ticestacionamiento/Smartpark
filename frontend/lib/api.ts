import type { ROI, AnalysisResult } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function analyzeParking(
  image: File,
  rois: ROI[],
  canvasWidth: number,
  canvasHeight: number,
  yoloConf?: number,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('image', image);
  form.append('rois', JSON.stringify(rois));
  form.append('canvas_width', String(canvasWidth));
  form.append('canvas_height', String(canvasHeight));
  if (yoloConf !== undefined) form.append('yolo_conf', String(yoloConf));

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();

  if (!data.success) {
    throw new ApiError(
      data.error?.code ?? 'UNKNOWN',
      data.error?.message ?? 'Error desconocido del servidor.',
    );
  }

  return data as AnalysisResult;
}

export async function detectRois(
  image: File,
  canvasWidth: number,
  canvasHeight: number,
  roboflowConf?: number,
): Promise<ROI[]> {
  const form = new FormData();
  form.append('image', image);
  form.append('canvas_width', String(canvasWidth));
  form.append('canvas_height', String(canvasHeight));
  if (roboflowConf !== undefined) form.append('confidence', String(roboflowConf));

  const res = await fetch(`${API_BASE}/api/detect-rois`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();

  if (!data.success) {
    throw new ApiError(
      data.error?.code ?? 'UNKNOWN',
      data.error?.message ?? 'Error desconocido del servidor.',
    );
  }

  return data.rois as ROI[];
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    return data.model_loaded === true;
  } catch {
    return false;
  }
}
