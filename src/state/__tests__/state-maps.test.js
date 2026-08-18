/**
 * Drawing history (Undo/Redo) tests. Drawings now live in sm.yjs.drawingsArray
 * (Y.Array). The bridge mirrors the Y.Array back to sm.drawings, but writers
 * read/write only the Y.Array - that's the source of truth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  addDrawing,
  undoDrawing,
  redoDrawing,
  clearDrawings,
  pushDrawingHistory,
} from '../writer.js';

function makeSm() {
  const doc = new Y.Doc();
  const drawingsArray = doc.getArray('drawings');
  const sm = {
    yjs: { drawingsArray },
    _drawingHistory: [],
    _drawingFuture: [],
    powerLevels: { users: { '@gm:m': 50 } },
    widgetManager: { userId: '@gm:m' },
    notifyUpdate: vi.fn(),
  };
  // sm.drawings is the array snapshot consumers read; in production the
  // YjsSignalBridge keeps it in sync with the Y.Array. For tests we mirror
  // it manually via the doc's update observer.
  Object.defineProperty(sm, 'drawings', {
    get() { return drawingsArray.toArray(); },
    set(_v) { /* writers don't assign sm.drawings directly anymore */ },
    configurable: true,
  });
  return sm;
}

describe('Drawing history (Undo/Redo)', () => {
  const stroke1 = { id: 's1', type: 'pencil', points: [[0,0]], color: '#f00', width: 2 };
  const stroke2 = { id: 's2', type: 'pencil', points: [[5,5]], color: '#0f0', width: 2 };

  it('addDrawing appends a stroke to the Yjs array', async () => {
    const sm = makeSm();
    await addDrawing(sm, stroke1);
    expect(sm.drawings).toContainEqual(stroke1);
  });

  it('undoDrawing removes the most recent stroke', async () => {
    const sm = makeSm();
    await addDrawing(sm, stroke1);
    await addDrawing(sm, stroke2);

    await undoDrawing(sm);

    expect(sm.drawings).not.toContainEqual(stroke2);
    expect(sm.drawings).toContainEqual(stroke1);
  });

  it('redoDrawing restores an undone stroke', async () => {
    const sm = makeSm();
    await addDrawing(sm, stroke1);
    await undoDrawing(sm);

    expect(sm.drawings).toHaveLength(0);

    await redoDrawing(sm);

    expect(sm.drawings).toContainEqual(stroke1);
  });

  it('adding a new stroke clears the redo (future) stack', async () => {
    const sm = makeSm();
    await addDrawing(sm, stroke1);
    await undoDrawing(sm);

    expect(sm._drawingFuture).toHaveLength(1);

    await addDrawing(sm, stroke2);

    expect(sm._drawingFuture).toHaveLength(0);
    expect(sm.drawings).toEqual([stroke2]);
  });

  it('undo is a no-op when history is empty', async () => {
    const sm = makeSm();
    await undoDrawing(sm);
    expect(sm.drawings).toEqual([]);
  });

  it('redo is a no-op when future is empty', async () => {
    const sm = makeSm();
    await redoDrawing(sm);
    expect(sm.drawings).toEqual([]);
  });

  it('clearDrawings empties the Y.Array', async () => {
    const sm = makeSm();
    await addDrawing(sm, stroke1);
    await addDrawing(sm, stroke2);

    await clearDrawings(sm);

    expect(sm.drawings).toHaveLength(0);
  });

  it('drawing history is capped at 50 snapshots', async () => {
    const sm = makeSm();
    for (let i = 0; i < 52; i++) {
      pushDrawingHistory(sm);
      sm.yjs.drawingsArray.push([{ id: 's' + i, type: 'pencil', points: [[i, i]] }]);
    }
    expect(sm._drawingHistory.length).toBe(50);
  });
});
