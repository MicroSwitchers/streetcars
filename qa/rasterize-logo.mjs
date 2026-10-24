// Rasterize the published vector crest for the shared game texture atlas.
// Keep the exact lettering and outline paths; only convert the ink to white.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
const qa=resolve('qa'),source=resolve('asset-source/source');
const profile=await mkdtemp(join(qa,'logo-render-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`
],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket;
try{
 let port;
 for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}
 if(!port)throw new Error('Chrome did not start');
 const page=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let id=0;const pending=new Map();
 socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params)=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
 const svg=(await readFile(join(source,'ttc-crest-reference.svg'),'utf8')).replaceAll('#da251d','#000');
 const expression=`(async()=>{
   const img=new Image();img.src='data:image/svg+xml;base64,'+${JSON.stringify(Buffer.from(svg).toString('base64'))};await img.decode();
   const canvas=document.createElement('canvas');canvas.width=2056;canvas.height=806;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=alpha;}
   ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1];
 })()`;
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
 await writeFile(join(source,'ttc-crest-white.png'),Buffer.from(result.result.value,'base64'));
 console.log('Vector TTC crest rasterized with transparent background');
}finally{
 if(socket)socket.close();browser.kill();await delay(500);
 if(!relative(qa,resolve(profile)).startsWith('..'))await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
