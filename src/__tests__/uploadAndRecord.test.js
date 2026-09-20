/**
 * Every successful upload should leave a reusable trace, and a failure
 * to record must never fail the upload the user actually asked for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAndRecord } from '../ui/assets/upload-and-record.js';
import { ASSET_KINDS } from '../utils/constants.js';

function makeUi({ upload = vi.fn().mockResolvedValue('mxc://hs/abc'), record = vi.fn().mockResolvedValue('ast-1') } = {}) {
  return {
    widgetManager: { uploadMedia: upload },
    state: { recordAsset: record },
    _toast: vi.fn(),
  };
}

const blob = () => new Blob(['x'], { type: 'image/png' });

describe('uploadAndRecord', () => {
  let file;
  beforeEach(() => { file = new File([blob()], 'tavern.png', { type: 'image/png' }); });

  it('returns the mxc and records it with the name and kind', async () => {
    const ui = makeUi();
    const url = await uploadAndRecord(ui, file, ASSET_KINDS.MAP, { name: 'tavern.png' });
    expect(url).toBe('mxc://hs/abc');
    expect(ui.state.recordAsset).toHaveBeenCalledWith(expect.objectContaining({
      mxc: 'mxc://hs/abc', name: 'tavern.png', kind: ASSET_KINDS.MAP,
    }));
  });

  // A resized Blob has no filename, so reading it off the uploaded blob
  // would silently record every asset as ''.
  it('takes the name from the caller, not from the resized blob', async () => {
    const ui = makeUi();
    await uploadAndRecord(ui, blob(), ASSET_KINDS.MAP, { name: 'tavern.png' });
    expect(ui.state.recordAsset).toHaveBeenCalledWith(expect.objectContaining({ name: 'tavern.png' }));
  });

  it('passes the measured dimensions through when they are known', async () => {
    const ui = makeUi();
    await uploadAndRecord(ui, file, ASSET_KINDS.MAP, { width: 2048, height: 1536 });
    expect(ui.state.recordAsset).toHaveBeenCalledWith(expect.objectContaining({ width: 2048, height: 1536 }));
  });

  it('rethrows an upload failure and records nothing', async () => {
    const ui = makeUi({ upload: vi.fn().mockRejectedValue(new Error('413 too large')) });
    await expect(uploadAndRecord(ui, file, ASSET_KINDS.MAP)).rejects.toThrow('413 too large');
    expect(ui.state.recordAsset).not.toHaveBeenCalled();
  });

  // The upload is what the user asked for; the library entry is a
  // convenience. Losing the convenience must not lose the upload.
  it('still returns the mxc when recording throws', async () => {
    const ui = makeUi({ record: vi.fn().mockRejectedValue(new Error('no room')) });
    await expect(uploadAndRecord(ui, file, ASSET_KINDS.MAP)).resolves.toBe('mxc://hs/abc');
  });

  it('records nothing when the upload returns no url', async () => {
    const ui = makeUi({ upload: vi.fn().mockResolvedValue(null) });
    expect(await uploadAndRecord(ui, file, ASSET_KINDS.MAP)).toBeNull();
    expect(ui.state.recordAsset).not.toHaveBeenCalled();
  });

  it('works when the room has no asset library wired up at all', async () => {
    const ui = makeUi();
    ui.state = {};
    await expect(uploadAndRecord(ui, file, ASSET_KINDS.MAP)).resolves.toBe('mxc://hs/abc');
  });
});
