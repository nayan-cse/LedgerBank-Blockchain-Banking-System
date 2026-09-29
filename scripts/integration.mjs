import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {createRuntime} from '../lib/runtime.mjs';import {createApp} from '../lib/server.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ledgerbank-cli-'));let rt,app;const results=[];
async function execute(script,args=[],env={}){const p=spawn(process.execPath,[script,...args],{stdio:['ignore','pipe','pipe'],env:{...process.env,...env}});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);const exitCode=await new Promise((resolve,reject)=>{p.on('exit',resolve);p.on('error',reject);});const result={script,args,exitCode,stdout,stderr};results.push(result);return result;}
try{rt=await createRuntime();app=await createApp(rt);const demo=await execute('scripts/demo.mjs',[],{APP_URL:`http://127.0.0.1:${app.port}`,DEMO_OUTPUT:directory});assert.equal(demo.exitCode,0,demo.stderr);
  const flags=['--rpc',`http://127.0.0.1:${rt.rpcPort}`,'--bank',rt.deployment.address,'--chain','31337'];
  const good=await execute('scripts/verify-receipt.mjs',[path.join(directory,'receipt-transfer.json'),...flags]);assert.equal(good.exitCode,0,good.stderr);assert.equal(JSON.parse(good.stdout).status,'VERIFIED');
  const bad=await execute('scripts/verify-receipt.mjs',[path.join(directory,'receipt-tampered.json'),...flags]);assert.equal(bad.exitCode,2,bad.stderr);assert.equal(JSON.parse(bad.stdout).status,'ALTERED');
  fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/cli-integration.json',JSON.stringify({executedAt:new Date().toISOString(),passed:true,results},null,2));console.log('Live banking demo and independent receipt verifier passed.');
}finally{if(app)await app.close();if(rt)await rt.close();fs.rmSync(directory,{recursive:true,force:true});}
