import React, {useEffect,useRef,useState,useCallback} from 'react';
import {Settings2,Volume2,VolumeX,Check,LoaderCircle,X,Footprints} from 'lucide-react';
import {createWorld} from './world.js';
import {BUILDINGS,initialState,tick,build,saveGame,loadGame} from './game.js';
import {Laurel,ResourceBar,Objectives,BuildDock,TimeControls,MiniMap,CameraControls,Inspector,Settings,Victory} from './ui.jsx';

export default function App(){
  const [state,setState]=useState(()=>loadGame()||initialState());
  const [selected,setSelected]=useState(null), [ready,setReady]=useState(false),[error,setError]=useState('');
  const [settings,setSettings]=useState(false),[sound,setSound]=useState(false),[mode,setMode]=useState('orbit');
  const [info,setInfo]=useState(null),[expanded,setExpanded]=useState(false),[toast,setToast]=useState('');
  const [saved,setSaved]=useState(false),[hover,setHover]=useState(null),[mapData,setMapData]=useState(null);
  const [victoryDismissed,setVictoryDismissed]=useState(state.won);
  const modalOpen=settings||(state.won&&!victoryDismissed);
  const mount=useRef(null),world=useRef(null),stateRef=useRef(state),selectedRef=useRef(selected),toastTimer=useRef(),soundRef=useRef(false),audioCtx=useRef(null);
  stateRef.current=state;selectedRef.current=selected;soundRef.current=sound;
  const notify=useCallback(text=>{setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3200)},[]);
  const chime=useCallback(()=>{if(!soundRef.current)return;try{const ac=audioCtx.current||(audioCtx.current=new(window.AudioContext||window.webkitAudioContext)());ac.resume();[392,493.88,587.33].forEach((hz,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=hz;const t=ac.currentTime+i*.08;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.055,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.75);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.8)})}catch{}},[]);
  useEffect(()=>{try{world.current=createWorld(mount.current,{
    onPlace:(x,z)=>{const type=selectedRef.current;if(!type)return;setState(old=>{const result=build(old,type,x,z);if(result.error){notify(result.error);return old}notify(`${BUILDINGS.find(b=>b.id===type)?.name} built. Your city grows.`);chime();return result.state})},
    onInspect:setInfo,onHover:(valid,message)=>setHover(message?{valid,message}:null),onReady:()=>setReady(true),onCancel:()=>setSelected(null),onMode:setMode,onError:message=>setError(String(message))
  });setMapData(world.current.getMapData());setReady(true)}catch(e){console.error(e);setError('The 3D city could not start. Please open this game in a browser with WebGL enabled.')}return()=>{world.current?.destroy();clearTimeout(toastTimer.current)}},[notify,chime]);
  useEffect(()=>{world.current?.syncBuildings(state.buildings)},[state.buildings]);
  useEffect(()=>{world.current?.setBuildType(selected);setHover(null);if(selected){world.current?.setMode('orbit');setMode('orbit');setInfo(null)}},[selected]);
  useEffect(()=>{world.current?.setSpeed(state.speed);world.current?.setPaused(state.paused||modalOpen)},[state.speed,state.paused,modalOpen]);
  useEffect(()=>{let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;if(document.hidden||modalOpen)return;setState(s=>tick(s,dt))},250);return()=>clearInterval(timer)},[modalOpen]);
  useEffect(()=>{const timer=setInterval(()=>{setSaved(saveGame(stateRef.current))},5000);const save=()=>saveGame(stateRef.current);window.addEventListener('pagehide',save);return()=>{clearInterval(timer);save();window.removeEventListener('pagehide',save)}},[]);
  useEffect(()=>{if(state.buildings.length)saveGame(state)},[state.buildings]);
  useEffect(()=>{const key=e=>{
    const target=e.target instanceof Element?e.target:null;
    if(modalOpen||e.repeat||target?.closest('input,textarea,select,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Escape'){setInfo(null);setSelected(null);world.current?.setMode('orbit');setMode('orbit')}
    if(e.code==='Space'){
      if(target?.closest('button,a,[role="button"]'))return;
      e.preventDefault();setState(s=>({...s,paused:!s.paused}));
    }
    if(e.key.toLowerCase()==='h'){world.current?.resetCamera();setMode('orbit')}
    if(/^[1-5]$/.test(e.key)){setSelected(BUILDINGS[Number(e.key)-1].id)}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[modalOpen]);
  const changeMode=m=>{if(m==='walk')setSelected(null);world.current?.setMode(m);setMode(m)};
  const reset=()=>{setState(initialState());saveGame(initialState());setSelected(null);setInfo(null);setSettings(false);setVictoryDismissed(false);world.current?.resetCamera();setMode('orbit');notify('A new chapter for Rome.')};
  return <main className={`game ${mode==='walk'?'walking':''}`}>
    <div className="world" ref={mount} aria-label="Interactive 3D Roman city"/>
    <div className="edge-shade"/>
    <header className="game-header"><a href="#" className="brand" onClick={e=>{e.preventDefault();world.current?.resetCamera();setMode('orbit')}} aria-label="Roma city overview"><Laurel/><div><span className="wordmark">ROMA</span><span className="brand-subtitle">THE ETERNAL CITY</span></div></a><ResourceBar state={state}/><div className="header-actions"><button className="circle" onClick={()=>setSettings(true)} aria-label="Open game guide and settings" title="Game guide & settings"><Settings2/></button><button className="circle" onClick={()=>{setSound(!sound);notify(sound?'Sound off':'Building sounds on')}} aria-label={sound?'Mute sound':'Enable sound'} title={sound?'Mute sound':'Enable sound'}>{sound?<Volume2/>:<VolumeX/>}</button></div></header>
    <div className="city-caption">ROMA <span>·</span> 125 AD</div>
    <Objectives state={state} expanded={expanded} onToggle={()=>setExpanded(!expanded)}/>
    <Inspector info={info} onClose={()=>setInfo(null)}/>
    {selected&&<div className={`placement-message ${hover?.valid===false?'invalid':''}`} role="status"><span className="placement-dot"/>{hover?.message||'Choose an open plot to build'}<button onClick={()=>setSelected(null)} aria-label="Cancel construction"><X size={15}/></button></div>}
    {mode==='walk'&&<div className="walk-instructions panel"><Footprints size={19}/><span><b>Explore Rome</b><span className="desktop-walk-hint">WASD / arrows to walk · Drag to look · Shift to run</span><span className="mobile-walk-hint">Drag to look · Use arrows to walk</span></span><button onClick={()=>changeMode('orbit')}>Return to city</button></div>}
    <TimeControls state={state} onPause={()=>setState(s=>({...s,paused:!s.paused}))} onSpeed={speed=>setState(s=>({...s,speed,paused:false}))}/>
    <BuildDock state={state} selected={selected} onSelect={setSelected} mode={mode}/>
    <div className="right-controls"><MiniMap state={state} onHome={()=>{world.current?.resetCamera();setMode('orbit')}} mapData={mapData}/><CameraControls onZoom={d=>world.current?.zoom(d)} onHome={()=>{world.current?.resetCamera();setMode('orbit')}} mode={mode} onMode={changeMode}/></div>
    <div className="save-status">{saved?<><Check size={11}/> City saved</>:<>A new day in Rome</>}</div>
    {toast&&<div className="toast panel" role="status">{toast}</div>}
    {!ready&&!error&&<div className="loading"><Laurel/><h2>All roads lead to Rome.</h2><LoaderCircle className="spinner"/><p>Preparing your city…</p></div>}
    {error&&<div className="loading"><h2>Rome is waiting.</h2><p>{error}</p><button className="gold-button" onClick={()=>location.reload()}>Try again</button></div>}
    {settings&&<Settings onClose={()=>setSettings(false)} onReset={reset} state={state} setState={setState} sound={sound} onSound={()=>setSound(!sound)}/>}
    {state.won&&!victoryDismissed&&<Victory onClose={()=>setVictoryDismissed(true)}/>}
  </main>
}
