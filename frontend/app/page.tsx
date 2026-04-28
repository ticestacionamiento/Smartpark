'use client';

import { useState, useEffect } from 'react';
import type { Step, ROI, AnalysisResult } from '@/types';
import Sidebar from '@/components/Sidebar';
import Step1Upload from '@/components/steps/Step1Upload';
import Step2Delimit from '@/components/steps/Step2Delimit';
import Step3Results from '@/components/steps/Step3Results';

export default function Page() {
  const [step, setStep] = useState<Step>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rois, setRois] = useState<ROI[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // revoke previous object URL when imageUrl changes or on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const goToStep2 = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageUrl(url);
    setRois([]);
    setResult(null);
    setStep(2);
  };

  const goToStep3 = (res: AnalysisResult) => {
    setResult(res);
    setStep(3);
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl(null);
    setRois([]);
    setResult(null);
    setStep(1);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar currentStep={step} />

      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {step === 1 && <Step1Upload onContinue={goToStep2} />}

        {step === 2 && imageFile && imageUrl && (
          <Step2Delimit
            imageFile={imageFile}
            imageUrl={imageUrl}
            rois={rois}
            onRoisChange={setRois}
            onComplete={goToStep3}
          />
        )}

        {step === 3 && imageFile && imageUrl && result && (
          <Step3Results
            imageFile={imageFile}
            imageUrl={imageUrl}
            rois={rois}
            result={result}
            onReanalyze={setResult}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}
