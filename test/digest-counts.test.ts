import { describe, expect, it } from 'vitest';
import { countNight } from '../src/digest/counts.js';
import type { DigestRow, Night } from '../src/digest/types.js';

const row = (job: string, lastStatus: DigestRow['lastStatus']): DigestRow => ({
  job,
  owner: null,
  runs: 1,
  retries: 0,
  lastStatus,
  lastError: null,
  firstAt: '2026-10-28T02:00:00+01:00',
  lastAt: '2026-10-28T02:05:00+01:00',
});

describe('countNight', () => {
  it('counts jobs by last status and carries bad lines', () => {
    const night: Night = {
      night: '2026-10-28',
      rows: [row('a', 'ok'), row('b', 'ok'), row('c', 'ok'), row('d', 'retry'), row('e', 'fail')],
      badLines: 2,
    };
    expect(countNight(night)).toEqual({ ok: 3, retry: 1, fail: 1, bad: 2 });
  });

  it('is all zero for an empty night', () => {
    expect(countNight({ night: '2026-10-29', rows: [], badLines: 0 })).toEqual({ ok: 0, retry: 0, fail: 0, bad: 0 });
  });
});
