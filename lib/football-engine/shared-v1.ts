import type {FootballRosterPlayer} from '../football-data.ts';
export function seedHash(text:string){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0}
export function playerGameAttributes(p:FootballRosterPlayer){return {...p.attributes,diving:p.goalkeeper?.diving||10,handling:p.goalkeeper?.handling||10,kicking:p.goalkeeper?.kicking||p.attributes.pas,reflexes:p.goalkeeper?.reflexes||10,speed:p.goalkeeper?.speed||p.attributes.pac,positioning:p.goalkeeper?.positioning||10}}
