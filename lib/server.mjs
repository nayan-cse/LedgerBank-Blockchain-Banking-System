import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import express from 'express';
import {isAddress,getAddress} from 'ethers';
import {isHash} from './money.mjs';
import {bankEvent,buildReceipt,verifyReceipt} from './receipts.mjs';
import {snapshot} from './resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const importMap='{"imports":{"ethers":"/vendor/ethers.js"}}';
const cspHash=createHash('sha256').update(importMap).digest('base64');
const rpcMethods=new Set(['eth_chainId','net_version','eth_accounts','eth_blockNumber','eth_getBalance','eth_getTransactionCount','eth_getCode','eth_getBlockByNumber','eth_getBlockByHash','eth_getTransactionByHash','eth_getTransactionReceipt','eth_call','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_sendTransaction','eth_sendRawTransaction','eth_getLogs']);
export async function createApp(runtime,{port=0}={}){
  const app=express(),{contract,provider,deployment,artifact}=runtime;
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    if(!['localhost','127.0.0.1','[::1]'].includes(req.hostname))return res.status(403).json({error:'Use localhost.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))return res.status(403).json({error:'Cross-origin request blocked.'});}catch{return res.status(403).json({error:'Invalid origin.'});}}
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'self'; script-src 'self' 'sha256-${cspHash}'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`});next();
  });
  app.use(express.json({limit:'48kb'}));
  const labels=['Administrator','Customer A','Customer B','Customer C','Customer D','Unregistered account'];
  app.get('/api/config',async(req,res)=>res.json({...deployment,abi:artifact.abi,rpcUrl:`http://127.0.0.1:${runtime.rpcPort}`,accounts:await Promise.all(runtime.signers.slice(0,6).map(async(s,i)=>({address:await s.getAddress(),label:labels[i]})))}));
  app.post('/rpc',async(req,res)=>{
    const batch=Array.isArray(req.body)?req.body:[req.body];if(batch.length>25)return res.status(413).json({error:'RPC batch too large.'});
    const results=await Promise.all(batch.map(async r=>{try{if(!rpcMethods.has(r?.method))throw new Error('RPC method is not exposed.');return{jsonrpc:'2.0',id:r.id??null,result:await runtime.chain.provider.request({method:r.method,params:r.params||[]})};}catch(error){return{jsonrpc:'2.0',id:r?.id??null,error:{code:Number.isInteger(error.code)?error.code:-32000,message:error.message,data:error.data}};}}));res.json(Array.isArray(req.body)?results:results[0]);
  });
  app.get('/api/dashboard',async(req,res)=>{
    const blockNumber=await provider.getBlockNumber(),o={blockTag:blockNumber};
    const [customers,accounts,transactions,paused,backing]=await Promise.all([contract.customerCount(o),contract.accountCount(o),contract.transactionCount(o),contract.paused(o),contract.backing(o)]);
    res.json({blockNumber,customerCount:Number(customers),accountCount:Number(accounts),transactionCount:Number(transactions),paused,assetsWei:String(backing.assets),liabilitiesWei:String(backing.liabilities),surplusWei:String(backing.assets-backing.liabilities),solvent:backing.solvent,deployment});
  });
  app.param('address',(req,res,next,value)=>isAddress(value)?next():res.status(400).json({error:'Invalid address.'}));
  app.get('/api/account/:address',async(req,res)=>{
    const address=getAddress(req.params.address),blockNumber=await provider.getBlockNumber(),o={blockTag:blockNumber};
    const [account,commitment,externalBalance]=await Promise.all([contract.accounts(address,o),contract.customers(address,o),provider.getBalance(address,blockNumber)]);
    res.json({address,number:account.number.toString(),openedAt:Number(account.openedAt),frozen:account.frozen,balanceWei:account.balance.toString(),identityCommitment:commitment,externalWalletWei:externalBalance.toString(),blockNumber});
  });
  app.get('/api/accounts',async(req,res)=>{
    const offset=Number(req.query.offset||0);if(!Number.isSafeInteger(offset)||offset<0)return res.status(400).json({error:'Invalid offset.'});
    const blockNumber=await provider.getBlockNumber(),o={blockTag:blockNumber},count=Number(await contract.accountCount(o));
    const accounts=await Promise.all(Array.from({length:Math.min(25,Math.max(0,count-offset))},async(_,i)=>{
      const address=await contract.accountOwners(offset+i+1,o),account=await contract.accounts(address,o);return{address,number:account.number.toString(),openedAt:Number(account.openedAt),frozen:account.frozen,balanceWei:account.balance.toString()};
    }));res.json({accounts,total:count,nextOffset:offset+accounts.length<count?offset+accounts.length:null,blockNumber});
  });
  app.get('/api/history',async(req,res)=>{
    if(req.query.address&&!isAddress(req.query.address))return res.status(400).json({error:'Invalid history address.'});
    const before=req.query.before?BigInt(req.query.before):null;if(before!==null&&before<1n)return res.status(400).json({error:'Invalid sequence cursor.'});
    const address=req.query.address?.toLowerCase(),blockNumber=await provider.getBlockNumber();
    const logs=await contract.queryFilter(contract.filters.BankTransaction(),deployment.blockNumber,blockNumber);
    const all=logs.map(l=>bankEvent(l,contract)).filter(Boolean).filter(r=>(!address||r.sender.toLowerCase()===address||r.recipient.toLowerCase()===address)&&(!before||BigInt(r.sequence)<before)).reverse();
    const history=all.slice(0,25);res.json({history,nextBefore:all.length>25?history.at(-1).sequence:null,blockNumber});
  });
  app.get('/api/audit',async(req,res)=>{
    const block=await provider.getBlockNumber(),logs=await provider.getLogs({address:deployment.address,fromBlock:deployment.blockNumber,toBlock:block});
    res.json(logs.slice(-100).reverse().map(log=>{const ev=contract.interface.parseLog(log);return{name:ev.name,transactionHash:log.transactionHash,blockNumber:log.blockNumber,args:ev.fragment.inputs.map((f,i)=>({name:f.name,value:String(ev.args[i])}))};}));
  });
  app.get('/api/requests/:address/:id',async(req,res)=>{
    if(!isHash(req.params.id))return res.status(400).json({error:'Invalid request ID.'});
    const sequence=await contract.requestSequences(req.params.address,req.params.id);
    if(sequence===0n)return res.json({executed:false});
    const events=await contract.queryFilter(contract.filters.BankTransaction(sequence),deployment.blockNumber,'latest');
    if(events.length!==1)throw new Error('Request event is unavailable. Check the trusted RPC.');
    res.json({executed:true,sequence:sequence.toString(),transactionHash:events[0].transactionHash});
  });
  app.get('/api/receipts/:hash',async(req,res)=>{
    const receipt=await buildReceipt(contract,deployment,req.params.hash);res.attachment(`ledgerbank-receipt-${receipt.sequence}.json`).json(receipt);
  });
  app.post('/api/receipts/verify',async(req,res)=>res.json(await verifyReceipt(contract,deployment,req.body)));
  app.get('/api/resources',(req,res)=>res.json({scope:'Current application process including local EVM and API',...snapshot()}));
  app.get('/vendor/ethers.js',(req,res)=>res.sendFile(path.join(root,'node_modules/ethers/dist/ethers.min.js')));
  app.get('/lib/money.mjs',(req,res)=>res.sendFile(path.join(root,'lib/money.mjs')));
  app.use(express.static(path.join(root,'public'),{etag:false}));
  app.get('/receipt/:hash',(req,res)=>res.sendFile(path.join(root,'public/receipt.html')));
  app.use((error,req,res,next)=>res.status(error.status||400).json({error:error.shortMessage||error.message||'Request failed.'}));
  const server=await new Promise((resolve,reject)=>{const s=app.listen(port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
  return{app,server,port:server.address().port,async close(){await new Promise(resolve=>server.close(resolve));}};
}
