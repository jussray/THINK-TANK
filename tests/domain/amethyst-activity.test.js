import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('app/workspace-page.js','utf8');
const snippet=source.slice(source.indexOf("  const activity = $('amethystActivity');"),source.indexOf("  screen = 'proposals'; render();",source.indexOf("  const activity = $('amethystActivity');")));
for(const reject of [false,true])test('Amethyst clears after '+(reject?'failed':'successful')+' persistence',async()=>{let release;const el={hidden:true};const wait=new Promise((res,rej)=>{release=reject?()=>rej(new Error('save failed')):res});const work=vm.runInNewContext('(async()=>{'+snippet+'})()',{$:()=>el,persist:()=>wait});assert.equal(el.hidden,false);release();if(reject)await assert.rejects(work,/save failed/);else await work;assert.equal(el.hidden,true);});

test('workspace loads scoped companion animation and preserves hidden and reduced-motion behavior',()=>{const html=readFileSync('workspace.html','utf8');assert.ok(html.includes('.amethyst-activity[hidden]{display:none!important}'));assert.ok(html.includes('@media(prefers-reduced-motion:reduce){.amethyst-activity .amethyst-sprite{animation:none}}'));});

import {createHash} from 'node:crypto';
test('Think Tank uses the original Amethyst sparkle pose only during real persistence',()=>{const html=readFileSync('workspace.html','utf8');assert.match(html,/class="amethyst-sprite"/);assert.match(html,/background-position:-60px 0/);assert.equal(createHash('sha256').update(readFileSync('assets/amethyst-states.webp')).digest('hex'),'a3d87ee7cac9d7cf6b56a4c08e9a0420b75ac5939d60ae66f4bb3919f46ff422');assert.match(readFileSync('scripts/build-static-artifact.mjs','utf8'),/assets\/amethyst-states\.webp/)});
