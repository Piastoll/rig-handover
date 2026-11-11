import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('reads 5 jobs and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows).toHaveLength(5);
    expect(night?.badLines).toBe(1);
  });

  it('sorts rows by job', () => {
    const jobs = night?.rows.map((r) => r.job) ?? [];
    expect(jobs).toEqual([...jobs].sort((a, b) => a.localeCompare(b)));
  });

  it('counts retries and keeps the last error', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps a failed job', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row with a null owner', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, lastError: null });
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a missing night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('ignores blank lines, counts malformed ones, keeps file order on ties', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"retry","owner":"x","error":"e1"}',
      '',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"y"}',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"job":"b","status":"ok","owner":"x"}',
      '[1,2]',
      '   ',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'y',
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'e1',
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T01:00:00+01:00',
      },
    ]);
  });
});
