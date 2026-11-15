/** A busy connection is waiting its turn, not a failed delivery. Keep the operation and payload intact. */
export function providerRetry(error:unknown,attempts:number,now=Date.now()){
 const message=error instanceof Error?error.message:'Connection unavailable';
 const busy=!!error&&typeof error==='object'&&'status' in error&&error.status===409&&message==='Todoist is syncing; this change is queued.';
 return busy?{status:'pending' as const,attempts,nextAttempt:new Date(now+2000).toISOString(),error:undefined}:{status:'error' as const,attempts:attempts+1,nextAttempt:new Date(now+Math.min(3600000,30000*2**(attempts+1))).toISOString(),error:message};
}
