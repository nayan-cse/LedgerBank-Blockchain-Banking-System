import {ZeroAddress} from 'ethers';
import {isHash} from './money.mjs';
const operationNames=['DEPOSIT','WITHDRAWAL','TRANSFER'];
export function bankEvent(log,contract){
  try{const event=contract.interface.parseLog(log);if(event?.name!=='BankTransaction')return null;
    const a=event.args;return{sequence:a.sequence.toString(),sender:a.sender,recipient:a.recipient,operation:operationNames[Number(a.operation)],amountWei:a.amount.toString(),senderBalanceAfterWei:a.senderBalanceAfter.toString(),recipientBalanceAfterWei:a.recipientBalanceAfter.toString(),requestId:a.requestId,memoHash:a.memoHash,transactionHash:log.transactionHash,blockNumber:log.blockNumber};
  }catch{return null;}
}
export async function buildReceipt(contract,config,transactionHash){
  if(!isHash(transactionHash))throw new Error('Invalid transaction hash.');
  const provider=contract.runner.provider;
  const [receipt,transaction]=await Promise.all([provider.getTransactionReceipt(transactionHash),provider.getTransaction(transactionHash)]);
  if(!receipt || !transaction)throw new Error('Transaction has not been mined or is unknown to this chain.');
  if(receipt.status!==1)throw new Error('The transaction failed; it is not a successful banking receipt.');
  // A smart-account transaction may target a forwarding contract. The bank's event
  // address is authoritative; an unrelated transaction cannot emit our bank's log.
  const events=receipt.logs.filter(l=>l.address.toLowerCase()===config.address.toLowerCase()).map(l=>bankEvent(l,contract)).filter(Boolean);
  if(events.length!==1)throw new Error('Expected one banking event in this transaction.');
  const block=await provider.getBlock(receipt.blockNumber);
  if(!block || block.hash!==receipt.blockHash)throw new Error('Receipt block changed; verify again after chain stabilization.');
  const event=events[0];
  return {schema:'LedgerBankReceipt/1',chainId:config.chainId,bank:config.address,transactionHash:receipt.hash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,status:'MINED',timestamp:block.timestamp,initiator:transaction.from,operation:event.operation,sequence:event.sequence,sender:event.sender,recipient:event.recipient,amountWei:event.amountWei,senderBalanceAfterWei:event.senderBalanceAfterWei,recipientBalanceAfterWei:event.recipientBalanceAfterWei,requestId:event.requestId,memoHash:event.memoHash,gasUsed:receipt.gasUsed.toString(),effectiveGasPriceWei:receipt.gasPrice.toString(),feeWei:receipt.fee.toString()};
}
function canonical(value){return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])));}
export async function verifyReceipt(contract,config,submitted){
  if(!submitted || typeof submitted!=='object' || Array.isArray(submitted) || submitted.schema!=='LedgerBankReceipt/1')return{valid:false,status:'INVALID_RECEIPT',message:'Unsupported receipt document.'};
  if(submitted.chainId!==config.chainId || submitted.bank!==config.address)return{valid:false,status:'WRONG_REGISTRY',message:'Receipt belongs to another chain or bank.'};
  try{
    const expected=await buildReceipt(contract,config,submitted.transactionHash);
    const valid=canonical(expected)===canonical(submitted);
    return {valid,status:valid?'VERIFIED':'ALTERED',message:valid?'Receipt exactly matches the mined transaction.':'Receipt fields do not match the blockchain.',transactionHash:expected.transactionHash};
  }catch(error){return{valid:false,status:'NOT_VERIFIABLE',message:error.message};}
}
export function externalParty(address){return address===ZeroAddress?'External wallet':address;}
