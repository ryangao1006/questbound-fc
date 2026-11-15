export const MAX_SNAPSHOT_BYTES=24*1024*1024;
export function isSameOriginWrite(req:Request,origin:string){return new URL(req.url).origin===origin&&req.headers.get('origin')===origin;}
/** Bound input even when Content-Length is absent or dishonest. */
export async function boundedText(req:Request,limit=MAX_SNAPSHOT_BYTES){
 if(Number(req.headers.get('content-length'))>limit)throw Object.assign(new Error('Snapshot exceeds allowed size.'),{status:413});
 if(!req.body)return '';
 const reader=req.body.getReader(),decoder=new TextDecoder();let length=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Object.assign(new Error('Snapshot exceeds allowed size.'),{status:413})}text+=decoder.decode(value,{stream:true})}return text+decoder.decode()}finally{reader.releaseLock()}
}

/** Bind browser operations to the account whose local cache produced them. */
export function assertExpectedAccount(req:Request,accountId:string){
 const expected=req.headers.get('X-QFC-Account');
 if((req.method==='POST'&&expected!==accountId)||(expected&&expected!==accountId))throw Object.assign(new Error('The signed-in account changed in another tab. Reopen the correct local account before syncing.'),{status:403,code:'ACCOUNT_CHANGED'});
}
export function assertAccountPayload(expected:unknown,accountId:string){if(expected!==accountId)throw Object.assign(new Error('The signed-in account changed.'),{status:403,code:'ACCOUNT_CHANGED'});}
