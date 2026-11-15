import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/fc-themes.css',import.meta.url),'utf8');
function tokens(selector:string){const i=css.indexOf(selector+'{');assert.ok(i>=0);return Object.fromEntries([...css.slice(i,css.indexOf('}',i)).matchAll(/--([a-z-]+):([^;]+)/g)].map(m=>[m[1],m[2]]));}
function light(hex:string){const rgb=hex.trim().slice(1).match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function ratio(a:string,b:string){const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const theme of ['night-stadium','classic-career'])test(`${theme}: body, muted text, accent links and selection labels retain readable contrast`,()=>{
 const p=tokens(`.football-app.comic-ui[data-theme="${theme}"]`);
 for(const bg of ['surface','surface-high'])for(const fg of ['text','muted','accent'])assert.ok(ratio(p[fg],p[bg])>=4.5,`${fg} / ${bg}`);
 assert.ok(ratio(p['selection-ink'],p.selection)>=4.5);
});
