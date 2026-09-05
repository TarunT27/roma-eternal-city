import React from 'react';
import {Coins, Users, Wheat, Smile, Check, X, Landmark, Home, Sprout, Store, Waves, Pause, Play, Plus, Minus, Navigation, Footprints, RotateCcw} from 'lucide-react';
import {BUILDINGS,getStats} from './game.js';
import buildingArt from './assets/buildings.png';

function useDialogFocus(onClose) {
  const dialogRef = React.useRef(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const backdrop = dialog.parentElement;
    const background = [...backdrop.parentElement.children].filter(element => element !== backdrop);
    const previousInert = background.map(element => element.hasAttribute('inert'));
    background.forEach(element => element.setAttribute('inert', ''));
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] || dialog).focus();
    focusFirst();
    const keydown = event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const focusin = event => { if (!dialog.contains(event.target)) focusFirst(); };
    dialog.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      dialog.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      background.forEach((element, index) => { if (!previousInert[index]) element.removeAttribute('inert'); });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return dialogRef;
}

export function Laurel({className=''}){const leaves=[[19,9,15],[14,17,-5],[11,25,-20],[12,34,-35],[15,42,-55],[21,49,-70],[27,54,-85]];return <svg className={className} viewBox="0 0 60 62" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.1"><path d="M28 56C6 45 5 24 21 4M32 56C54 45 55 24 39 4M19 59L37 52M41 59L23 52"/>{[false,true].map(mirror=><g key={String(mirror)} transform={mirror?'translate(60 0) scale(-1 1)':undefined}>{leaves.map(([x,y,a],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${a})`}><path d="M0 0Q-8-1-7-9Q0-7 0 0ZM0 0Q5-5 3-11Q-2-7 0 0Z" fill="currentColor" strokeWidth=".4"/></g>)}</g>)}</g></svg>}

export function ResourceBar({state}){const stats=getStats(state);const resources=[{Icon:Coins,value:Math.floor(state.coins).toLocaleString(),label:'Denarii',tip:`Treasury · +${stats.coinRate.toFixed(1)} denarii / second`},{Icon:Users,value:Math.floor(state.population).toLocaleString(),label:'Citizens',tip:`Citizens · room for ${stats.capacity}`},{Icon:Wheat,value:Math.floor(state.food).toLocaleString(),label:'Grain',tip:`Grain · ${stats.foodRate>=0?'+':''}${stats.foodRate.toFixed(1)} / second`},{Icon:Smile,value:Math.round(state.happiness)+'%',label:'Happiness',tip:'City happiness · build baths or temples to improve it'}];return <div className="resources panel" aria-label="City resources">{resources.map(({Icon,value,label,tip})=><div className="resource" key={label} title={tip} tabIndex="0" aria-label={`${label}: ${value}`}><Icon size={23}/><div><span className="resource-value">{value}</span><span className="resource-label">{label}</span></div></div>)}</div>}

export function Objectives({state,expanded,onToggle}){const goals=[{label:'Build 3 new buildings',value:state.buildings.length,total:3},{label:'Reach 400 citizens',value:Math.floor(state.population),total:400},{label:'Raise happiness to 80%',value:state.happiness,total:80}];return <section className={`objectives panel ${expanded?'expanded':''}`}><button className="objective-heading" onClick={onToggle} aria-expanded={expanded}><h1>A city worthy of an empire</h1><span className="collapse-indicator">{expanded?'−':'+'}</span></button><div className="objective-content"><p>Grow your settlement into a thriving Roman city.</p><div className="goal-list">{goals.map(g=><div className="goal" key={g.label}><div className="goal-title"><span>{g.label}</span><span>{g.value>=g.total?<Check size={15} aria-label="Completed"/>:<>{Math.floor(g.value)}/{g.total}</>}</span></div><div className="goal-track"><span style={{width:Math.min(g.value/g.total*100,100)+'%'}}/></div></div>)}</div><div className="reward"><span>{state.rewardClaimed?'REWARDED':'REWARDS'}</span><span><Coins size={18}/>500</span><span title={`Total glory: ${state.glory ?? 0}`} aria-label={state.rewardClaimed?`${state.glory ?? 10} glory earned`:'10 glory reward'}><Laurel/>+10</span></div></div></section>}

export function BuildDock({state,selected,onSelect,mode}){const picked=BUILDINGS.find(b=>b.id===selected);return <section className={`build-dock panel ${mode==='walk'?'walk-hidden':''}`} aria-label="Construction menu"><div className="dock-title"><span/>{picked?'PLACE '+picked.name.toUpperCase():'BUILD YOUR CITY'}<span/></div><div className="build-options">{BUILDINGS.map((b,i)=><button key={b.id} className={`build-option ${selected===b.id?'selected':''} ${state.coins<b.cost?'unaffordable':''}`} onClick={()=>onSelect(selected===b.id?null:b.id)} aria-pressed={selected===b.id} title={`${b.name} · ${b.cost} denarii · ${b.benefit || b.description}`}><span className="building-name">{b.name}</span><span className="building-art" style={{backgroundImage:`url(${buildingArt})`,backgroundPosition:`${i*25}% 50%`}}/><span className="building-price"><Coins size={15}/>{b.cost}</span><span className="building-key">{i+1}</span></button>)}</div><div className="dock-hint">{picked?<><span>{picked.benefit || picked.description}</span><kbd>Esc</kbd><span>cancel</span></>:<><span className="desktop-hint">Drag to orbit · Scroll to zoom · </span><span>Select a building to place</span></>}</div></section>}

export function TimeControls({state,onPause,onSpeed}){const seasons=['SPRING','SUMMER','AUTUMN','WINTER'];const season=Math.floor(state.elapsed/120);return <div className="time-controls panel"><div className="season">{seasons[season%4]} <span>·</span> {125+Math.floor(season/4)} AD</div><div className="speed-buttons"><button onClick={onPause} aria-label={state.paused?'Resume simulation':'Pause simulation'} title="Space to pause">{state.paused?<Play size={17}/>:<Pause size={17}/>}</button>{[1,2,3].map(n=><button key={n} className={!state.paused&&state.speed===n?'active':''} onClick={()=>onSpeed(n)} aria-label={`Game speed ${n}x`} aria-pressed={!state.paused&&state.speed===n}>{n}x</button>)}</div></div>}

export function MiniMap({state,onHome,mapData}){return <button className="minimap panel" onClick={onHome} title="Return to the city overview" aria-label="Reset camera to city overview"><svg viewBox="0 0 180 160"><rect width="180" height="160" fill="#565e3a"/><path d="M20 -8Q13 30 30 61T30 112T48 172" fill="none" stroke="#387b7b" strokeWidth="16"/><g stroke="#b1a484" opacity=".65" strokeWidth="1.5">{[40,56,72,88,104,120,136,152,168].map((x,i)=><React.Fragment key={x}><path d={`M${x} 10V153`}/><path d={`M34 ${16+i*16}H176`}/></React.Fragment>)}</g><g fill="#c3a175">{(mapData?.plots||[]).filter(p=>p.occupied||p.scenic).map((p,i)=><rect key={i} x={92+p.x*1.7} y={80+p.z*1.7} width="7" height="7"/>)}{state.buildings.map(p=><rect key={p.id} x={92+p.x*1.7-3} y={80+p.z*1.7-3} width="7" height="7" fill="#f2cc7e"/>)}</g><ellipse cx="111" cy="45" rx="18" ry="13" fill="#bdb297" stroke="#e9ddbd" strokeWidth="2"/><ellipse cx="111" cy="45" rx="12" ry="7" fill="#697049"/><rect x="70" y="80" width="12" height="8" fill="#e4d7b5"/><path d="M56 148L55 30L143 21L167 130Z" fill="none" stroke="#e8dbad" opacity=".7"/><circle cx="98" cy="97" r="8" fill="#263024" stroke="#d5bd7b"/><path d="M94 98h8m-7-4h6m-5 1v3m4-3v3" stroke="#eeddb1"/></svg><span>ROMA</span></button>}

export function CameraControls({onZoom,onHome,mode,onMode}){return <div className="camera-controls"><button className={`explore-button panel ${mode==='walk'?'active':''}`} onClick={()=>onMode(mode==='walk'?'orbit':'walk')} title={mode==='walk'?'Return to overview':'Explore the city on foot'}><Footprints size={17}/><span>{mode==='walk'?'City view':'Explore'}</span></button><div className="camera-row"><button className="circle" aria-label="Zoom in" onClick={()=>onZoom(1)}><Plus/></button><button className="circle" aria-label="Zoom out" onClick={()=>onZoom(-1)}><Minus/></button><button className="compass circle" aria-label="Reset camera" onClick={onHome}><span>N</span><Navigation size={32} fill="currentColor"/></button></div></div>}

export function Inspector({info,onClose}){if(!info)return null;return <aside className="inspector panel"><button className="close-button" onClick={onClose} aria-label="Close building details"><X size={18}/></button><Landmark size={25}/><h2>{info.name}</h2><p>{info.description}</p><span className="inspector-note">A living piece of your Roman city</span></aside>}

export function Settings({onClose,onReset,state,setState,sound,onSound}){const [confirm,setConfirm]=React.useState(false);const dialogRef=useDialogFocus(onClose);return <div className="modal-backdrop" onClick={onClose}><section ref={dialogRef} tabIndex={-1} className="modal panel" role="dialog" aria-modal="true" aria-label="Game guide and settings" onClick={e=>e.stopPropagation()}><button className="close-button" onClick={onClose} aria-label="Close settings"><X/></button><Laurel className="modal-laurel"/><h2>Your city. Your empire.</h2><p>Welcome to Rome. Build a flourishing city in the heart of the empire.</p><div className="guide-grid"><div><h3>Build & prosper</h3><p>Choose a building, then click a highlighted empty plot. Homes welcome citizens, farms grow grain, markets earn denarii, and baths and temples bring happiness.</p></div><div><h3>Find your way</h3><p>Drag to orbit. Right-drag to pan. Scroll to zoom. Choose Explore to walk with WASD or arrow keys, and drag to look. On touch screens, drag and pinch to explore.</p></div></div><div className="shortcut-row"><span><kbd>1–5</kbd> build</span><span><kbd>Space</kbd> pause</span><span><kbd>Esc</kbd> cancel</span><span><kbd>H</kbd> overview</span></div><p className="save-note">Your city saves automatically in this browser. This is a creative game inspired by ancient Rome.</p><div className="modal-actions"><button className="subtle-button" onClick={onSound}>{sound?'Sound on':'Sound off'}</button>{confirm?<><span>Start a fresh city?</span><button className="danger-button" onClick={onReset}>Restart</button><button className="subtle-button" onClick={()=>setConfirm(false)}>Cancel</button></>:<button className="subtle-button" onClick={()=>setConfirm(true)}><RotateCcw size={15}/> New city</button>}<button className="gold-button" onClick={onClose}>Return to Rome</button></div></section></div>}

export function Victory({onClose}){const dialogRef=useDialogFocus(onClose);return <div className="modal-backdrop"><section ref={dialogRef} tabIndex={-1} className="modal victory panel" role="dialog" aria-modal="true" aria-label="City objectives completed"><Laurel className="victory-laurel"/><h2>Rome flourishes.</h2><p>Your citizens have a city worthy of an empire.<br/>The Senate rewards your vision.</p><div className="victory-reward"><Coins/>500 denarii <Laurel/>10 glory</div><button className="gold-button" onClick={onClose}>Keep building</button></section></div>}
