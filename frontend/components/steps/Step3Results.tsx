'use client';

import { useState, useRef, useCallback } from 'react';
import type { ROI, AnalysisResult } from '@/types';
import ROICanvas from '@/components/canvas/ROICanvas';
import { analyzeParking, ApiError } from '@/lib/api';

interface Props {
  imageFile: File;
  imageUrl: string;
  rois: ROI[];
  result: AnalysisResult;
  onReanalyze: (result: AnalysisResult) => void;
  onReset: () => void;
}

const STAT_CARDS = (
  summary: AnalysisResult['summary'],
  inferenceMs: number,
) => [
  { label: 'Total', value: summary.total_spaces, sub: 'plazas' },
  { label: 'Ocupadas', value: summary.occupied_count, sub: 'vehículos' },
  { label: 'Disponibles', value: summary.available_count, sub: 'libres' },
  { label: 'Inferencia', value: Math.round(inferenceMs), sub: 'ms/img' },
];

export default function Step3Results({ imageFile, imageUrl, rois, result, onReanalyze, onReset }: Props) {
  const { summary, spaces, model_info, inference_time_ms } = result;
  const pct = summary.occupation_percentage;
  const [yoloConf, setYoloConf] = useState(model_info.confidence_threshold);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasSizeRef = useRef({ width: 640, height: 480 });

  const handleCanvasSize = useCallback((w: number, h: number) => {
    canvasSizeRef.current = { width: w, height: h };
  }, []);

  const handleReanalyze = async () => {
    setError(null);
    setReanalyzing(true);
    try {
      const { width: canvasWidth, height: canvasHeight } = canvasSizeRef.current;
      const newResult = await analyzeParking(imageFile, rois, canvasWidth, canvasHeight, yoloConf);
      onReanalyze(newResult);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al conectar con el servidor.');
    } finally {
      setReanalyzing(false);
    }
  };

  const progressColor =
    pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between px-8 py-5 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Resultados del análisis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {model_info.name} · umbral {model_info.confidence_threshold} · clases:{' '}
            {model_info.classes_detected.join(', ')}
          </p>
        </div>
        <span className="text-xs bg-green-50 text-green-700 font-medium px-3 py-1.5 rounded-full border border-green-200 whitespace-nowrap mt-0.5">
          Análisis completado
        </span>
      </div>

      {/* Canvas + Results panel */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 bg-gray-900 min-w-0">
          <ROICanvas
            imageUrl={imageUrl}
            rois={rois}
            results={spaces}
            readOnly
            onCanvasSizeChange={handleCanvasSize}
          />
        </div>

        {/* Results panel */}
        <div className="w-56 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4 space-y-5">
            {/* Occupancy summary */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Resumen de ocupación
              </p>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">Porcentaje de ocupación</p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5 tabular-nums">{pct}%</p>
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {STAT_CARDS(summary, inference_time_ms).map(({ label, value, sub }) => (
                  <div
                    key={label}
                    className="bg-gray-50 border border-gray-100 rounded-lg p-2.5"
                  >
                    <p className="text-[10px] text-gray-500">{label}</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight">
                      {value}
                    </p>
                    <p className="text-[10px] text-gray-400">{sub}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-space list */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Estado por plaza
              </p>
              <ul className="divide-y divide-gray-50">
                {spaces.map((space) => {
                  const occupied = space.status === 'ocupado';
                  return (
                    <li
                      key={space.id}
                      className="flex items-center justify-between py-2 first:pt-0"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            occupied ? 'bg-red-500' : 'bg-green-500'
                          }`}
                        />
                        <span className="text-xs text-gray-700 font-medium">{space.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {occupied && space.confidence > 0 && (
                          <span className="text-[11px] text-gray-500 tabular-nums">
                            {space.confidence.toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold ${
                            occupied ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {occupied ? 'Ocupado' : 'Libre'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-3 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                Ocupado
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500">Confianza YOLO</label>
                <span className="text-[10px] font-semibold text-green-600 tabular-nums">{yoloConf.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1} max={0.9} step={0.05}
                value={yoloConf}
                onChange={(e) => setYoloConf(Number(e.target.value))}
                disabled={reanalyzing}
                className="w-full h-1 accent-green-500 disabled:opacity-40"
              />
            </div>

            {error && (
              <p className="text-[10px] text-red-600 leading-relaxed">{error}</p>
            )}

            <button
              type="button"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="w-full py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {reanalyzing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  Analizando...
                </>
              ) : (
                'Re-analizar'
              )}
            </button>

            <button
              type="button"
              onClick={onReset}
              className="w-full py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Analizar otra imagen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
