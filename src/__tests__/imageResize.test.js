/**
 * resizeImageBlob - pre-upload Canvas2D scale-down used by the map
 * upload path. Tests run in jsdom which has no real Image decoder;
 * we stub Image + OffscreenCanvas to capture the resize math without
 * needing a graphics-capable runtime.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let originalImage;
let originalOffscreenCanvas;
let originalCreateObjectURL;
let originalRevokeObjectURL;

let nextImageDims = { naturalWidth: 100, naturalHeight: 100 };
let drawCalls = [];
let convertToBlobCalls = [];

beforeEach(() => {
  drawCalls = [];
  convertToBlobCalls = [];

  originalImage = globalThis.Image;
  originalOffscreenCanvas = globalThis.OffscreenCanvas;
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;

  URL.createObjectURL = vi.fn(() => 'blob://stub');
  URL.revokeObjectURL = vi.fn();

  globalThis.Image = class StubImage {
    constructor() {
      this.naturalWidth = nextImageDims.naturalWidth;
      this.naturalHeight = nextImageDims.naturalHeight;
    }
    set src(_) { setTimeout(() => this.onload?.(), 0); }
  };

  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      return {
        drawImage: (img, x, y, w, h) => drawCalls.push({ w, h }),
      };
    }
    convertToBlob(opts) {
      convertToBlobCalls.push(opts);
      return Promise.resolve(new Blob(['encoded'], { type: opts?.type || 'image/jpeg' }));
    }
  };
});

afterEach(() => {
  globalThis.Image = originalImage;
  globalThis.OffscreenCanvas = originalOffscreenCanvas;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

import { resizeImageBlob } from '../utils/image-resize.js';

describe('resizeImageBlob', () => {
  it('returns the original blob unchanged when both dimensions ≤ maxDim', async () => {
    nextImageDims = { naturalWidth: 1024, naturalHeight: 768 };
    const file = new Blob(['orig'], { type: 'image/jpeg' });
    const result = await resizeImageBlob(file, 2048, 0.9);
    expect(result).toBe(file);
    expect(convertToBlobCalls).toHaveLength(0);
  });

  it('scales the longer edge down to maxDim when oversized', async () => {
    nextImageDims = { naturalWidth: 4096, naturalHeight: 3000 };
    const file = new Blob(['orig'], { type: 'image/jpeg' });
    const result = await resizeImageBlob(file, 2048, 0.9);
    expect(result).not.toBe(file);
    // Aspect ratio 4096:3000 ≈ 1.365; longer-edge 2048 → shorter ~1500
    expect(drawCalls).toHaveLength(1);
    expect(drawCalls[0].w).toBe(2048);
    expect(drawCalls[0].h).toBe(1500);
  });

  it('preserves PNG → PNG output type', async () => {
    nextImageDims = { naturalWidth: 4000, naturalHeight: 4000 };
    const file = new Blob(['orig'], { type: 'image/png' });
    const result = await resizeImageBlob(file, 2048);
    expect(result.type).toBe('image/png');
    expect(convertToBlobCalls[0]?.type).toBe('image/png');
  });

  it('preserves WebP → WebP output type', async () => {
    nextImageDims = { naturalWidth: 3000, naturalHeight: 4000 };
    const file = new Blob(['orig'], { type: 'image/webp' });
    const result = await resizeImageBlob(file, 2048);
    expect(result.type).toBe('image/webp');
  });

  it('falls back to JPEG for unknown image types', async () => {
    nextImageDims = { naturalWidth: 3000, naturalHeight: 3000 };
    const file = new Blob(['orig'], { type: 'image/bmp' });
    const result = await resizeImageBlob(file, 2048);
    expect(result.type).toBe('image/jpeg');
  });

  it('revokes the temporary object URL after decode', async () => {
    nextImageDims = { naturalWidth: 4000, naturalHeight: 3000 };
    await resizeImageBlob(new Blob(['orig'], { type: 'image/jpeg' }), 2048);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob://stub');
  });

  it('rejects when the input is not a Blob', async () => {
    await expect(resizeImageBlob(null)).rejects.toThrow(/Blob/);
    await expect(resizeImageBlob('not a blob')).rejects.toThrow(/Blob/);
  });

  it('rejects when maxDim is invalid', async () => {
    const file = new Blob(['x'], { type: 'image/jpeg' });
    await expect(resizeImageBlob(file, 0)).rejects.toThrow(/maxDim/);
    await expect(resizeImageBlob(file, -1)).rejects.toThrow(/maxDim/);
    await expect(resizeImageBlob(file, NaN)).rejects.toThrow(/maxDim/);
  });
});
