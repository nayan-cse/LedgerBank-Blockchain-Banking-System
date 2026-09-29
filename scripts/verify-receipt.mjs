import fs from 'node:fs';
import {Contract,JsonRpcProvider,getAddress} from 'ethers';
import {verifyReceipt} from '../lib/receipts.mjs';
const args=process.argv.slice(2),file=args[0],options={};if(!file||file.startsWith('--'))throw new Error('Usage: npm run verify-receipt -- receipt.json [--rpc URL --bank ADDRESS --chain ID]');
for(let i=1;i<args.length;i+=2){if(!['--rpc','--bank','--chain'].includes(args[i])||!args[i+1])throw new Error('Unknown or incomplete option.');options[args[i]]=args[i+1];}
let config;if(options['--bank']&&options['--chain'])config={address:getAddress(options['--bank']),chainId:Number(options['--chain'])};else{if(options['--bank']||options['--chain'])throw new Error('Provide --bank and --chain together.');config=JSON.parse(fs.readFileSync(`${process.env.DATA_DIR||'data'}/deployment.json`,'utf8'));}
const provider=new JsonRpcProvider(options['--rpc']||'http://127.0.0.1:8545');
try{if(Number((await provider.getNetwork()).chainId)!==config.chainId)throw new Error('RPC chain does not match the trusted configuration.');const artifact=JSON.parse(fs.readFileSync(new URL('../artifacts/LedgerBank.json',import.meta.url),'utf8')),result=await verifyReceipt(new Contract(config.address,artifact.abi,provider),config,JSON.parse(fs.readFileSync(file,'utf8')));console.log(JSON.stringify(result,null,2));process.exitCode=result.valid?0:2;}finally{provider.destroy();}
