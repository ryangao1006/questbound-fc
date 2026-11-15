// Questbound FC service worker.
// Privacy rule: private pages and API responses are never placed in an HTTP cache.
// When a navigation fails, this worker answers with a self-contained offline page that
// reads the device's own IndexedDB copy; nothing private leaves the device.
const SHELL = 'qfc-shell-v2';
const OFFLINE = '/offline';
const ASSET = /^\/(_next|@vite|@fs|@id|assets|graphics|downloads)\//;
const COPY = {
  en: { title: 'Offline copy of your planner', lead: 'This page is served by this device only. It reads the private snapshot kept in IndexedDB and never uploads or exposes it.', empty: 'No offline copy yet. Reconnect once so this device can keep one.', waiting: 'change(s) saved on this device and waiting to reach the site.', none: 'No changes are waiting.', next: 'Next up', nothing: 'No open tasks in the saved copy.', open: 'Open the planner', retry: 'Try the planner again', back: 'Connection is back', offline: 'Working offline', saved: 'Last saved from the site', copied: 'copied', done: 'Done', queued: 'Saved on this device. It reaches the site when the connection returns.', reload: 'Reloading when the connection returns…' },
  zh: { title: '你规划器的离线副本', lead: '此页面只由本设备提供，读取保存在 IndexedDB 中的私人快照，不会上传或对外暴露。', empty: '本机还没有离线副本。联网一次即可生成。', waiting: '项修改已保存在本机，等待发送到站点。', none: '没有待发送的修改。', next: '接下来', nothing: '副本里没有未完成任务。', open: '打开规划器', retry: '再试一次打开规划器', back: '连接已恢复', offline: '离线状态', saved: '站点最近保存', copied: '复制于', done: '完成', queued: '已保存在本机，连接恢复后会发送到站点。', reload: '连接恢复后会自动重新加载…' }
};
function offlineDocument() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline copy · Questbound FC</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#0b1523;color:#e8eef7;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:28px 18px 48px}h1{font-size:24px;margin:6px 0 10px}h2{font-size:16px;margin:0 0 8px}p{margin:0 0 8px;font-size:13px}
.eyebrow{font-size:11px;letter-spacing:.18em;color:#8fa6c6}.muted{color:#9fb0c6}
.card{border:1px solid #243449;border-radius:14px;padding:16px;margin:14px 0;background:#101a29}
button{font:inherit;border-radius:10px;padding:8px 12px;border:1px solid #2b3a4d;background:#182741;color:#e8eef7;margin-right:8px;cursor:pointer}
button.primary{background:#c8f56e;color:#12200a;border-color:#c8f56e;font-weight:700}
ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1d2b3d;font-size:13px}
li span{flex:1}li small{color:#9fb0c6;white-space:nowrap}
.note{color:#c8f56e;font-size:12px;margin:6px 0 0}
</style></head><body><main><span class="eyebrow">QUESTBOUND FC</span><h1 id="title">Reading this device’s copy…</h1><p class="muted" id="lead"></p><div id="app"></div></main>
<script>
(async function(){
 const COPY=${JSON.stringify(COPY)};
 var db=null,tasks=[],queue=[],language='en',copy=COPY.en,snapshot=null;
 function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(character){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]})}
 function read(store,key){return new Promise(function(resolve){try{var request=key?db.transaction(store,'readonly').objectStore(store).get(key):db.transaction(store,'readonly').objectStore(store).getAll();request.onsuccess=function(){resolve(request.result)};request.onerror=function(){resolve(key?null:[])}}catch{resolve(key?null:[])}})}
 function render(){
  var app=document.getElementById('app');
  document.getElementById('title').textContent=copy.title;document.getElementById('lead').textContent=copy.lead;
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
  if(!snapshot){app.innerHTML='<div class="card"><p>'+copy.empty+'</p><button class="primary" data-reconnect>'+copy.open+'</button></div>';return}
  var subjects=snapshot.state.subjects||[];
  var rows=tasks.slice(0,8).map(function(task){return '<li><span>'+escapeHtml(task.title)+'</span><small>'+escapeHtml((subjects.find(function(item){return item.id===task.subjectId})||{}).title||'')+'</small><button data-task="'+escapeHtml(task.id)+'">'+copy.done+'</button></li>'}).join('');
  app.innerHTML='<div class="card"><h2>'+(navigator.onLine?copy.back:copy.offline)+'</h2>'+
   '<p class="muted">'+copy.saved+': '+new Date(snapshot.updatedAt).toLocaleString()+' · revision '+snapshot.revision+' · '+copy.copied+' '+new Date(snapshot.cachedAt).toLocaleString()+'</p>'+
   '<p>'+(queue.length?queue.length+' '+copy.waiting:copy.none)+'</p>'+
   '<button class="primary" data-reconnect>'+(navigator.onLine?copy.open:copy.retry)+'</button></div>'+
   '<div class="card"><h2>'+copy.next+'</h2>'+(rows?'<ul>'+rows+'</ul>':'<p class="muted">'+copy.nothing+'</p>')+(queue.length?'<p class="note">'+copy.queued+'</p>':'')+'</div>';
  Array.prototype.forEach.call(app.querySelectorAll('button[data-task]'),function(button){button.addEventListener('click',function(){void complete(button.getAttribute('data-task'),button)})});
  Array.prototype.forEach.call(app.querySelectorAll('button[data-reconnect]'),function(button){button.addEventListener('click',function(){location.assign('/')})});
 }
 async function complete(taskId,button){
  button.disabled=true;
  var entry={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)),command:{type:'task.toggle',id:taskId,done:true},at:new Date().toISOString()};
  await new Promise(function(resolve,reject){try{var tx=db.transaction('queue','readwrite');tx.objectStore('queue').put(entry);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)}}catch(error){reject(error)}}).catch(function(){button.disabled=false});
  tasks=tasks.filter(function(task){return task.id!==taskId});
  queue=await read('queue');render();
 }
 try{
  db=await new Promise(function(resolve,reject){var request=indexedDB.open('questbound-site',1);request.onsuccess=function(){resolve(request.result)};request.onerror=function(){reject(request.error)}});
  snapshot=await read('snapshot','latest');queue=(await read('queue')).sort(function(a,b){return a.at.localeCompare(b.at)});
  language=snapshot&&snapshot.state&&snapshot.state.settings&&snapshot.state.settings.language==='zh'?'zh':'en';copy=COPY[language];
  tasks=snapshot?(snapshot.state.tasks||[]).filter(function(task){return !task.deletedAt&&!task.done}):[];
  render();
  window.addEventListener('online',function(){var note=document.createElement('p');note.textContent=copy.reload;document.body.prepend(note);setTimeout(function(){location.assign('/')},1200)});
 }catch(error){document.getElementById('app').textContent='This device could not read its offline copy: '+error}
})();
</script></body></html>`;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      const response = await fetch(OFFLINE, { cache: 'reload', credentials: 'same-origin' });
      if (response.ok) {
        const copy = response.clone();
        await cache.put(OFFLINE, response);
        const html = await copy.text();
        const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
          .map(match => match[1])
          .filter(url => url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/api/'));
        await Promise.all(urls.map(async url => {
          try {
            const asset = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
            if (asset.ok && typeMatches(new Request(url), new URL(url, self.location.origin), asset)) await cache.put(url, asset);
          } catch { /* the inline offline page does not depend on these */ }
        }));
      }
    } catch { /* first install without a network still enables push and notifications */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== SHELL).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function expectedType(request, url) {
  if (request.destination === 'style' || url.pathname.endsWith('.css')) return 'text/css';
  if (request.destination === 'script' || /\.(m?js|jsx|tsx|ts)$/.test(url.pathname)) return 'javascript';
  if (request.destination === 'font' || /\.(woff2?|ttf|otf)$/.test(url.pathname)) return 'font';
  return '';
}
function typeMatches(request, url, response) {
  const want = expectedType(request, url);
  if (!want) return true;
  const got = (response.headers.get('content-type') || '').toLowerCase();
  return got.includes(want);
}
function cacheable(request, url) {
  if (ASSET.test(url.pathname)) return true;
  return ['script', 'style', 'font', 'image', 'worker'].includes(request.destination);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;            // never cached
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return new Response(offlineDocument(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    })());
    return;
  }
  if (!cacheable(request, url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(request);
    const update = fetch(request).then(response => {
      if (response.ok && typeMatches(request, url, response)) cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || (await update) || Response.error();
  })());
});

// Private pages and API responses are never placed in a shared offline cache.
self.addEventListener('push',event=>{event.waitUntil((async()=>{let data;try{data=event.data.json();}catch{data={title:'Your coach is calling',body:'A little reminder is waiting.'};}let url='/';try{const target=new URL(data.url||'/',self.location.origin);if(target.origin===self.location.origin)url=target.pathname+target.search;}catch{}await self.registration.showNotification(data.title||'Questbound FC',{body:data.body||'Your next quest is ready.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'quest-island',renotify:false,data:{url}});})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=new URL(event.notification.data?.url||'/',self.location.origin).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}}return self.clients.openWindow(target);})());});
