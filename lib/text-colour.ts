export function colourLuminance(hex:string){let s=hex.replace('#','');if(s.length===3)s=s.split('').map(c=>c+c).join('');if(!/^[0-9a-f]{6}$/i.test(s))return 0;const c=[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
export function colourContrast(a:string,b:string){const x=colourLuminance(a),y=colourLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
/** Team kit colours are identity colours, not automatically accessible text pairs. */
export function readableClubInk(background:string,preferred?:string){if(preferred&&colourContrast(background,preferred)>=4.5)return preferred;return colourContrast(background,'#ffffff')>=colourContrast(background,'#000000')?'#ffffff':'#000000'}
