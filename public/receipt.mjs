import {eth} from '/lib/money.mjs';
import {ZeroAddress} from 'ethers';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
document.querySelector('#print').onclick=()=>window.print();
const target=document.querySelector('#receipt'),hash=location.pathname.split('/').pop();
try{
  const response=await fetch(`/api/receipts/${hash}`),r=await response.json();if(!response.ok)throw new Error(r.error);
  const title=el('div',undefined,'receipt-title');title.append(el('h1','LedgerBank'),el('span','MINED TRANSACTION','badge good'));target.replaceChildren(title,el('p',`Receipt #${r.sequence} · ${r.operation}`,'eyebrow'),el('div',`${eth(r.amountWei)} ETH`,'receipt-value'));
  const fields=el('dl',undefined,'receipt-fields');
  const values=[['Operation',r.operation],['Block time (UTC)',new Date(r.timestamp*1000).toISOString()],['Ledger sender',r.sender===ZeroAddress?'External wallet':r.sender],['Ledger recipient',r.recipient===ZeroAddress?'External wallet':r.recipient],['Initiating wallet',r.initiator],['Gas used',r.gasUsed],['Effective gas price',`${r.effectiveGasPriceWei} wei`],['Transaction fee',`${eth(r.feeWei)} ETH`],['Sender bank balance after',`${eth(r.senderBalanceAfterWei)} ETH`],['Recipient bank balance after',`${eth(r.recipientBalanceAfterWei)} ETH`],['Transaction hash',r.transactionHash],['Block hash',r.blockHash],['Bank contract',r.bank],['Chain / block',`${r.chainId} / ${r.blockNumber}`],['Request ID',r.requestId],['Reference hash',r.memoHash]];
  for(const [label,value] of values){const row=el('div',undefined,['Transaction hash','Block hash','Request ID','Reference hash'].includes(label)?'full':'');row.append(el('dt',label),el('dd',value,/hash|wallet|contract|sender|recipient|ID/i.test(label)?'mono':''));fields.append(row);}target.append(fields,el('p','Synthetic local ETH; not a fiat bank statement. External wallet parties have no bank balance in the event (shown as zero). Download JSON and use Verify a receipt to compare every field against the current trusted chain. Mined inclusion is not public-chain finality.','receipt-foot'));
  const link=document.querySelector('#download');link.href=`/api/receipts/${hash}`;link.download=`ledgerbank-receipt-${r.sequence}.json`;
}catch(error){target.replaceChildren(el('h2','Receipt unavailable'),el('p',error.message));document.querySelector('#print').disabled=true;document.querySelector('#download').hidden=true;}
