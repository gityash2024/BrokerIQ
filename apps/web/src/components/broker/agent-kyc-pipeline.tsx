'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Upload,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  getFaceLandmarker,
  inspectFaceFrame,
  resetSmoothedYaw,
  FaceInspectionResult,
} from '@/lib/face-liveliness-detector';
import { toast } from 'sonner';

export type LivelinessStep = 'STRAIGHT' | 'LEFT' | 'RIGHT';

interface LivelinessState {
  straightUrl: string | null;
  leftUrl: string | null;
  rightUrl: string | null;
}

interface AgentKycPipelineProps {
  initialValues?: LivelinessState;
  disabled?: boolean;
  onChange: (values: LivelinessState) => void;
}

const STEPS: { key: LivelinessStep; label: string; sub: string; hint: string }[] = [
  {
    key: 'STRAIGHT',
    label: '1. सामने देखें (Look Straight)',
    sub: 'कैमरे के बिल्कुल सामने चेहरा रखें',
    hint: 'Keep head straight centered in the circle',
  },
  {
    key: 'LEFT',
    label: '2. बाईं तरफ देखें (Look Left)',
    sub: 'चेहरा धीरे से बाईं ओर घुमाएँ',
    hint: 'Turn your head slightly to the left',
  },
  {
    key: 'RIGHT',
    label: '3. दाईं तरफ देखें (Look Right)',
    sub: 'चेहरा धीरे से दाईं ओर घुमाएँ',
    hint: 'Turn your head slightly to the right',
  },
];

export function AgentKycPipeline({ initialValues, disabled = false, onChange }: AgentKycPipelineProps) {
  const [activeStep, setActiveStep] = useState<LivelinessStep>('STRAIGHT');
  const [captures, setCaptures] = useState<LivelinessState>({
    straightUrl: initialValues?.straightUrl || null,
    leftUrl: initialValues?.leftUrl || null,
    rightUrl: initialValues?.rightUrl || null,
  });
  const [isRetaking, setIsRetaking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Face Detection & Pose Lock State
  const [detectorReady, setDetectorReady] = useState(false);
  const [detection, setDetection] = useState<FaceInspectionResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [fallbackMode, setFallbackMode] = useState(false);

  // Pending approval state for review step
  const [pendingCapture, setPendingCapture] = useState<{
    step: LivelinessStep;
    dataUrl: string;
    blob: Blob;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const autoCaptureTriggeredRef = useRef(false);

  const allComplete = !!captures.straightUrl && !!captures.leftUrl && !!captures.rightUrl;

  // Sync initialValues
  useEffect(() => {
    if (initialValues) {
      setCaptures({
        straightUrl: initialValues.straightUrl || null,
        leftUrl: initialValues.leftUrl || null,
        rightUrl: initialValues.rightUrl || null,
      });
    }
  }, [initialValues?.straightUrl, initialValues?.leftUrl, initialValues?.rightUrl]);

  // Load MediaPipe Landmarker
  useEffect(() => {
    let cancelled = false;
    getFaceLandmarker()
      .then((landmarker) => {
        if (!cancelled && landmarker) {
          landmarkerRef.current = landmarker;
          setDetectorReady(true);
        }
      })
      .catch((err) => {
        console.warn('Face landmarker could not load, using manual fallback:', err);
        if (!cancelled) {
          setFallbackMode(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetection(null);
    setHoldProgress(0);
    holdStartRef.current = null;
    autoCaptureTriggeredRef.current = false;
    resetSmoothedYaw();
  }, []);

  const startCamera = useCallback(async () => {
    if (disabled) return;
    try {
      setCameraError(null);
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      holdStartRef.current = null;
      autoCaptureTriggeredRef.current = false;
      resetSmoothedYaw();

      // Wait for next render cycle so video element is in DOM
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraActive(false);
      setCameraError('कैमरा शुरू नहीं हो पाया। कृपया कैमरा परमिशन दें या फ़ोटो चुनें विकल्प का उपयोग करें।');
    }
  }, [disabled, stopCamera]);

  useEffect(() => {
    if (disabled || (allComplete && !isRetaking)) {
      stopCamera();
    } else if (!allComplete || isRetaking) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [disabled, allComplete, isRetaking, startCamera, stopCamera]);

  // Capture frame to preview and approve
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || uploading) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering context not available');

      // Mirror back for selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Image capture failed');

      setPendingCapture({
        step: activeStep,
        dataUrl,
        blob,
      });
      toast.info('पोज़ कैप्चर हो गया! कृपया फ़ोटो की समीक्षा करके "स्वीकारें" पर क्लिक करें');
    } catch (err: any) {
      toast.error('फ़ोटो कैप्चर में समस्या: ' + (err?.message || 'Error'));
    }
  }, [activeStep, uploading]);

  // Real-time Face Pose Tracking Animation Frame Loop
  useEffect(() => {
    if (!cameraActive || pendingCapture || uploading || (allComplete && !isRetaking)) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && video.readyState >= 2 && landmarker) {
        const result = inspectFaceFrame(landmarker, video, activeStep);
        setDetection(result);

        // Auto-capture on pose lock: User holds pose for 1000ms
        if (result.isMatchingPose) {
          if (!holdStartRef.current) {
            holdStartRef.current = performance.now();
          }
          const elapsed = performance.now() - holdStartRef.current;
          const progress = Math.min(100, Math.round((elapsed / 1000) * 100));
          setHoldProgress(progress);

          if (elapsed >= 1000 && !autoCaptureTriggeredRef.current) {
            autoCaptureTriggeredRef.current = true;
            captureFrame();
          }
        } else {
          holdStartRef.current = null;
          setHoldProgress(0);
          autoCaptureTriggeredRef.current = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [cameraActive, pendingCapture, uploading, activeStep, allComplete, isRetaking, captureFrame]);

  // Agent approves capture -> Upload & Advance
  const approveCapture = async () => {
    if (!pendingCapture || uploading) return;
    try {
      setUploading(true);
      const { url } = await uploadFile(pendingCapture.blob, 'kyc');

      const nextCaptures = { ...captures };
      if (pendingCapture.step === 'STRAIGHT') nextCaptures.straightUrl = url;
      if (pendingCapture.step === 'LEFT') nextCaptures.leftUrl = url;
      if (pendingCapture.step === 'RIGHT') nextCaptures.rightUrl = url;

      setCaptures(nextCaptures);
      onChange(nextCaptures);
      setPendingCapture(null);
      toast.success(`${STEPS.find((s) => s.key === pendingCapture.step)?.label} स्वीकृत व सेव हुआ ✅`);

      const isNowComplete = !!nextCaptures.straightUrl && !!nextCaptures.leftUrl && !!nextCaptures.rightUrl;
      if (isNowComplete) {
        // Complete -> Turn off camera completely
        setIsRetaking(false);
        stopCamera();
        toast.success('सभी 3 फेस पोज़ सफलतापूर्वक कैप्चर हो गए! कैमरा बंद कर दिया गया है।');
      } else {
        // Reset hold state for next pose
        holdStartRef.current = null;
        setHoldProgress(0);
        autoCaptureTriggeredRef.current = false;
        resetSmoothedYaw();

        // Advance to next incomplete pose
        if (pendingCapture.step === 'STRAIGHT' && !nextCaptures.leftUrl) setActiveStep('LEFT');
        else if (pendingCapture.step === 'LEFT' && !nextCaptures.rightUrl) setActiveStep('RIGHT');
        else if (!nextCaptures.straightUrl) setActiveStep('STRAIGHT');
        else if (!nextCaptures.leftUrl) setActiveStep('LEFT');
        else if (!nextCaptures.rightUrl) setActiveStep('RIGHT');
      }
    } catch (err: any) {
      toast.error('फ़ोटो अपलोड विफल: ' + (err?.message || 'Error'));
    } finally {
      setUploading(false);
    }
  };

  // Agent discards capture and wants to retake
  const retakeCapture = () => {
    setPendingCapture(null);
    holdStartRef.current = null;
    setHoldProgress(0);
    autoCaptureTriggeredRef.current = false;
    resetSmoothedYaw();
  };

  // Manual file upload fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const { url } = await uploadFile(file, 'kyc');
      const nextCaptures = { ...captures };
      if (activeStep === 'STRAIGHT') nextCaptures.straightUrl = url;
      if (activeStep === 'LEFT') nextCaptures.leftUrl = url;
      if (activeStep === 'RIGHT') nextCaptures.rightUrl = url;

      setCaptures(nextCaptures);
      onChange(nextCaptures);
      toast.success(`${STEPS.find((s) => s.key === activeStep)?.label} अपलोड हो गया ✅`);

      const isNowComplete = !!nextCaptures.straightUrl && !!nextCaptures.leftUrl && !!nextCaptures.rightUrl;
      if (isNowComplete) {
        setIsRetaking(false);
        stopCamera();
      } else {
        if (activeStep === 'STRAIGHT' && !nextCaptures.leftUrl) setActiveStep('LEFT');
        else if (activeStep === 'LEFT' && !nextCaptures.rightUrl) setActiveStep('RIGHT');
      }
    } catch (err: any) {
      toast.error('फ़ाइल अपलोड विफल: ' + (err?.message || 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleRetakePose = (pose: LivelinessStep) => {
    setActiveStep(pose);
    setPendingCapture(null);
    holdStartRef.current = null;
    setHoldProgress(0);
    autoCaptureTriggeredRef.current = false;
    resetSmoothedYaw();
    setIsRetaking(true);
    startCamera();
  };

  const currentStepConfig = STEPS.find((s) => s.key === activeStep) || STEPS[0];
  const isPoseUnlocked = fallbackMode || (detection && detection.isMatchingPose);

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface-2/40 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="flex items-center gap-2 font-bold text-base">
            <ShieldCheck className="size-5 text-emerald-500" />
            Face Liveliness Check • चेहरा सत्यापन (3 Poses)
          </h4>
          <p className="text-xs text-muted">
            AI फेस डिटेक्शन द्वारा 3 पोज़ सत्यापित करें (सामने, बाईं ओर, दाईं ओर)
          </p>
        </div>
        {allComplete && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> 3/3 कैप्चर पूरे
          </span>
        )}
      </div>

      {/* Step Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((s) => {
          const isDone =
            (s.key === 'STRAIGHT' && !!captures.straightUrl) ||
            (s.key === 'LEFT' && !!captures.leftUrl) ||
            (s.key === 'RIGHT' && !!captures.rightUrl);
          const isCurrent = activeStep === s.key && cameraActive;

          return (
            <button
              key={s.key}
              type="button"
              disabled={disabled}
              onClick={() => {
                setActiveStep(s.key);
                setPendingCapture(null);
                holdStartRef.current = null;
                setHoldProgress(0);
                autoCaptureTriggeredRef.current = false;
                resetSmoothedYaw();
                if (allComplete) {
                  setIsRetaking(true);
                }
                startCamera();
              }}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all',
                isCurrent
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500'
                  : isDone
                    ? 'border-line bg-surface text-fg'
                    : 'border-line/60 bg-surface/50 text-muted opacity-80',
              )}
            >
              <div className="flex items-center gap-1 text-xs">
                {isDone ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Camera className="size-3.5" />}
                <span className="truncate">{s.key}</span>
              </div>
              <span className="mt-1 text-[11px] font-medium opacity-80">
                {s.key === 'STRAIGHT' ? 'सामने' : s.key === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Camera Live Pipeline Box OR Completion Card */}
      {!disabled && (
        <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-line bg-black">
          {allComplete && !isRetaking ? (
            /* All 3 Captured & Camera Turned OFF completely */
            <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-line rounded-2xl">
              <div className="grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3 shadow-inner">
                <CheckCircle2 className="size-8" />
              </div>
              <h5 className="font-bold text-base text-fg">3/3 फेस लाइवलीनेस सत्यापन पूर्ण</h5>
              <p className="text-xs text-muted mt-1 max-w-xs">
                तीनों कोणों से चेहरे की तस्वीरें ले ली गई हैं। कैमरा सुरक्षित रूप से बंद कर दिया गया है।
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRetakePose('STRAIGHT')}
                  className="text-xs"
                >
                  <RefreshCw className="size-3.5 mr-1.5" /> किसी भी पोज़ को दोबारा लें
                </Button>
              </div>
            </div>
          ) : cameraActive ? (
            <div className="relative aspect-square w-full">
              {/* If pending capture review, show frozen capture */}
              {pendingCapture ? (
                <div className="relative h-full w-full">
                  <img
                    src={pendingCapture.dataUrl}
                    alt="Captured pose preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                  {/* Header confirmation tag */}
                  <div className="absolute top-3 inset-x-3 text-center">
                    <span className="inline-block rounded-full bg-black/80 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-white border border-white/20">
                      फ़ोटो की समीक्षा करें • {STEPS.find((s) => s.key === pendingCapture.step)?.label}
                    </span>
                  </div>

                  {/* Approve or Retake Action Dock */}
                  <div className="absolute bottom-4 inset-x-3 flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={retakeCapture}
                      disabled={uploading}
                      className="bg-black/70 text-white border-white/30 hover:bg-black/90 font-semibold"
                    >
                      <RefreshCw className="size-4 mr-1.5" /> दोबारा लें (Retake)
                    </Button>
                    <Button
                      type="button"
                      size="md"
                      onClick={approveCapture}
                      disabled={uploading}
                      loading={uploading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-xl shadow-emerald-950/60"
                    >
                      <Check className="size-4 mr-1.5" /> {uploading ? 'सेव हो रहा है...' : 'स्वीकारें (Approve & Next)'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover -scale-x-100"
                  />

                  {/* Liveliness Face Guide Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={cn(
                        'relative h-64 w-48 rounded-[50%] border-2 transition-all duration-200',
                        detection?.isMatchingPose
                          ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)] scale-[1.03]'
                          : 'border-dashed border-white/60 shadow-[0_0_15px_rgba(0,0,0,0.5)]',
                      )}
                    >
                      {/* Directional cue arrow & instruction badge */}
                      {activeStep === 'LEFT' && (
                        <div
                          className={cn(
                            'absolute -left-12 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-lg transition-all',
                            detection?.isMatchingPose
                              ? 'bg-emerald-500 text-white shadow-emerald-500/50'
                              : 'bg-amber-400 text-black shadow-amber-400/50 animate-pulse',
                          )}
                        >
                          <ArrowLeft className="size-4" /> Left (बाएँ)
                        </div>
                      )}
                      {activeStep === 'RIGHT' && (
                        <div
                          className={cn(
                            'absolute -right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-lg transition-all',
                            detection?.isMatchingPose
                              ? 'bg-emerald-500 text-white shadow-emerald-500/50'
                              : 'bg-sky-400 text-black shadow-sky-400/50 animate-pulse',
                          )}
                        >
                          Right (दाएँ) <ArrowRight className="size-4" />
                        </div>
                      )}

                      {/* Pose Matching Status Inside Ring */}
                      {detection?.isMatchingPose && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/10 rounded-[50%] backdrop-blur-[1px]">
                          <div className="rounded-full bg-emerald-500 p-2 text-white shadow-lg animate-bounce">
                            <Check className="size-6 stroke-[3]" />
                          </div>
                          <span className="mt-2 rounded-full bg-black/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                            पोज़ लॉक हो रहा है ({holdProgress}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Header: Real-time pose feedback pill */}
                  <div className="absolute top-3 inset-x-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border backdrop-blur-md transition-all shadow-md',
                        detection?.isMatchingPose
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                          : detection?.faceCount === 0
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                            : 'bg-black/75 text-white border-white/20',
                      )}
                    >
                      {detection?.isMatchingPose ? (
                        <>
                          <Sparkles className="size-3.5 text-emerald-400 animate-spin" />
                          पोज़ लॉक: 1 सेकंड स्थिर रखें... ({holdProgress}%)
                        </>
                      ) : (
                        detection?.guideMessage || `${currentStepConfig.label}: ${currentStepConfig.sub}`
                      )}
                    </span>
                  </div>

                  {/* Hold Progress Bar */}
                  {holdProgress > 0 && (
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-100 ease-out"
                        style={{ width: `${holdProgress}%` }}
                      />
                    </div>
                  )}

                  {/* Action dock */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-2 sm:gap-3">
                    {isRetaking && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsRetaking(false);
                          stopCamera();
                        }}
                        disabled={uploading}
                        className="bg-black/70 text-white border-white/20 hover:bg-black/90 text-xs px-2.5"
                        title="रद्द करें"
                      >
                        <X className="size-3.5 mr-1" /> रद्द करें
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={startCamera}
                      disabled={uploading}
                      className="bg-black/60 text-white border-white/20 hover:bg-black/80"
                      title="कैमरा रीफ्रेश करें"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>

                    {/* Shutter Button: Unlocked only when pose matches (or fallback) */}
                    <Button
                      type="button"
                      onClick={captureFrame}
                      disabled={uploading || !isPoseUnlocked}
                      className={cn(
                        'font-bold px-5 sm:px-6 shadow-lg transition-all',
                        isPoseUnlocked
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-400'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-75',
                      )}
                    >
                      {isPoseUnlocked ? (
                        <>
                          <Camera className="size-4 mr-1.5" />
                          फ़ोटो लें (Capture) {holdProgress > 0 && `(${holdProgress}%)`}
                        </>
                      ) : (
                        <>
                          <Lock className="size-4 mr-1.5 text-amber-400" />
                          {activeStep === 'LEFT'
                            ? 'बाईं ओर घुमाएँ'
                            : activeStep === 'RIGHT'
                              ? 'दाईं ओर घुमाएँ'
                              : 'सामने देखें'}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-black/60 text-white border-white/20 hover:bg-black/80"
                      title="फ़ोटो फ़ाइल चुनें (Upload fallback)"
                    >
                      <Upload className="size-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-white/80">
              <AlertCircle className="size-10 text-amber-400 mb-2" />
              <p className="text-xs max-w-xs mb-4">{cameraError || 'कैमरा लाइव व्यू उपलब्ध नहीं है'}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={startCamera}>
                  <RefreshCw className="size-4 mr-1" /> कैमरा शुरू करें (Start Camera)
                </Button>
                <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4 mr-1" /> फ़ोटो चुनें (Upload)
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden fallback file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 3 Captured Previews Gallery */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {STEPS.map((s) => {
          const url =
            s.key === 'STRAIGHT'
              ? captures.straightUrl
              : s.key === 'LEFT'
                ? captures.leftUrl
                : captures.rightUrl;

          return (
            <div
              key={s.key}
              className="group relative flex flex-col items-center rounded-xl border border-line bg-surface p-2 text-center"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                {url ? (
                  <img
                    src={url}
                    alt={s.label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    <Camera className="size-6 opacity-40" />
                  </div>
                )}
                {url && (
                  <div className="absolute top-1 right-1 rounded-full bg-emerald-500 p-0.5 text-white">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                )}
              </div>
              <span className="mt-1.5 text-xs font-semibold">{s.key}</span>
              {url && !disabled && (
                <button
                  type="button"
                  onClick={() => handleRetakePose(s.key)}
                  className="mt-1 text-[11px] text-emerald-600 hover:underline dark:text-emerald-400 font-medium"
                >
                  दोबारा लें
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
