/* Offline cache for the static demo: precache the shell and its assets from index.html. */
const CACHE='qfc-demo-v2';
async function precache(){
 const cache=await caches.open(CACHE);
 const response=await fetch('./index.html',{cache:'no-store'});
 if(!response.ok)return;
 const html=await response.text();
 await cache.put('./index.html',new Response(html,{headers:{'content-type':'text/html'}}));
 const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(url=>url.startsWith('./')||url.startsWith('/'));
 await Promise.all(urls.map(url=>cache.add(url).catch(()=>{})));
}
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(precache().catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const fresh=await fetch(request);
   if(fresh.ok)cache.put(request,fresh.clone());
   return fresh;
  }catch{
   const cached=await cache.match(request,{ignoreSearch:true});
   if(cached)return cached;
   if(request.mode==='navigate'){const shell=await cache.match('./index.html',{ignoreSearch:true});if(shell)return shell;}
   return new Response('Offline',{status:503,headers:{'content-type':'text/plain'}});
  }
 })());
});
