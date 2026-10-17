import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=args=>spawnSync(process.execPath,['src/cli.mjs',...args],{cwd:root,encoding:'utf8',timeout:10000});
test('canonical engine CLI exercises the complete fixture and emits only an operational summary on request',()=>{const r=run(['engine','--context','fixtures/engine-context.json','--at','2026-10-16T18:00:00Z','--summary']);assert.equal(r.status,0,r.stderr);const summary=JSON.parse(r.stdout);assert.equal(summary.examined,11);assert.equal(summary.prepared,5);assert.equal(summary.dry_run,true);assert.equal(summary.durable,false);assert.equal(summary.scope,'selected_context');assert.equal(summary.global_progress,'consumer_required');assert.equal(summary.campaigns.length,7);assert.ok(!r.stdout.includes('body'));});
test('engine CLI refuses fixture writes, invented live clocks and unsafe exports before remote access',()=>{for(const args of [['engine','--context','fixtures/engine-context.json','--commit'],['engine','--at','2026-10-16T18:00:00Z','--commit'],['engine','--context','fixtures/engine-context.json','--at','2026-10-16T18:00:00Z','--output','public-draft.json'],['work-resume']]){const r=run(args);assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/No completion claimed/);assert.ok(!r.stderr.includes('request_summary'));}});
