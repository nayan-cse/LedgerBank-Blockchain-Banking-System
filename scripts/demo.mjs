import fs from 'node:fs';
import {JsonRpcProvider,Contract,parseEther} from 'ethers';
import {newRequestId,customerCommitment,ZERO_HASH} from '../lib/money.mjs';
const base=process.env.APP_URL||'http://localhost:3000';
async function api(route,body){const response=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
const config=await api('/api/config'),provider=new JsonRpcProvider(base+'/rpc',config.chainId,{staticNetwork:true,cacheTimeout:-1});provider.pollingInterval=100;
try{
  const bank=new Contract(config.address,config.abi,provider),d=await api('/api/dashboard');if(d.paused)throw new Error('Resume the bank in Administration before running the demo.');
  const people=await Promise.all([1,2].map(async i=>{const signer=await provider.getSigner(config.accounts[i].address),address=await signer.getAddress();if(await bank.customers(address)===ZERO_HASH)await(await bank.connect(signer).registerCustomer(customerCommitment(i===1?'Alex Morgan':'Jamie Lee',`DEMO-${i}`,newRequestId()))).wait();if((await bank.accounts(address)).number===0n)await(await bank.connect(signer).openAccount()).wait();if((await bank.accounts(address)).frozen)throw new Error('Unfreeze the demo customer accounts before running the demo.');return{signer,address};}));
  const c=bank.connect(people[0].signer);const receipts=[];
  for(const [kind,send] of [['deposit',()=>c.deposit(newRequestId(),ZERO_HASH,{value:parseEther('1')})],['transfer',()=>c.transfer(people[1].address,parseEther('.25'),newRequestId(),ZERO_HASH)],['withdrawal',()=>c.withdraw(parseEther('.10'),newRequestId(),ZERO_HASH)]]){
    const receipt=await(await send()).wait(),document=await api(`/api/receipts/${receipt.hash}`);receipts.push({kind,document});console.log(`${kind}: ${receipt.hash}`);
  }
  const folder=process.env.DEMO_OUTPUT||'data/demo';fs.mkdirSync(folder,{recursive:true});
  for(const {kind,document} of receipts)fs.writeFileSync(`${folder}/receipt-${kind}.json`,JSON.stringify(document,null,2));
  const original=receipts[1].document;fs.writeFileSync(`${folder}/receipt-tampered.json`,JSON.stringify({...original,amountWei:'999000000000000000000'},null,2));
  console.log('Live synthetic deposit, transfer and withdrawal completed.');console.log(`Receipts saved to ${folder}.`);console.log('Verify receipt-transfer.json and receipt-tampered.json in the app to compare the results.');
}finally{provider.destroy();}
