/**
 * Token portraits went straight to uploadMedia: no pre-shrink, no
 * 413 retry, no library entry. Map images had all three. Same code
 * path now, so a 12 MB phone photo of a character does not just fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadImage } from '../ui/maps/upload-map-image.js';
import { ASSET_KINDS } from '../utils/constants.js';

// The real resizer returns a fresh Blob, which has no filename - the
// name has to survive that, or every recorded asset is nameless.
vi.mock('../utils/image-resize.js', () => ({
  resizeImageBlob: vi.fn(async () => new Blob(['resized'], { type: 'image/png' })),
}));

function makeUi(upload) {
  return {
    widgetManager: { uploadMedia: upload },
    state: { settings: {}, recordAsset: vi.fn().mockResolvedValue('ast-1') },
    _toast: vi.fn(),
  };
}

describe('uploadImage', () => {
  let file;
  beforeEach(() => { file = new File([new Blob(['x'])], 'orc.png', { type: 'image/png' }); });

  it('records a portrait upload under the portrait kind', async () => {
    const ui = makeUi(vi.fn().mockResolvedValue('mxc://hs/p1'));
    const url = await uploadImage(ui, file, ASSET_KINDS.PORTRAIT);
    expect(url).toBe('mxc://hs/p1');
    expect(ui.state.recordAsset).toHaveBeenCalledWith(expect.objectContaining({
      mxc: 'mxc://hs/p1', kind: ASSET_KINDS.PORTRAIT, name: 'orc.png',
    }));
  });

  it('still defaults to the map kind for the map form', async () => {
    const ui = makeUi(vi.fn().mockResolvedValue('mxc://hs/m1'));
    await uploadImage(ui, file);
    expect(ui.state.recordAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: ASSET_KINDS.MAP }));
  });

  it('pre-shrinks before uploading, whatever the kind', async () => {
    const { resizeImageBlob } = await import('../utils/image-resize.js');
    const ui = makeUi(vi.fn().mockResolvedValue('mxc://hs/p1'));
    await uploadImage(ui, file, ASSET_KINDS.PORTRAIT);
    expect(resizeImageBlob).toHaveBeenCalled();
  });
});
