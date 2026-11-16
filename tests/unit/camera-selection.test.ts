import { describe, it, expect } from 'vitest';
import { evaluateCamera } from '../../src/features/voting/camera-selection';

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
