import type { Night } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number; bad: number };

// Per job, by each job's last status.
export function countNight(night: Night): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, bad: night.badLines };
  for (const row of night.rows) counts[row.lastStatus] += 1;
  return counts;
}
