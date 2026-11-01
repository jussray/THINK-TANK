import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('starting a new interview refuses to overwrite an unfinished interview', () => {
  const source = readFileSync(new URL('../../app/index-page.js', import.meta.url), 'utf8');
  const start = source.match(/async function start\(\)\{([\s\S]*?)\}\nasync function answer\(/)?.[1];
  assert.ok(start, 'start handler must exist');
  assert.match(start, /prior\?\.status==='interviewing'/);
  assert.match(start, /return;/);
  assert.ok(start.indexOf("prior?.status==='interviewing'") < start.indexOf('showInterviewMode(true,idea)'), 'guard must precede UI changes');
  assert.ok(start.indexOf("prior?.status==='interviewing'") < start.indexOf('record={'), 'guard must precede record replacement');
});
