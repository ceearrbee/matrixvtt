/**
 * A new build waits for the player instead of replacing them mid-game.
 *
 * The worker called skipWaiting on every install, so a deploy took
 * over on the next navigation with no say from whoever was mid-session.
 * It also meant there was never a waiting worker for a prompt to point
 * at.
 *
 * The registration is a parameter so the decision can be driven
 * without a real service worker. The condition that matters is
 * `hasController`: a worker reaching `installed` with no controller is
 * a first install, not an update, and prompting or reloading there
 * would refresh a first-time visitor for nothing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { watchForUpdate, acceptUpdate } from '../ui/pwa/update-watcher.js';

function fakeWorker(state = 'installing') {
  const w = new EventTarget();
  w.state = state;
  w.postMessage = vi.fn();
  w.become = (next) => { w.state = next; w.dispatchEvent(new Event('statechange')); };
  return w;
}

function fakeRegistration({ waiting = null, installing = null } = {}) {
  const r = new EventTarget();
  r.waiting = waiting;
  r.installing = installing;
  r.update = vi.fn().mockResolvedValue(undefined);
  r.findsUpdate = (worker) => {
    r.installing = worker;
    r.dispatchEvent(new Event('updatefound'));
  };
  return r;
}

let onReady;
beforeEach(() => { onReady = vi.fn(); });

describe('watchForUpdate', () => {
  it('reports a worker that is already waiting', () => {
    const waiting = fakeWorker('installed');
    watchForUpdate(fakeRegistration({ waiting }), { onReady, hasController: true });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(waiting);
  });

  it('says nothing about a first install, which has no controller', () => {
    watchForUpdate(fakeRegistration({ waiting: fakeWorker('installed') }), { onReady, hasController: false });
    expect(onReady).not.toHaveBeenCalled();
  });

  it('reports a worker that becomes ready later', () => {
    const reg = fakeRegistration();
    watchForUpdate(reg, { onReady, hasController: true });
    const worker = fakeWorker();
    reg.findsUpdate(worker);
    expect(onReady).not.toHaveBeenCalled();
    worker.become('installed');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('ignores a worker that installs with no controller to replace', () => {
    const reg = fakeRegistration();
    watchForUpdate(reg, { onReady, hasController: false });
    const worker = fakeWorker();
    reg.findsUpdate(worker);
    worker.become('installed');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('reports once even if the worker changes state again', () => {
    const reg = fakeRegistration();
    watchForUpdate(reg, { onReady, hasController: true });
    const worker = fakeWorker();
    reg.findsUpdate(worker);
    worker.become('installed');
    worker.become('activated');
    worker.become('installed');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('stops reporting once disposed', () => {
    const reg = fakeRegistration();
    const dispose = watchForUpdate(reg, { onReady, hasController: true });
    dispose();
    const worker = fakeWorker();
    reg.findsUpdate(worker);
    worker.become('installed');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('survives a registration that is not there', () => {
    expect(() => watchForUpdate(null, { onReady, hasController: true })()).not.toThrow();
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe('acceptUpdate', () => {
  function fakeNav(controller = {}) {
    const nav = new EventTarget();
    nav.controller = controller;
    return nav;
  }

  it('asks the waiting worker to take over', () => {
    const waiting = fakeWorker('installed');
    acceptUpdate(fakeRegistration({ waiting }), { nav: fakeNav(), reload: vi.fn() });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('reloads when the new worker takes control', () => {
    const reload = vi.fn();
    const nav = fakeNav();
    acceptUpdate(fakeRegistration({ waiting: fakeWorker('installed') }), { nav, reload });
    expect(reload).not.toHaveBeenCalled();
    nav.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once, however many times control changes', () => {
    const reload = vi.fn();
    const nav = fakeNav();
    acceptUpdate(fakeRegistration({ waiting: fakeWorker('installed') }), { nav, reload });
    nav.dispatchEvent(new Event('controllerchange'));
    nav.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads straight away when another tab already took the update', () => {
    const reload = vi.fn();
    acceptUpdate(fakeRegistration({ waiting: null }), { nav: fakeNav(), reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads anyway if the handover never happens', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    acceptUpdate(fakeRegistration({ waiting: fakeWorker('installed') }), { nav: fakeNav(), reload });
    vi.advanceTimersByTime(10000);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
