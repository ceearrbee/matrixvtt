/**
 * Holding pen for outbound Yjs updates that could not be sent (offline,
 * or rate-limited past the transport's retries). Updates are merged via
 * Y.mergeUpdates - lossless for Yjs binary updates - instead of dropped,
 * and persisted to sessionStorage so a reload mid-outage keeps the edits.
 */

import * as Y from 'yjs';
import { STORAGE_KEYS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

function defaultStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function uint8ToBase64(arr) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUint8(str) {
  const binary = atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export class YjsPendingBuffer {
  /**
   * @param {string} roomId
   * @param {{storage?: {getItem: Function, setItem: Function, removeItem: Function} | null}} [opts]
   */
  constructor(roomId, { storage } = {}) {
    this.storageKey = `${STORAGE_KEYS.YJS_PENDING}:${roomId}`;
    this._storage = storage !== undefined ? storage : defaultStorage();
    this._merged = null;
    this._count = 0;
    this._storageWarned = false;
  }

  get count() { return this._count; }
  get isEmpty() { return this._merged === null; }

  add(update) {
    this._merged = this._merged ? Y.mergeUpdates([this._merged, update]) : update;
    this._count += 1;
  }

  takeAll() {
    const merged = this._merged;
    this._merged = null;
    this._count = 0;
    return merged;
  }

  persist() {
    if (!this._storage) return;
    try {
      if (this._merged) {
        this._storage.setItem(this.storageKey, uint8ToBase64(this._merged));
      } else {
        this._storage.removeItem(this.storageKey);
      }
    } catch (err) {
      if (!this._storageWarned) {
        this._storageWarned = true;
        logger.warn('YjsPendingBuffer', `could not persist pending updates: ${err?.message || err}`);
      }
    }
  }

  restore() {
    if (!this._storage) return null;
    try {
      const raw = this._storage.getItem(this.storageKey);
      this._storage.removeItem(this.storageKey);
      return raw ? base64ToUint8(raw) : null;
    } catch {
      return null;
    }
  }
}
