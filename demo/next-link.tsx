import type {AnchorHTMLAttributes,ReactNode} from 'react';
/** Minimal next/link replacement for the static demo bundle. */
export default function Link({href,children,...rest}:{href:string;children?:ReactNode}&AnchorHTMLAttributes<HTMLAnchorElement>){
 const target=href==='/club/base'?'#base':href==='/'?'#top':href;
 return <a href={target} {...rest}>{children}</a>;
}
