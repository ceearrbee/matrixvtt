/**
 * Mock Canvas and Context for testing
 *
 * Provides mock implementations of HTMLCanvasElement and CanvasRenderingContext2D
 */

import { vi } from 'vitest';

export function createMockCanvasContext() {
  return {
    // Drawing rectangles
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),

    // Drawing paths
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),

    // Filling and stroking
    fill: vi.fn(),
    stroke: vi.fn(),

    // Styles
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,

    // Transformations
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),

    // Text
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',

    // Images
    drawImage: vi.fn(),

    // State
    globalCompositeOperation: 'source-over',

    // Gradients and patterns (if needed)
    createLinearGradient: vi.fn(),
    createRadialGradient: vi.fn(),
    createPattern: vi.fn()
  };
}

export function createMockCanvas(width = 800, height = 600) {
  const ctx = createMockCanvasContext();

  const canvas = {
    width,
    height,
    style: {},

    getContext: vi.fn().mockReturnValue(ctx),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
    toBlob: vi.fn(),

    // Event listeners
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),

    // Mock context reference for testing
    __mockContext__: ctx
  };

  return canvas;
}
