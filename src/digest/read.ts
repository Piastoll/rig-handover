import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

// Parses one log line; null when it is not a valid RunLine.
function parseLine(text: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isStatus(o.status)) return null;
  const owner = typeof o.owner === 'string' ? o.owner : null;
  const line: RunLine = { at: o.at, job: o.job, status: o.status, owner };
  if (typeof o.error === 'string') line.error = o.error;
  return line;
}

// Orders log times by instant; falls back to string order if a time does not parse.
function compareAt(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a < b ? -1 : a > b ? 1 : 0;
  return ta - tb;
}

function toRow(job: string, lines: RunLine[]): DigestRow {
  // Stable sort keeps file order on ties.
  const sorted = [...lines].sort((a, b) => compareAt(a.at, b.at));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  let lastError: string | null = null;
  for (const line of sorted) if (line.error !== undefined) lastError = line.error;
  return {
    job,
    owner: last.owner,
    runs: lines.length,
    retries: lines.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');

  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') continue;
    const line = parseLine(rawLine);
    if (line === null) {
      badLines++;
      continue;
    }
    const list = byJob.get(line.job);
    if (list) list.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows = [...byJob.entries()]
    .map(([job, lines]) => toRow(job, lines))
    .sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines };
};
