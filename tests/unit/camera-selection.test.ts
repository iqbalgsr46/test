import { describe, it, expect } from 'vitest';
import { evaluateCamera, computeBoxCrop } from '../../src/features/voting/camera-selection';

function createMockDevice(deviceId: string, label: string): MediaDeviceInfo {
  return {
    deviceId,
    groupId: 'group-1',
    kind: 'videoinput',
    label,
    toJSON: () => ({}),
  };
}

describe('evaluateCamera prioritization', () => {
  it('correctly prefers iPhone 1x Wide-Angle over Ultra Wide and Telephoto', () => {
    const devices = [
      createMockDevice('cam-front', 'Front Camera'),
      createMockDevice('cam-ultra', 'Back Ultra Wide Camera'),
      createMockDevice('cam-main', 'Back Wide-Angle Camera'),
      createMockDevice('cam-tele', 'Back Telephoto Camera'),
    ];

    const evaluated = devices.map((d, i) => evaluateCamera(d, i));
    const sortedBack = evaluated.filter((c) => c.isBack).sort((a, b) => b.score - a.score);

    expect(sortedBack[0].deviceId).toBe('cam-main');
    expect(sortedBack.find((c) => c.deviceId === 'cam-ultra')!.score).toBeLessThan(0);
  });

  it('correctly prefers Android Camera2 HAL primary camera 0 over secondary cameras', () => {
    const devices = [
      createMockDevice('cam-0', 'camera2 0, facing back'),
      createMockDevice('cam-1', 'camera2 1, facing front'),
      createMockDevice('cam-2', 'camera2 2, facing back'),
      createMockDevice('cam-3', 'camera2 3, facing back'),
    ];

    const evaluated = devices.map((d, i) => evaluateCamera(d, i));
    const sortedBack = evaluated.filter((c) => c.isBack).sort((a, b) => b.score - a.score);

    expect(sortedBack[0].deviceId).toBe('cam-0');
    expect(evaluated.find((c) => c.deviceId === 'cam-1')!.isBack).toBe(false);
  });

  it('correctly penalizes 0.5x, 0.6x, and macro/depth sensors', () => {
    const devices = [
      createMockDevice('cam-uw', 'Rear Camera (0.5x Ultra Wide)'),
      createMockDevice('cam-main', 'Rear Camera (1x Main)'),
      createMockDevice('cam-macro', 'Rear Camera (Macro Sensor)'),
    ];

    const evaluated = devices.map((d, i) => evaluateCamera(d, i));
    const sortedBack = evaluated.filter((c) => c.isBack).sort((a, b) => b.score - a.score);

    expect(sortedBack[0].deviceId).toBe('cam-main');
    expect(sortedBack[0].score).toBeGreaterThan(100);
    expect(sortedBack.find((c) => c.deviceId === 'cam-uw')!.score).toBeLessThan(0);
    expect(sortedBack.find((c) => c.deviceId === 'cam-macro')!.score).toBeLessThan(0);
  });

  it('correctly handles devices with generic or empty labels', () => {
    const devices = [
      createMockDevice('cam-empty-0', ''),
      createMockDevice('cam-empty-1', ''),
    ];

    const evaluated = devices.map((d, i) => evaluateCamera(d, i));
    expect(evaluated[0].isBack).toBe(true);
    expect(evaluated[0].score).toBeGreaterThan(evaluated[1].score); // Index tie-breaker
  });
});

describe('computeBoxCrop viewport mapping', () => {
  it('correctly maps center screen box to center video pixels', () => {
    // 1920x1080 source video
    // 800x400 container screen (2:1 aspect ratio, height is cropped)
    // 200x200 center box
    const container = { left: 0, top: 0, width: 800, height: 400 };
    const box = { left: 300, top: 100, width: 200, height: 200 };

    const crop = computeBoxCrop(1920, 1080, container, box);

    // Box center should be near the center of the video (960, 540)
    const centerX = crop.sx + crop.sWidth / 2;
    const centerY = crop.sy + crop.sHeight / 2;

    expect(Math.abs(centerX - 960)).toBeLessThan(5);
    expect(Math.abs(centerY - 540)).toBeLessThan(5);
    expect(crop.sx).toBeGreaterThan(0);
    expect(crop.sy).toBeGreaterThan(0);
    expect(crop.sWidth).toBeLessThan(1920);
    expect(crop.sHeight).toBeLessThan(1080);
  });

  it('falls back safely to center 60% square when box is null', () => {
    const container = { left: 0, top: 0, width: 800, height: 400 };
    const crop = computeBoxCrop(1920, 1080, container, null);

    const expectedSize = Math.round(1080 * 0.6);
    expect(crop.sWidth).toBe(expectedSize);
    expect(crop.sHeight).toBe(expectedSize);
    expect(crop.sx).toBe(Math.round((1920 - expectedSize) / 2));
    expect(crop.sy).toBe(Math.round((1080 - expectedSize) / 2));
  });
});

