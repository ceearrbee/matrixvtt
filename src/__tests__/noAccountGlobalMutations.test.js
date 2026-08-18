/**
 * MatrixVTT must never change anything visible outside the rooms it
 * runs in. Display name and avatar are room-scoped m.room.member
 * writes (MatrixClient.setRoomDisplayName, room-adapter
 * setRoomDisplayName); the global profile, account data, presence,
 * pushers, and credentials are off-limits. Mirrors the
 * scan-bad-patterns.sh pre-commit gate so CI enforces it too.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');

const FORBIDDEN = [
  /sdk\.setDisplayName\(/,
  /widgetApi\.setDisplayName\(/,
  /widgetApi\)\.setDisplayName\(/,
  /\.(setAvatarUrl|setProfileInfo|setAccountData|setPresence|setPusher|setPassword|addThreePid|setIgnoredUsers)\(/,
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      yield* walk(full);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('no account-global Matrix mutations in src/', () => {
  it('never calls the global profile / account APIs', () => {
    const hits = [];
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          hits.push(`${path.relative(process.cwd(), file)}: ${pattern}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
