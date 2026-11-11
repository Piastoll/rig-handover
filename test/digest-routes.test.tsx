import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type JsonRow = { job: string };
type JsonNight = { night: string; rows: JsonRow[]; badLines: number };

const line = (job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at: '2026-10-29T01:30:00+01:00', job, status, owner, ...(error === undefined ? {} : { error }) });

let dir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(
    path.join(dir, '2026-10-29.jsonl'),
    [
      line('zeta/last', 'ok', 'rook'),
      line('alpha/first', 'retry', 'rook', 'x'),
      line('alpha/first', 'ok', 'rook'),
      line('mid/orphan', 'ok', null),
      line('mid/failing', 'fail', 'rook', 'boom'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(dir, '2026-10-30.jsonl'), '');
  fs.writeFileSync(
    path.join(dir, '2026-10-31.jsonl'),
    [line('good/one', 'ok', 'rook'), 'this is not json', line('good/two', 'ok', 'rook')].join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(dir, '2026-11-01.jsonl'),
    [
      line('r/many', 'retry', 'rook', 'a'),
      line('r/many', 'retry', 'rook', 'b'),
      line('r/many', 'retry', 'rook', 'c'),
      line('r/many', 'ok', 'rook'),
    ].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('lists the jobs sorted by job', async () => {
    const res = await app.request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    const order = ['alpha/first', 'mid/failing', 'mid/orphan', 'zeta/last'].map((j) => html.indexOf(j));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2020-01-01');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders good jobs and flags a bad line', async () => {
    const res = await app.request('/digest/2026-10-31');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('good/one');
    expect(html).toContain('good/two');
    expect(html).toContain('did not parse');
  });

  it('warns on a failed last status and on 3+ retries', async () => {
    const failing = await (await app.request('/digest/2026-10-29')).text();
    expect(failing).toContain('class="warn"');
    const retried = await (await app.request('/digest/2026-11-01')).text();
    expect(retried).toContain('r/many');
    expect(retried).toContain('class="warn"');
  });

  it('does not warn when all is well', async () => {
    const html = await (await app.request('/digest/2026-10-31')).text();
    expect(html).not.toContain('class="warn"');
  });

  it('shows — for a null owner', async () => {
    const html = await (await app.request('/digest/2026-10-29')).text();
    expect(html).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app.request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.night).toBe('2026-10-29');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/first', 'mid/failing', 'mid/orphan', 'zeta/last']);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
  });

  it('gives no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line', async () => {
    const res = await app.request('/api/digest/2026-10-31');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(2);
  });

  it('orders jobs the same as the HTML page', async () => {
    const body = (await (await app.request('/api/digest/2026-10-29')).json()) as JsonNight;
    const html = await (await app.request('/digest/2026-10-29')).text();
    const jobs = body.rows.map((r) => r.job);
    const inHtml = [...jobs].sort((a, b) => html.indexOf(a) - html.indexOf(b));
    expect(inHtml).toEqual(jobs);
  });
});
