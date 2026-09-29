import fs from 'node:fs';
import {sha256,toUtf8Bytes,parseEther} from 'ethers';
import {createRuntime} from '../lib/runtime.mjs';
import {createApp} from '../lib/server.mjs';
import {monitorResources} from '../lib/resources.mjs';
import {buildReceipt,verifyReceipt} from '../lib/receipts.mjs';
const args=JSON.parse(process.argv[2]),rows=[],GAS=2_000_000_000n,ZERO='0x'+'0'.repeat(64);
const hash=value=>sha256(toUtf8Bytes(value));
const request=(label)=>hash(`${args.mode}-${args.volume}-${args.concurrency}-${args.repeat}-${label}`);
function statistics(values){const s=[...values].sort((a,b)=>a-b),n=s.length;if(!n)return{n:0,mean:null,median:null,p95:null,min:null,max:null};return{n,mean:s.reduce((a,b)=>a+b,0)/n,median:n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2,p95:s[Math.ceil(n*.95)-1],min:s[0],max:s.at(-1)};}
async function measured(kind,send,extra={}){
  const start=performance.now(),tx=await send(),acknowledged=performance.now(),receipt=await tx.wait(),end=performance.now();
  const row={kind,...extra,transactionHash:receipt.hash,blockNumber:receipt.blockNumber,gasUsed:String(receipt.gasUsed),gasPriceWei:String(receipt.gasPrice),feeWei:String(receipt.fee),submissionMs:acknowledged-start,confirmationWaitMs:end-acknowledged,transactionLatencyMs:end-start,success:receipt.status===1};
  if(BigInt(row.gasUsed)*BigInt(row.gasPriceWei)!==BigInt(row.feeWei))throw new Error('Receipt fee mismatch.');rows.push(row);return row;
}
async function enroll(rt,signer,label){const c=rt.contract.connect(signer);await measured('registration',()=>c.registerCustomer(hash(label),{gasPrice:GAS}));await measured('account-opening',()=>c.openAccount({gasPrice:GAS}));}
async function reconciliation(rt){let sum=0n;const count=Number(await rt.contract.accountCount());for(let i=1;i<=count;i++)sum+=await rt.contract.balanceOf(await rt.contract.accountOwners(i));const backing=await rt.contract.backing();if(sum!==backing.liabilities||backing.assets<sum)throw new Error('Bank accounting invariant failed.');return{sumBalancesWei:sum.toString(),liabilitiesWei:backing.liabilities.toString(),assetsWei:backing.assets.toString(),solvent:backing.solvent};}
let rt,app,stopMonitor;
try{
  rt=await createRuntime();
  if(args.mode==='workflow'){
    app=await createApp(rt);const base=`http://127.0.0.1:${app.port}`,a=rt.signers[1],b=rt.signers[2],B=await b.getAddress(),c=rt.contract.connect(a);
    await enroll(rt,a,'workflow-a');await enroll(rt,b,'workflow-b');await measured('prefunding',()=>c.deposit(request('prefund'),ZERO,{gasPrice:GAS,value:parseEther('10')}));
    const measuredRows=[],receiptTimes=[],receiptChecks=[];const samples={};
    stopMonitor=monitorResources();
    for(let cycle=0;cycle<22;cycle++)for(const kind of ['deposit','withdrawal','transfer']){
      const req=request(`${cycle}-${kind}`),amount=parseEther(kind==='deposit'?'.1':kind==='withdrawal'?'.03':'.02'),start=performance.now();
      const row=await measured(cycle<2?'warmup-'+kind:kind,()=>kind==='deposit'?c.deposit(req,ZERO,{gasPrice:GAS,value:amount}):kind==='withdrawal'?c.withdraw(amount,req,ZERO,{gasPrice:GAS}):c.transfer(B,amount,req,ZERO,{gasPrice:GAS}),{cycle,amountWei:String(amount),requestId:req});
      const receiptStarted=performance.now(),response=await fetch(`${base}/api/receipts/${row.transactionHash}`),receipt=await response.json();if(!response.ok)throw new Error(receipt.error);const end=performance.now();
      if(cycle>=2){measuredRows.push({...row,endToEndMs:end-start,receiptGenerationHttpMs:end-receiptStarted});receiptTimes.push(end-receiptStarted);}
      samples[kind]=receipt;
    }
    const resources=stopMonitor();stopMonitor=null;
    const original=samples.transfer,tampered={...original,amountWei:'999000000000000000000'};
    const valid=await verifyReceipt(rt.contract,rt.deployment,original),altered=await verifyReceipt(rt.contract,rt.deployment,tampered);if(!valid.valid||altered.valid)throw new Error('Receipt demonstration failed.');
    const operationStats={};for(const kind of ['deposit','withdrawal','transfer']){const list=measuredRows.filter(r=>r.kind===kind);operationStats[kind]={transactionMs:statistics(list.map(r=>r.transactionLatencyMs)),confirmationWaitMs:statistics(list.map(r=>r.confirmationWaitMs)),endToEndMs:statistics(list.map(r=>r.endToEndMs)),gasUsed:statistics(list.map(r=>Number(r.gasUsed))),feeEth:statistics(list.map(r=>Number(r.feeWei)/1e18))};}
    const result={mode:'workflow',deployment:rt.deployment,operations:operationStats,resources,receiptHttpMs:statistics(receiptTimes),raw:measuredRows,transactions:rows,reconciliation:await reconciliation(rt),demonstration:{samples,original,tampered,valid,altered,note:'Historical receipts from an isolated evaluation chain. Run npm run demo for receipts on your own local chain.'}};
    process.send?.(result);
  }else{
    const {volume,concurrency,repeat}=args,workers=[];
    for(let i=0;i<concurrency;i++){
      const signer=rt.signers[i+1],recipientSigner=rt.signers[i+12],address=await signer.getAddress(),recipient=await recipientSigner.getAddress();
      await enroll(rt,signer,`worker-${i}`);await enroll(rt,recipientSigner,`recipient-${i}`);
      const c=rt.contract.connect(signer);await measured('prefunding',()=>c.deposit(request(`prefund-${i}`),ZERO,{gasPrice:GAS,value:parseEther('5')}));workers.push({c,address,recipient});
    }
    const initial=await reconciliation(rt),start=performance.now();stopMonitor=monitorResources();let successes=0;const failures=[];
    await Promise.all(workers.map(async(w,worker)=>{
      let nonce=await rt.provider.getTransactionCount(w.address,'pending');
      for(let index=worker;index<volume;index+=concurrency){
        const kind=['deposit','withdrawal','transfer'][index%3],amount=parseEther('.001'),req=request(`load-${index}`),tx={gasPrice:GAS,gasLimit:300_000n,nonce:nonce++};
        try{const row=await measured(kind,()=>kind==='deposit'?w.c.deposit(req,ZERO,{...tx,value:amount}):kind==='withdrawal'?w.c.withdraw(amount,req,ZERO,tx):w.c.transfer(w.recipient,amount,req,ZERO,tx),{load:true,volume,concurrency,repeat,index,requestId:req,amountWei:String(amount)});if(row.success)successes++;else failures.push({index,error:'Receipt status 0'});}catch(error){failures.push({index,error:error.shortMessage||error.message});}
      }
    }));
    const resources=stopMonitor();stopMonitor=null;const seconds=(performance.now()-start)/1000,final=await reconciliation(rt);
    const loadRows=rows.filter(r=>r.load);if(Number(await rt.contract.transactionCount())-concurrency!==successes)throw new Error('Financial event count differs from successful load receipts.');
    const deposits=loadRows.filter(r=>r.kind==='deposit').reduce((s,r)=>s+BigInt(r.amountWei),0n),withdrawals=loadRows.filter(r=>r.kind==='withdrawal').reduce((s,r)=>s+BigInt(r.amountWei),0n);
    if(BigInt(initial.liabilitiesWei)+deposits-withdrawals!==BigInt(final.liabilitiesWei))throw new Error('Expected liabilities do not reconcile.');
    process.send?.({mode:'load',volume,concurrency,repeat,successes,failures,successRate:successes/volume*100,durationSeconds:seconds,tps:successes/seconds,transactionMs:statistics(loadRows.map(r=>r.transactionLatencyMs)),resources,initial,final,transactions:rows});
  }
}catch(error){process.send?.({error:error.stack||error.message});process.exitCode=1;}finally{if(stopMonitor)stopMonitor();if(app)await app.close();if(rt)await rt.close();if(process.connected)process.disconnect();}
