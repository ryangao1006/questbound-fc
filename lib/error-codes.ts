// English error text remains compatible; consumers can use this stable code/key pair.
export function errorCode(message:string,status=400){
 if(status===401)return 'SIGN_IN_REQUIRED';
 if(status===403)return 'ACTION_FORBIDDEN';
 if(status===409)return 'STATE_CONFLICT';
 if(message.includes('appearance')||message.includes('avatar')||message.includes('skin tone')||message.includes('kit design'))return 'APPEARANCE_INVALID';
 if(message.includes('theme'))return 'THEME_INVALID';
 if(message.includes('Backup integrity'))return 'BACKUP_INTEGRITY_FAILED';
 if(message.includes('newer version'))return 'UPDATE_REQUIRED';
 // Deterministic fallback avoids unstable ordinal or runtime-dependent codes.
 let h=2166136261;for(let i=0;i<message.length;i++)h=Math.imul(h^message.charCodeAt(i),16777619);
 return `QF_${(h>>>0).toString(16).padStart(8,'0').toUpperCase()}`;
}
