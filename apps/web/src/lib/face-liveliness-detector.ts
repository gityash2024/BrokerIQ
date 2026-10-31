'use client';

/**
 * Real-time MediaPipe Face Mesh & Head Pose (Yaw) detector
 * for Agent KYC Face Liveliness verification.
 */

export type FacePoseDetected = 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UNKNOWN';

export interface FaceInspectionResult {
  ready: boolean;
  faceCount: number;
  detectedPose: FacePoseDetected;
  yaw: number;
  blink: number;
  isMatchingPose: boolean;
  guideMessage: string;
}

let landmarkerPromise: Promise<any> | null = null;
let smoothedYaw = 0;

export async function getFaceLandmarker(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    try {
      // Load runtime ES module from public folder without webpack resolution
      const loadModule = new Function('url', 'return import(url)');
      const { FilesetResolver, FaceLandmarker } = await loadModule('/vendor/mediapipe/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');

      try {
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        return landmarker;
      } catch (gpuError) {
        console.warn('MediaPipe GPU delegate failed, falling back to CPU delegate:', gpuError);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        return landmarker;
      }
    } catch (err) {
      console.warn('Failed to load FaceLandmarker:', err);
      landmarkerPromise = null;
      throw err;
    }
  })();

  return landmarkerPromise;
}

export function resetSmoothedYaw() {
  smoothedYaw = 0;
}

export function inspectFaceFrame(
  landmarker: any,
  video: HTMLVideoElement,
  expectedStep: 'STRAIGHT' | 'LEFT' | 'RIGHT',
): FaceInspectionResult {
  if (!landmarker || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return {
      ready: false,
      faceCount: 0,
      detectedPose: 'UNKNOWN',
      yaw: 0,
      blink: 0,
      isMatchingPose: false,
      guideMessage: 'कैमरा शुरू हो रहा है...',
    };
  }

  try {
    const result = landmarker.detectForVideo(video, performance.now());
    const count = result.faceLandmarks?.length || 0;

    if (count === 0) {
      smoothedYaw = 0;
      return {
        ready: true,
        faceCount: 0,
        detectedPose: 'UNKNOWN',
        yaw: 0,
        blink: 0,
        isMatchingPose: false,
        guideMessage: 'कृपया चेहरे को कैमरे के सामने लाएँ',
      };
    }

    if (count > 1) {
      return {
        ready: true,
        faceCount: count,
        detectedPose: 'UNKNOWN',
        yaw: 0,
        blink: 0,
        isMatchingPose: false,
        guideMessage: 'कैमरे में केवल 1 व्यक्ति का चेहरा होना चाहिए',
      };
    }

    const face = result.faceLandmarks[0];
    const blendshapes = result.faceBlendshapes?.[0]?.categories || [];
    const getScore = (name: string) => blendshapes.find((c: any) => c.categoryName === name)?.score || 0;
    const blink = Math.min(1, (getScore('eyeBlinkLeft') + getScore('eyeBlinkRight')) / 2);

    // Compute raw yaw from nose tip (1) vs cheek midpoint (234 & 454)
    const midpointX = (face[234].x + face[454].x) / 2;
    const rawYaw = (face[1].x - midpointX) * 10;

    // Exponential smoothing
    smoothedYaw = smoothedYaw + 0.35 * (rawYaw - smoothedYaw);

    // Classify pose based on yaw:
    // User looking straight: -0.18 <= yaw <= 0.18
    // User looking left: yaw > 0.18
    // User looking right: yaw < -0.18
    let detectedPose: FacePoseDetected = 'UNKNOWN';
    if (Math.abs(smoothedYaw) <= 0.18) {
      detectedPose = 'STRAIGHT';
    } else if (smoothedYaw > 0.18) {
      detectedPose = 'LEFT';
    } else if (smoothedYaw < -0.18) {
      detectedPose = 'RIGHT';
    }

    const isMatchingPose = detectedPose === expectedStep;

    let guideMessage = '';
    if (isMatchingPose) {
      guideMessage = 'पोज़ लॉक हो रहा है... स्थिर रहें!';
    } else {
      if (expectedStep === 'STRAIGHT') {
        guideMessage = 'कृपया कैमरे के सामने सीधा देखें';
      } else if (expectedStep === 'LEFT') {
        guideMessage = '⬅️ कृपया चेहरा बाईं ओर घुमाएँ (Look Left)';
      } else if (expectedStep === 'RIGHT') {
        guideMessage = 'कृपया चेहरा दाईं ओर घुमाएँ (Look Right) ➡️';
      }
    }

    return {
      ready: true,
      faceCount: 1,
      detectedPose,
      yaw: smoothedYaw,
      blink,
      isMatchingPose,
      guideMessage,
    };
  } catch (err) {
    return {
      ready: false,
      faceCount: 0,
      detectedPose: 'UNKNOWN',
      yaw: 0,
      blink: 0,
      isMatchingPose: false,
      guideMessage: 'कैमरा प्रोसेसिंग...',
    };
  }
}
