import os from 'node:os';
export function snapshot(){
  let rss,rssKind='current';
  try{rss=process.memoryUsage().rss;}catch{rss=process.resourceUsage().maxRSS*1024;rssKind='process-lifetime peak';}
  return{cpu:process.cpuUsage(),rssBytes:rss,rssKind,processPeakRssBytes:process.resourceUsage().maxRSS*1024};
}
export function monitorResources(){
  const start=snapshot(),started=performance.now(),samples=[{elapsedMs:0,rssBytes:start.rssBytes,rssKind:start.rssKind}];
  const timer=setInterval(()=>{const s=snapshot();samples.push({elapsedMs:performance.now()-started,rssBytes:s.rssBytes,rssKind:s.rssKind});},50);
  return()=>{clearInterval(timer);const end=snapshot(),elapsedMs=performance.now()-started;const userMs=(end.cpu.user-start.cpu.user)/1000,systemMs=(end.cpu.system-start.cpu.system)/1000;
    samples.push({elapsedMs,rssBytes:end.rssBytes,rssKind:end.rssKind});
    return{scope:'One isolated Node worker: Ganache EVM, RPC client and load driver; HTTP server also included in workflow mode. Excludes browser and parent orchestrator.',elapsedMs,cpuUserMs:userMs,cpuSystemMs:systemMs,cpuTotalMs:userMs+systemMs,cpuPercentOneCore:(userMs+systemMs)/elapsedMs*100,cpuPercentAllLogicalCpus:(userMs+systemMs)/elapsedMs*100/os.cpus().length,logicalCpus:os.cpus().length,startRssMiB:start.rssBytes/2**20,endRssMiB:end.rssBytes/2**20,sampledPeakRssMiB:Math.max(...samples.map(s=>s.rssBytes))/2**20,rssKind:samples.every(s=>s.rssKind==='current')?'current RSS sampled every 50 ms':'process-lifetime peak fallback',processPeakRssMiB:end.processPeakRssBytes/2**20,samples};
  };
}
