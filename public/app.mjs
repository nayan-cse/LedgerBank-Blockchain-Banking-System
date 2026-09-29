import {JsonRpcProvider,BrowserProvider,Contract,ZeroAddress} from 'ethers';
import {amountWei,eth,walletAddress,newRequestId,memoHash,customerCommitment,ZERO_HASH} from '/lib/money.mjs';
const $=selector=>document.querySelector(selector);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let config,provider,signer,wallet='',account,dashboard,payment='deposit',busy=false,nextBefore=null,nextAccountOffset=null;
async function api(route,body){const response=await fetch(route,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(value.error||'Request failed.');return value;}
function notice(text,error=false){$('#notice').hidden=false;$('#notice').className=error?'error':'';$('#notice').textContent=text;}
async function run(action){if(busy)return;busy=true;const disabled=[...document.querySelectorAll('button,select')].map(n=>[n,n.disabled]);disabled.forEach(([n])=>n.disabled=true);try{await action();}catch(error){notice(error.reason||error.shortMessage||error.message,true);}finally{busy=false;disabled.forEach(([n,b])=>{if(n.isConnected)n.disabled=b;});}}
function contract(){if(!signer)throw new Error('Select a customer or connect a wallet first.');return new Contract(config.address,config.abi,signer);}
function saveJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const pendingKey=()=>`ledgerbank:${config.chainId}:${config.address}:${wallet.toLowerCase()}:pending`;
function pending(){try{return JSON.parse(localStorage.getItem(pendingKey())||'null');}catch{return null;}}
function displayPending(){const p=pending();$('#pending').hidden=!p;if(p)$('#pending-text').textContent=`${p.operation.toUpperCase()} ${eth(p.amountWei)} ETH · Request ${p.requestId}${p.transactionHash?' · Transaction '+p.transactionHash:''}`;}
function clearPending(){localStorage.removeItem(pendingKey());displayPending();}
function receiptNotice(hash,label='Transaction confirmed.'){const n=$('#notice');n.hidden=false;n.className='';n.replaceChildren(node('span',label+' '));const a=node('a','View receipt');a.href=`/receipt/${hash}`;n.append(a);}
async function checkPending(){const p=pending();if(!p)return false;const result=await api(`/api/requests/${wallet}/${p.requestId}`);if(result.executed){clearPending();await refresh();receiptNotice(result.transactionHash,'The original request has already completed.');return true;}notice('No successful execution found yet. If a transaction is pending, wait before retrying.');return false;}
async function execute(p){
  const c=contract();let tx;
  try{
    notice('Submitting request and waiting for its first mined confirmation…');
    if(p.operation==='deposit')tx=await c.deposit(p.requestId,p.memoHash,{value:BigInt(p.amountWei)});
    else if(p.operation==='withdraw')tx=await c.withdraw(BigInt(p.amountWei),p.requestId,p.memoHash);
    else tx=await c.transfer(p.recipient,BigInt(p.amountWei),p.requestId,p.memoHash);
    localStorage.setItem(pendingKey(),JSON.stringify({...p,transactionHash:tx.hash}));displayPending();
    const receipt=await tx.wait();if(receipt.status!==1)throw new Error('Transaction failed.');
    clearPending();await refresh();receiptNotice(receipt.hash);
  }catch(error){
    // A failure to return a hash may be a transport ambiguity. Keep the same request ID.
    // A mined failed receipt is definitive and rolls back all bank accounting.
    if(error.receipt?.status===0)clearPending();else displayPending();throw error;
  }
}
function renderHistory(target,history,append=false){
  if(!append)target.replaceChildren();if(!history.length&&!append){target.append(node('p','No confirmed transactions for this account.','empty'));return;}
  for(const item of history){
    const row=node('div',undefined,'history-row'),icon=node('span',item.operation==='DEPOSIT'?'↓':item.operation==='WITHDRAWAL'?'↑':'↔','operation-icon'),info=node('div');
    const outgoing=item.sender.toLowerCase()===wallet.toLowerCase(),party=outgoing?item.recipient:item.sender;
    info.append(node('strong',item.operation==='TRANSFER'?(outgoing?'Transfer sent':'Transfer received'):item.operation==='DEPOSIT'?'Deposit':'Withdrawal'),node('p',`#${item.sequence} · Block ${item.blockNumber} · ${party===ZeroAddress?'External wallet':party}`));
    const links=node('div',undefined,'history-links');const view=node('a','Receipt');view.href=`/receipt/${item.transactionHash}`;const download=node('a','JSON');download.href=`/api/receipts/${item.transactionHash}`;download.download=`receipt-${item.sequence}.json`;links.append(view,download);
    row.append(icon,info,node('div',`${outgoing?'−':'+'}${eth(item.amountWei)} ETH`,'history-amount'),links);target.append(row);
  }
}
async function history(append=false){const page=await api(`/api/history?address=${wallet}${append&&nextBefore?`&before=${nextBefore}`:''}`);renderHistory($('#history'),page.history,append);nextBefore=page.nextBefore;$('#more-history').hidden=!nextBefore;}
async function refresh(){
  [account,dashboard]=await Promise.all([api(`/api/account/${wallet}`),api('/api/dashboard')]);
  $('#bank-balance').textContent=eth(account.balanceWei)+' ETH';$('#wallet-balance').textContent=eth(account.externalWalletWei)+' ETH';
  $('#account-number').textContent=account.number!=='0'?`Account ${account.number} · ${wallet}`:'Register and create your bank account to begin.';
  $('#account-state').textContent=account.number==='0'?'Not opened':account.frozen?'Frozen':'Active';$('#balance-block').textContent=`Block ${account.blockNumber}`;
  $('#bank-status').textContent=dashboard.paused?'Bank paused':'Bank operating';$('#bank-status').className='badge '+(dashboard.paused?'bad':'good');
  $('#enroll-wallet').textContent=wallet;$('#enroll-state').textContent=account.identityCommitment===ZERO_HASH?'Not registered':account.number==='0'?'Registered; account not yet opened':`Account ${account.number} opened`;
  const recent=await api(`/api/history?address=${wallet}`);renderHistory($('#recent'),recent.history.slice(0,4));displayPending();
}
async function show(view){document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!==`view-${view}`);document.querySelectorAll('[data-view]').forEach(n=>{if(n.dataset.view===view)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});if(view==='history')await history();else if(view==='admin')await administration();else if(['overview','enroll'].includes(view))await refresh();}
async function administration(offset=0){
  const [d,page,audit]=await Promise.all([api('/api/dashboard'),api(`/api/accounts?offset=${offset}`),api('/api/audit')]);dashboard=d;
  const stats=$('#admin-stats');stats.replaceChildren();for(const [label,value] of [['Registered customers',d.customerCount],['Opened accounts',d.accountCount],['Banking transactions',d.transactionCount],['Vault backing',d.solvent?'Solvent':'Deficit']]){const s=node('div',undefined,'stat');s.append(node('strong',String(value)),node('span',label));stats.append(s);}
  $('#pause-state').textContent=`${d.paused?'Paused':'Operating'} · Vault ${eth(d.assetsWei)} ETH · Liabilities ${eth(d.liabilitiesWei)} ETH · Surplus ${eth(d.surplusWei)} ETH`;
  $('#pause-button').textContent=d.paused?'Resume banking operations':'Pause banking operations';$('#pause-button').hidden=wallet.toLowerCase()!==config.administrator.toLowerCase();
  const table=$('#accounts');table.replaceChildren();for(const a of page.accounts){const tr=node('tr');tr.append(node('td',a.number),node('td',a.address,'mono'),node('td',eth(a.balanceWei)),node('td',a.frozen?'Frozen':'Active'));const control=node('td');if(wallet.toLowerCase()===config.administrator.toLowerCase()){const button=node('button',a.frozen?'Unfreeze':'Freeze',a.frozen?'secondary':'danger');button.onclick=()=>run(async()=>{await mined(contract().setFrozen(a.address,!a.frozen));await administration(offset);});control.append(button);}else control.textContent='Administrator only';tr.append(control);table.append(tr);}
  if(!page.accounts.length){const tr=node('tr'),td=node('td','No accounts yet.');td.colSpan=5;tr.append(td);table.append(tr);}
  nextAccountOffset=page.nextOffset;$('#more-accounts').hidden=nextAccountOffset===null;
  const logs=$('#audit');logs.replaceChildren();for(const event of audit){const row=node('div',undefined,'audit-row');row.append(node('strong',`${event.name} · Block ${event.blockNumber}`),node('p',event.args.map(a=>`${a.name}: ${a.value}`).join(' | '),'mono'),node('p',event.transactionHash,'mono'));logs.append(row);}if(!audit.length)logs.append(node('p','No events yet.'));
}
async function mined(promise){notice('Waiting for blockchain confirmation…');const tx=await promise,receipt=await tx.wait();notice(`Confirmed in block ${receipt.blockNumber}; gas used ${receipt.gasUsed.toLocaleString()}.`);return receipt;}
function form(id,handler){$(id).onsubmit=event=>{event.preventDefault();run(handler);};}
form('#payment-form',async()=>{
  if(pending()){await checkPending();if(pending())throw new Error('Resolve the pending request before starting a different payment.');}
  const amount=amountWei($('#amount').value),recipient=payment==='transfer'?walletAddress($('#recipient').value.trim()):null;
  if(!window.confirm(`${payment.toUpperCase()} ${eth(amount)} test ETH${recipient?' to '+recipient:''}? Blockchain gas is paid separately.`))return;
  const request={operation:payment,amountWei:amount.toString(),recipient,requestId:newRequestId(),memoHash:memoHash($('#reference').value),createdAt:new Date().toISOString()};
  localStorage.setItem(pendingKey(),JSON.stringify(request));displayPending();await execute(request);
});
form('#register-form',async()=>{const name=$('#customer-name').value.trim(),reference=$('#customer-ref').value.trim(),salt=newRequestId(),commitment=customerCommitment(name,reference,salt);await mined(contract().registerCustomer(commitment));saveJSON({name,reference,salt,commitment,wallet,bank:config.address,chainId:config.chainId},'ledgerbank-customer-registration.json');await refresh();});
form('#verify-form',async()=>{const file=$('#receipt-file').files?.[0];if(!file||file.size>48*1024)throw new Error('Choose a receipt JSON smaller than 48 KiB.');let submitted;try{submitted=JSON.parse(await file.text());}catch{throw new Error('File is not valid JSON.');}const result=await api('/api/receipts/verify',submitted),target=$('#receipt-result');target.replaceChildren(node('span',result.status,'badge '+(result.valid?'good':'bad')),node('h2',result.valid?'Receipt verified':'Receipt not verified'),node('p',result.message));});
$('#open-account').onclick=()=>run(async()=>{await mined(contract().openAccount());await refresh();});
$('#check-pending').onclick=()=>run(checkPending);
$('#retry-pending').onclick=()=>run(async()=>{if(await checkPending())return;const p=pending();if(p&&window.confirm('Retry the identical request? A duplicate cannot debit the bank twice, but may still consume an extra gas fee.'))await execute(p);});
$('#dismiss-pending').onclick=()=>run(async()=>{if(await checkPending())return;if(window.confirm('Dismiss this local reminder? This does not cancel a submitted transaction. Check history before starting a replacement.'))clearPending();});
$('#refresh').onclick=()=>run(refresh);$('#all-history').onclick=()=>run(()=>show('history'));$('#refresh-history').onclick=()=>run(()=>history());$('#more-history').onclick=()=>run(()=>history(true));$('#refresh-admin').onclick=()=>run(()=>administration());$('#more-accounts').onclick=()=>run(()=>administration(nextAccountOffset));
$('#pause-button').onclick=()=>run(async()=>{await mined(contract().setPaused(!dashboard.paused));await administration();await refresh();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>run(()=>show(b.dataset.view)));
document.querySelectorAll('[data-payment]').forEach(b=>b.onclick=()=>{if(busy)return;payment=b.dataset.payment;document.querySelectorAll('[data-payment]').forEach(n=>{if(n===b)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});$('#recipient-field').hidden=payment!=='transfer';$('#recipient').required=payment==='transfer';$('#pay-button').textContent=({deposit:'Deposit test ETH',withdraw:'Withdraw test ETH',transfer:'Transfer test ETH'})[payment];$('#payment-help').textContent=({deposit:'From your external wallet into your bank account.',withdraw:'From your bank account back to your external wallet.',transfer:'Move bank balance to another active customer account.'})[payment];});
$('#wallet').onchange=()=>run(async()=>{wallet=$('#wallet').value;signer=await provider.getSigner(wallet);$('#account-label').textContent=config.accounts.find(a=>a.address.toLowerCase()===wallet.toLowerCase())?.label||'Connected wallet';await refresh();const current=$('[data-view][aria-current="page"]')?.dataset.view;if(current==='admin')await administration();if(current==='history')await history();});
$('#connect').onclick=()=>run(async()=>{if(!window.ethereum)throw new Error('No browser wallet found. The demo account selector works without one.');const external=new BrowserProvider(window.ethereum);await external.send('eth_requestAccounts',[]);if(Number((await external.getNetwork()).chainId)!==config.chainId)throw new Error(`Use chain ${config.chainId}, RPC ${config.rpcUrl}.`);signer=await external.getSigner();wallet=await signer.getAddress();$('#wallet').value='';$('#account-label').textContent='Connected wallet';await refresh();});
if(window.ethereum?.on){window.ethereum.on('accountsChanged',()=>{signer=null;notice('Wallet account changed. Reconnect before another transaction.');});window.ethereum.on('chainChanged',()=>{signer=null;notice('Wallet network changed. Reconnect before another transaction.');});}
run(async()=>{config=await api('/api/config');provider=new JsonRpcProvider(new URL('/rpc',location.origin).href,config.chainId,{staticNetwork:true,cacheTimeout:-1});provider.pollingInterval=100;for(const a of config.accounts){const option=node('option',a.label);option.value=a.address;$('#wallet').append(option);}wallet=config.accounts[1].address;$('#wallet').value=wallet;signer=await provider.getSigner(wallet);$('#account-label').textContent='Customer A';$('#recipient').value=config.accounts[2].address;$('#chain-label').textContent=`Chain ${config.chainId}`;$('#bank-address').textContent=config.address;await refresh();});
