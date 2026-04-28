'use client';

import { useState, useRef, useCallback } from 'react';
import React from 'react';
import type { ROI, Tool, AnalysisResult } from '@/types';
import ROICanvas from '@/components/canvas/ROICanvas';
import { analyzeParking, detectRois, ApiError } from '@/lib/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconDraw() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.032 2.032 0 1 1 2.87 2.87L8.125 18.964l-4.125.689.689-4.125L16.862 4.487z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0z" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

const TOOLS: { id: Tool; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'draw', label: 'Trazar polígono', Icon: IconDraw },
  { id: 'edit', label: 'Editar posición', Icon: IconEdit },
  { id: 'delete', label: 'Eliminar plaza', Icon: IconDelete },
];

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  imageFile: File;
  imageUrl: string;
  rois: ROI[];
  onRoisChange: (rois: ROI[]) => void;
  onComplete: (result: AnalysisResult) => void;
}

export default function Step2Delimit({
  imageFile,
  imageUrl,
  rois,
  onRoisChange,
  onComplete,
}: Props) {
  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roboflowConf, setRoboflowConf] = useState(40);
  const [yoloConf, setYoloConf] = useState(0.45);
  const canvasSizeRef = useRef({ width: 640, height: 480 });

  const handleCanvasSize = useCallback((w: number, h: number) => {
    canvasSizeRef.current = { width: w, height: h };
  }, []);

  const handleAutoDetect = async () => {
    setError(null);
    setAutoLoading(true);
    try {
      const { width, height } = canvasSizeRef.current;
      const detected = await detectRois(imageFile, width, height, roboflowConf);
      if (detected.length === 0) {
        setError('El modelo no detectó plazas en esta imagen. Puedes trazarlas manualmente.');
      } else {
        onRoisChange(detected);
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'No se pudo conectar con el servidor. Verifica que el backend esté activo.',
      );
    } finally {
      setAutoLoading(false);
    }
  };

  const handleRunInference = async () => {
    if (rois.length === 0) {
      setError('Traza al menos una plaza antes de ejecutar la inferencia.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { width, height } = canvasSizeRef.current;
      const result = await analyzeParking(imageFile, rois, width, height, yoloConf);
      onComplete(result);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'No se pudo conectar con el servidor. Verifica que el backend esté activo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between px-8 py-5 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Delimitación de plazas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Traza manualmente cada espacio de estacionamiento sobre la imagen
          </p>
        </div>
        <span className="text-xs bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-full border border-amber-200 whitespace-nowrap mt-0.5">
          Paso 2 de 3
        </span>
      </div>

      {/* Canvas + Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-1 bg-gray-900 min-w-0">
          <ROICanvas
            imageUrl={imageUrl}
            rois={rois}
            onRoisChange={onRoisChange}
            activeTool={activeTool}
            onCanvasSizeChange={handleCanvasSize}
          />
        </div>

        {/* Tools panel */}
        <div className="w-56 shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <div className="flex-1 overflow-auto p-3 space-y-5">
            {/* Auto-detect */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Detección automática
              </p>
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={loading || autoLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {autoLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    Detectando...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Auto-detectar plazas
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-400 mt-1.5 px-0.5 leading-relaxed">
                Usa Roboflow Universe para detectar plazas automáticamente.
              </p>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">Confianza detección</label>
                  <span className="text-[10px] font-semibold text-indigo-600 tabular-nums">{roboflowConf}%</span>
                </div>
                <input
                  type="range"
                  min={10} max={90} step={5}
                  value={roboflowConf}
                  onChange={(e) => setRoboflowConf(Number(e.target.value))}
                  disabled={loading || autoLoading}
                  className="w-full h-1 accent-indigo-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* Tools */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Herramientas
              </p>
              <ul className="space-y-1">
                {TOOLS.map(({ id, label, Icon }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveTool(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        activeTool === id
                          ? 'border border-green-500 bg-green-50 text-green-800 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <span className={activeTool === id ? 'text-green-600' : 'text-gray-400'}>
                        <Icon />
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contextual hint */}
            {activeTool === 'draw' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-700 leading-relaxed">
                Haz clic y arrastra para delimitar cada plaza. Suelta para confirmar.
              </div>
            )}
            {activeTool === 'edit' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700 leading-relaxed">
                Arrastra los vértices de una plaza para ajustar su posición.
              </div>
            )}
            {activeTool === 'delete' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 leading-relaxed">
                Haz clic sobre una plaza para eliminarla del lienzo.
              </div>
            )}

            {/* ROI list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Plazas trazadas
                </p>
                <span className="text-[10px] text-gray-500 font-semibold tabular-nums">
                  {rois.length}
                </span>
              </div>

              {rois.length === 0 ? (
                <p className="text-xs text-gray-400 italic px-1">Sin plazas aún</p>
              ) : (
                <ul className="space-y-0.5">
                  {rois.map((roi) => (
                    <li
                      key={roi.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm bg-blue-400 shrink-0" />
                        <span className="text-xs text-gray-700">Plaza {roi.id}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Eliminar plaza ${roi.id}`}
                        onClick={() => onRoisChange(rois.filter((r) => r.id !== roi.id))}
                        className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-gray-200 space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => onRoisChange([])}
              disabled={loading || autoLoading || rois.length === 0}
              className="w-full py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Resetear lienzo
            </button>
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
                disabled={loading || autoLoading}
                className="w-full h-1 accent-green-500 disabled:opacity-40"
              />
            </div>
            <button
              type="button"
              onClick={handleRunInference}
              disabled={loading || autoLoading || rois.length === 0}
              className="w-full py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  Analizando...
                </>
              ) : (
                'Ejecutar inferencia'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
