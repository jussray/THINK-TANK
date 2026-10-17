import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));

test('isolated Think Tank preview names its own Worker and D1',()=>{
 assert.equal(cfg.name,'think-tank-council-preview');
 assert.equal(cfg.d1_databases[0].binding,'DB');
 assert.equal(cfg.d1_databases[0].database_name,'think-tank');
 assert.equal(cfg.d1_databases[0].database_id,'24672c6e-2d4c-4ffb-8e87-bb391d1d5830');
});
test('Cloudflare Access audience matches protected preview, never production app',()=>{
 assert.equal(cfg.vars.ACCESS_TEAM_DOMAIN,'jussray.cloudflareaccess.com');
 assert.equal(cfg.vars.ACCESS_AUD,'23a4f44b94fef56ec7562da17b5d77d1e4d5f9467f0624349ce84e69bfdc40cd');
 assert.notEqual(cfg.vars.ACCESS_AUD,'82c660bb0d081053c839f3b359aba04e1f1ca7c82c15cd2bffb3b894d13b85a2');
});
test('cron cannot claim real live-model execution without a server-only key',()=>{
 assert.equal(Object.hasOwn(cfg.vars,'OPENAI_API_KEY'),false);
 assert.equal(Object.hasOwn(cfg.vars,'SUPABASE_SERVICE_ROLE_KEY'),false);
});
