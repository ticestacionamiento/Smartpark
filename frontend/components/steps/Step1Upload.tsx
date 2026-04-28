'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  onContinue: (file: File) => void;
}

function validate(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(file.type)) {
    return 'Formato no soportado. Use .jpg, .jpeg, .png o .webp.';
  }
  if (file.size > MAX_BYTES) {
    return 'El archivo supera el tamaño máximo de 10 MB.';
  }
  return null;
}

const INFO_CARDS = [
  { label: 'Formatos aceptados', value: 'JPG, PNG, WEBP' },
  { label: 'Tamaño máximo', value: '10 MB' },
  { label: 'Resolución mín.', value: '320 × 240 px' },
  { label: 'Preprocesamiento', value: 'Auto · 640 px' },
] as const;

export default function Step1Upload({ onContinue }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const applyFile = useCallback((f: File) => {
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) applyFile(f);
    },
    [applyFile],
  );

  const handleDiscard = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-8 py-5 border-b border-gray-100">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Carga de imagen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sube una imagen del estacionamiento para analizar
          </p>
        </div>
        <span className="text-xs bg-green-50 text-green-700 font-medium px-3 py-1.5 rounded-full border border-green-200 whitespace-nowrap mt-0.5">
          Paso 1 de 3
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">
        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Zona de carga de imagen"
          className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer select-none ${
            isDragging
              ? 'border-green-500 bg-green-50'
              : file
              ? 'border-green-500 bg-gray-50'
              : 'border-green-400 bg-gray-50 hover:border-green-500 hover:bg-green-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyFile(f);
            }}
          />

          {preview ? (
            <div className="relative h-52 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Vista previa"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity rounded-lg">
                <span className="text-white text-sm font-semibold">Cambiar imagen</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 gap-3 px-4">
              {/* Upload icon */}
              <div className="w-14 h-14 border border-gray-200 rounded-xl flex items-center justify-center bg-white shadow-sm">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Arrastra tu imagen aquí</p>
                <p className="text-xs text-gray-500 mt-1">
                  o selecciona un archivo desde tu dispositivo
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {['.jpg', '.jpeg', '.png', '.webp'].map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-0.5 rounded"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-400">Tamaño máximo: 10 MB</p>
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          {INFO_CARDS.map(({ label, value }) => (
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <span className="text-red-500 font-bold text-sm shrink-0">!</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleDiscard}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={() => file && onContinue(file)}
          disabled={!file}
          className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
