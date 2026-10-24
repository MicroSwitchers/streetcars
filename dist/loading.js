import {GLTFLoader} from 'gltf-loader';

export async function loadStreetcar(){
 const loader=new GLTFLoader(),embedded=document.getElementById('embedded-car');
 if(embedded)return loader.parseAsync(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)).buffer,'');
 return loader.loadAsync(new URL('./ttc-clrv.glb',import.meta.url).href);
}
export async function yieldToBrowser(){await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));}
