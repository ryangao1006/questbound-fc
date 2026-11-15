"use client";
import {useRef,useEffect,useState,type ReactNode} from "react";
import {createPortal} from 'react-dom';
import {X} from "lucide-react";
import {useLocale} from "./locale";
import {THEMES,THEME_LABELS} from "@/lib/avatar";
export function Modal({ title, onClose, children, wide = false, className = "", onEscape, canClose }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
    className?: string;
    onEscape?: () => void;
    canClose?: () => boolean;
}) {
    const { t: tx, language, theme, onDisplayChange } = useLocale();
    const ref = useRef<HTMLDivElement>(null);
    const previousFocus=useRef<HTMLElement|null>(null);
    if(!previousFocus.current&&typeof document!=='undefined')previousFocus.current=document.activeElement as HTMLElement;
    const closeRef = useRef(onClose);
    const escapeRef=useRef(onEscape);escapeRef.current=onEscape;
    const canCloseRef=useRef(canClose);canCloseRef.current=canClose;
    const [closing,setClosing]=useState(false);
    const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
    const requestClose=()=>{
        if(timer.current)return;
        if(canCloseRef.current&&!canCloseRef.current())return;
        if(document.documentElement.dataset.motion==='reduce'||window.matchMedia('(prefers-reduced-motion: reduce)').matches){closeRef.current();return;}
        setClosing(true);
        timer.current=setTimeout(()=>closeRef.current(),160);
    };
    const dismiss=useRef(requestClose);dismiss.current=requestClose;
    useEffect(()=>{closeRef.current=onClose},[onClose]);
    useEffect(() => {
        const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
        const background=document.querySelector<HTMLElement>('.football-app'),wasInert=background?.inert;if(background)background.inert=true;
        const first = ref.current?.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled])')||ref.current?.querySelector<HTMLElement>('button:not([disabled]),select:not([disabled])');
        first?.focus();
        const onKey = (e: KeyboardEvent) => {
            if(e.defaultPrevented)return;
            if (e.key === "Escape" && !Array.from(ref.current?.querySelectorAll('[data-escape-layer]')||[]).some(el=>el.getClientRects().length>0)) {
                e.preventDefault();
                if(escapeRef.current)escapeRef.current();else dismiss.current();
            }
            if (e.key === "Tab") {
                const candidates = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary');
                const nodes = Array.from(candidates || []).filter(el => el.getClientRects().length > 0);
                if (!nodes.length)
                    return;
                const a = nodes[0], b = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === a) {
                    e.preventDefault();
                    b.focus();
                }
                else if (!e.shiftKey && document.activeElement === b) {
                    e.preventDefault();
                    a.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => { if(timer.current)clearTimeout(timer.current);document.removeEventListener("keydown", onKey);document.body.style.overflow=overflow;if(background)background.inert=!!wasInert;if(previousFocus.current?.isConnected)previousFocus.current.focus({preventScroll:true}); };
    }, []);
    if(typeof document==='undefined')return null;
    return createPortal(<div className="football-overlays" data-theme={theme}><div className="modal-backdrop" data-closing={closing} onMouseDown={e => {
            if (e.target === e.currentTarget)
                requestClose();
        }}><div ref={ref} className={`modal ${wide ? "wide" : ""} ${className}`} role="dialog" aria-modal="true" aria-label={title} inert={closing}><div className="modal-heading"><h2>{title}</h2>{onDisplayChange && <div className="dialog-display-controls"><select aria-label={tx("Language")} value={language} onChange={e => onDisplayChange({ language: e.target.value as "en" | "zh" })}><option value="en">EN</option><option value="zh">中文</option></select><select aria-label={tx("Choose theme")} value={theme} onChange={e => onDisplayChange({ theme: e.target.value as typeof theme })}>{THEMES.map(item => <option key={item} value={item}>{tx(THEME_LABELS[item])}</option>)}</select></div>}<button className="icon-button" onClick={requestClose} aria-label={tx("Close dialog")}><X size={20}/></button></div>{children}</div></div></div>,document.body);
}
