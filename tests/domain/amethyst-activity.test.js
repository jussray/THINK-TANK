import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('app/workspace-page.js','utf8');
const snippet=source.slice(source.indexOf("  const activity = $('amethystActivity');"),source.indexOf("  screen = 'proposals'; render();",source.indexOf("  const activity = $('amethystActivity');")));
for(const reject of [false,true])test('Amethyst clears after '+(reject?'failed':'successful')+' persistence',async()=>{let release;const el={hidden:true};const wait=new Promise((res,rej)=>{release=reject?()=>rej(new Error('save failed')):res});const work=vm.runInNewContext('(async()=>{'+snippet+'})()',{$:()=>el,persist:()=>wait});assert.equal(el.hidden,false);release();if(reject)await assert.rejects(work,/save failed/);else await work;assert.equal(el.hidden,true);});

test('workspace loads scoped companion animation and preserves hidden and reduced-motion behavior',()=>{const html=readFileSync('workspace.html','utf8');assert.ok(html.includes('.amethyst-activity[hidden]{display:none!important}'));assert.ok(html.includes('@media(prefers-reduced-motion:reduce){.amethyst-activity img{animation:none}}'));});
