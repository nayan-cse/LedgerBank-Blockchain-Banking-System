import {parseEther,formatEther,sha256,toUtf8Bytes,hexlify,randomBytes,isAddress,getAddress} from 'ethers';
export const ZERO_HASH='0x'+'0'.repeat(64);
export const isHash=value=>typeof value==='string' && /^0x[0-9a-fA-F]{64}$/.test(value);
export const newRequestId=()=>hexlify(randomBytes(32));
export function amountWei(text){
  if(typeof text!=='string' || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(text.trim()))throw new Error('Enter a positive amount with up to 18 decimal places.');
  const amount=parseEther(text.trim());if(amount<=0n)throw new Error('Amount must be greater than zero.');return amount;
}
export const eth=wei=>formatEther(BigInt(wei));
export function walletAddress(value){if(!isAddress(value))throw new Error('Enter a valid wallet address.');return getAddress(value);}
export function memoHash(text){if(typeof text!=='string' || new TextEncoder().encode(text).length>240)throw new Error('Reference must be at most 240 UTF-8 bytes.');return text?sha256(toUtf8Bytes(text)):ZERO_HASH;}
export function customerCommitment(name,reference,salt){
  if(!name?.trim() || !reference?.trim() || name.length>120 || reference.length>80 || !isHash(salt))throw new Error('Enter a name and customer reference, with a random 32-byte salt.');
  return sha256(toUtf8Bytes(JSON.stringify(['LedgerBank customer v1',name.trim(),reference.trim(),salt])));
}
