/**
 * createStage must no-op when the host environment cannot provide a 2D
 * canvas context. happy-dom returns null from getContext('2d'), which
 * causes Konva's SceneCanvas to crash inside setWidth/setSize. Tests
 * that mount MapStrip (e.g. mapShellGmTools.test.js) only care about
 * the toolbar markup and should not pay for stage construction.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStage } from '../map/stage.js';

describe('createStage - non-renderable environment guard', () => {
  let originalGetContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('returns without setting mr.stage when getContext returns null', () => {
    HTMLCanvasElement.prototype.getContext = () => null;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const mr = { canvas: host, stage: null, stageContainer: null };
    createStage(mr);
    expect(mr.stage).toBeNull();
    expect(mr.stageContainer).toBeNull();
  });

  it('returns without setting mr.stage when host is missing', () => {
    const mr = { canvas: null, stage: null, stageContainer: null };
    createStage(mr);
    expect(mr.stage).toBeNull();
  });
});
