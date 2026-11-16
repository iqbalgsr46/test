export interface CameraOption {
  deviceId: string;
  label: string;
  isBack: boolean;
  score: number;
}

/**
 * Evaluates and scores camera videoinput devices to strictly prioritize the
 * standard 1x main camera (wide-angle / primary) and exclude ultrawide (0.5x, 0.6x),
 * macro, depth, and telephoto sensors.
 */
export function evaluateCamera(device: MediaDeviceInfo, index: number): CameraOption {
  const label = (device.label || '').toLowerCase();

  // Detect front/selfie cameras
  const isFront =
    /front|depan|user|selfie|facetime/i.test(label) ||
    /camera2 1\b/i.test(label);

  const isBack =
    !isFront &&
    (/back|rear|environment|belakang|facing back/i.test(label) ||
      /camera2 [023456789]\b/i.test(label) ||
      /camera [023456789]\b/i.test(label) ||
      !label); // If label is empty or generic, treat as candidate back camera if not front

  let score = 0;

  if (isBack) {
    score += 50; // Base back camera bonus

    // Ultrawide signatures (0.5x, 0.6x, ultra-wide, super-wide, uw)
    const isUltrawide =
      /ultra|super[-\s]?wide|0\.[56]|0,[56]|\buw\b/i.test(label);

    // Macro, depth, and ToF sensors
    const isMacroOrDepth = /macro|depth|aux|tof|sensor|bokeh/i.test(label);

    // Telephoto sensors (2x, 3x, 5x, 10x periscope)
    const isTelephoto = /tele|telephoto|periscope|[2-9]x\b|[1-9][0-9]x\b/i.test(label);

    // Explicit standard / primary / main 1x indicators
    const isExplicitMain =
      /main|primary|utama|standard|normal|1x\b|1\.0x\b/i.test(label);

    // Standard "Wide-Angle" or "Wide" without "ultra" (iOS and Android standard 1x camera naming)
    const isWideAngle =
      /(?:^|[^a-z])wide(?:-angle)?(?:[^a-z]|$)/i.test(label) && !isUltrawide;

    if (isExplicitMain) {
      score += 100;
    } else if (isWideAngle) {
      score += 80;
    } else if (/camera2 0\b|camera 0\b/i.test(label)) {
      // HAL camera 0 is standard primary back sensor
      score += 40;
    }

    // Heavy penalties for non-standard lenses
    if (isUltrawide) {
      score -= 300;
    }
    if (isMacroOrDepth) {
      score -= 250;
    }
    if (isTelephoto) {
      score -= 100;
    }

    // Prefer lower HAL index when scores are tied
    score -= index * 2;
  } else {
    // Front camera penalty when evaluating back cameras
    score -= 500;
  }

  return {
    deviceId: device.deviceId,
    label: device.label,
    isBack,
    score,
  };
}

/**
 * Enumerate devices, ensuring labels are unlocked if permission was not yet granted in this session,
 * and return available back cameras sorted by priority (standard 1x main camera first).
 */
export async function discoverCameras(): Promise<{
  allDevices: MediaDeviceInfo[];
  backCameras: CameraOption[];
  defaultCamera: CameraOption | undefined;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { allDevices: [], backCameras: [], defaultCamera: undefined };
  }

  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    let videoInputs = devices.filter((d) => d.kind === 'videoinput');

    // If labels are empty (session permission not yet granted), briefly probe to unlock labels
    const hasLabels = videoInputs.some((d) => Boolean(d.label));
    if (!hasLabels && navigator.mediaDevices.getUserMedia) {
      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        probeStream.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = devices.filter((d) => d.kind === 'videoinput');
      } catch {
        // Probe denied or failed; continue with what we have
      }
    }

    const evaluated = videoInputs.map((d, idx) => evaluateCamera(d, idx));
    const backCameras = evaluated
      .filter((c) => c.isBack)
      .sort((a, b) => b.score - a.score);

    // Pick top-scored back camera, or fallback to first video input
    const defaultCamera = backCameras[0] ?? evaluated[0];

    return {
      allDevices: videoInputs,
      backCameras,
      defaultCamera,
    };
  } catch {
    return { allDevices: [], backCameras: [], defaultCamera: undefined };
  }
}

/**
 * Apply 1.0x standard optical zoom and continuous autofocus if hardware exposes capabilities.
 * Prevents logical multi-cameras from defaulting to 0.5x/0.6x ultrawide.
 */
export async function applyStandardZoomAndFocus(track: MediaStreamTrack): Promise<void> {
  if (!track || typeof track.getCapabilities !== 'function') return;

  try {
    const caps = track.getCapabilities() as {
      zoom?: { min: number; max: number; step?: number };
      focusMode?: string[];
    };

    // 1. Zoom constraint: force 1.0x standard focal length
    if (caps?.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
      const min = caps.zoom.min;
      const max = caps.zoom.max;
      // If min is 0.5 or 0.6, zoom 1.0 selects standard 1x main lens
      const targetZoom = Math.max(min, Math.min(max, 1.0));
      try {
        await track.applyConstraints({
          advanced: [{ zoom: targetZoom }] as unknown as MediaTrackConstraintSet[],
        });
      } catch {
        // ignore zoom constraint rejection
      }
    }

    // 2. Autofocus constraint in isolated try/catch so zoom is not affected if unsupported
    if (caps?.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }] as unknown as MediaTrackConstraintSet[],
        });
      } catch {
        // ignore focusMode constraint rejection
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Acquire media stream prioritizing the designated deviceId (or standard main camera),
 * with multiple robust constraint fallbacks.
 */
export async function acquireCameraStream(
  targetDeviceId?: string,
  preferredFacing: 'environment' | 'user' = 'environment',
): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Perangkat atau browser ini tidak mendukung akses kamera.');
  }

  const attempts: MediaStreamConstraints[] = [
    // 1. High definition (1080p ideal) on selected deviceId
    targetDeviceId
      ? {
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        }
      : {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        },
    // 2. Standard 720p HD on selected deviceId
    targetDeviceId
      ? {
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }
      : {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
    // 3. Flexible resolution on targeted device
    targetDeviceId
      ? {
          video: {
            deviceId: { ideal: targetDeviceId },
          },
          audio: false,
        }
      : {
          video: {
            facingMode: { ideal: preferredFacing },
          },
          audio: false,
        },
    // 4. FacingMode fallback
    {
      video: { facingMode: { ideal: preferredFacing } },
      audio: false,
    },
    // 5. Universal fallback
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (track) {
        await applyStandardZoomAndFocus(track);
      }
      return stream;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

export interface DomRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Calculates video source pixel crop coordinates corresponding to the on-screen
 * viewfinder box, taking into account CSS object-cover scaling and centering.
 */
export function computeBoxCrop(
  videoWidth: number,
  videoHeight: number,
  containerRect: DomRectLike,
  boxRect: DomRectLike | null,
): CropRect {
  if (!boxRect || !videoWidth || !videoHeight || !containerRect.width || !containerRect.height) {
    const size = Math.min(videoWidth, videoHeight) * 0.6;
    return {
      sx: Math.round((videoWidth - size) / 2),
      sy: Math.round((videoHeight - size) / 2),
      sWidth: Math.round(size),
      sHeight: Math.round(size),
    };
  }

  // Calculate object-cover scale and excess offsets
  const scale = Math.max(containerRect.width / videoWidth, containerRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const excessX = (renderedWidth - containerRect.width) / 2;
  const excessY = (renderedHeight - containerRect.height) / 2;

  // Box coordinates relative to the rendered video element
  const boxScreenX = boxRect.left - containerRect.left;
  const boxScreenY = boxRect.top - containerRect.top;

  // Map to original video source pixel coordinates
  const rawX = (boxScreenX + excessX) / scale;
  const rawY = (boxScreenY + excessY) / scale;
  const rawW = boxRect.width / scale;
  const rawH = boxRect.height / scale;

  // 6% boundary margin so slightly edge-aligned QR codes still detect comfortably
  const padX = rawW * 0.06;
  const padY = rawH * 0.06;

  const sx = Math.max(0, Math.round(rawX - padX));
  const sy = Math.max(0, Math.round(rawY - padY));
  const sWidth = Math.min(videoWidth - sx, Math.round(rawW + padX * 2));
  const sHeight = Math.min(videoHeight - sy, Math.round(rawH + padY * 2));

  return { sx, sy, sWidth, sHeight };
}

/**
 * Convenience helper to calculate crop from live HTML elements.
 */
export function calculateViewfinderCrop(
  videoElement: HTMLVideoElement,
  viewfinderElement: HTMLElement | null,
): CropRect {
  const vw = videoElement.videoWidth || 640;
  const vh = videoElement.videoHeight || 480;
  const vRect = videoElement.getBoundingClientRect();
  const boxRect = viewfinderElement ? viewfinderElement.getBoundingClientRect() : null;

  return computeBoxCrop(vw, vh, vRect, boxRect);
}

