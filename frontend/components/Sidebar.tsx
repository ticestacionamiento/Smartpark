import type { Step } from '@/types';

interface Props {
  currentStep: Step;
}

const STEPS: { number: Step; label: string }[] = [
  { number: 1, label: 'Cargar imagen' },
  { number: 2, label: 'Delimitar plazas' },
  { number: 3, label: 'Resultados' },
];

export default function Sidebar({ currentStep }: Props) {
  return (
    <aside className="w-48 flex flex-col shrink-0 border-r border-gray-200 bg-white overflow-hidden">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3.5 h-3.5 rounded-full bg-green-600 shrink-0" />
          <span className="font-bold text-gray-900 text-sm leading-none">ParkVision</span>
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-[22px]">Sistema de análisis</p>
        <p className="text-[11px] text-gray-400 ml-[22px]">YOLOV11 · UNL 2025</p>
      </div>

      <div className="border-t border-gray-200" />

      <nav className="px-3 pt-4 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
          Flujo de trabajo
        </p>
        <ul className="space-y-0.5">
          {STEPS.map(({ number, label }) => {
            const isActive = currentStep === number;
            const isDone = currentStep > number;
            return (
              <li key={number}>
                <div
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : isDone
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 leading-none ${
                      isActive
                        ? 'bg-white text-green-700'
                        : isDone
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isDone ? '✓' : number}
                  </span>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 pb-5 mt-auto">
        <p className="text-[10px] text-gray-400 leading-tight">TIC · Carrera de Computación</p>
        <p className="text-[10px] text-gray-400 leading-tight">Universidad Nacional de Loja</p>
      </div>
    </aside>
  );
}
