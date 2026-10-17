import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {embeddedAssetResponse,EMBEDDED_ASSET_PATHS} from '../src/embedded-assets.mjs';

const expected=['/index.html','/style.css','/workspace.html','/workspace.js'];

test('embedded preview assets stay byte-for-byte aligned with public assets',async()=>{
  assert.deepEqual(EMBEDDED_ASSET_PATHS,expected);
  for(const path of expected){
    const response=embeddedAssetResponse(new Request('https://preview.test'+path));
    assert.ok(response,'missing embedded response for '+path);
    const disk=await readFile(new URL('../public'+path,import.meta.url),'utf8');
    assert.equal(await response.text(),disk,'embedded asset drift: '+path);
  }
  const root=embeddedAssetResponse(new Request('https://preview.test/'));
  assert.equal(await root.text(),await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  const workspace=embeddedAssetResponse(new Request('https://preview.test/workspace'));
  assert.equal(await workspace.text(),await readFile(new URL('../public/workspace.html',import.meta.url),'utf8'));
  assert.equal(embeddedAssetResponse(new Request('https://preview.test/not-found')),null);
});
