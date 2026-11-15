import {AsyncLocalStorage} from 'node:async_hooks';
const jobs=new AsyncLocalStorage<Pick<ExecutionContext,'waitUntil'>>();
export function withProviderJobs<T>(ctx:Pick<ExecutionContext,'waitUntil'>,run:()=>T):T{return jobs.run(ctx,run)}
export function backgroundProviderJob(work:Promise<unknown>){const safe=work.catch(()=>{});jobs.getStore()?.waitUntil(safe);}
