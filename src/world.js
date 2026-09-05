import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBuilding, createColosseum, createAqueduct, createTree } from './models.js';

const TAU = Math.PI * 2;
const NAMES = { domus: 'Roman domus', farm: 'Riverside farm', market: 'The merchants’ market', baths: 'Public baths', temple: 'Temple of the gods' };
const DESCRIPTIONS = { domus: 'An inviting courtyard home, where family life gathers around the garden.', farm: 'Wheat, olives, and vegetables supply the busy kitchens of Rome.', market: 'Merchants trade food, pottery, and fine fabrics beneath colorful awnings.', baths: 'Citizens meet, bathe, and unwind in Rome’s public bathhouses.', temple: 'A sanctuary of marble columns and terracotta, dedicated to the gods.' };
function random(seed = 1) { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const key = (x, z) => `${x},${z}`;

function surfaceTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); const rand = random(131);
  if (kind === 'stone') {
    ctx.fillStyle = '#998b6b'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
      const v = 168 + Math.floor(rand() * 28);
      ctx.fillStyle = `rgb(${v + 15},${v + 9},${v - 13})`;
      ctx.fillRect(col * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
  } else if (kind === 'water') {
    ctx.fillStyle = '#387b77'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 190; i++) {
      const x = rand() * 256; const y = rand() * 256;
      ctx.strokeStyle = `rgba(191,225,207,${0.025 + rand() * .15})`; ctx.lineWidth = .4 + rand();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 2, x + 14 + rand() * 20, y); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#92926c'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9500; i++) {
      const v = 90 + Math.floor(rand() * 65);
      ctx.fillStyle = `rgba(${v+18},${v+17},${v-12},0.2)`;
      ctx.fillRect(rand()*256,rand()*256,rand()*4+1,rand()*3+1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

/** Merge static architecture by appearance, keeping the city responsive on laptops. */
function mergeStatic(group) {
  group.updateMatrixWorld(true); const batches = new Map();
  group.traverse(object => {
    if (!object.isMesh || !object.geometry || Array.isArray(object.material)) return;
    const m = object.material;
    const id = [m.type, m.color?.getHexString(), m.roughness, m.metalness, m.opacity, m.transparent, m.side, m.vertexColors, m.map?.uuid, m.emissive?.getHexString(), m.emissiveIntensity].join('|');
    if (!batches.has(id)) batches.set(id, {material:m, geometries:[], cast: false, receive: false});
    const batch = batches.get(id); const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    for (const attr of Object.keys(geometry.attributes)) if (!['position','normal','uv'].includes(attr)) geometry.deleteAttribute(attr);
    batch.geometries.push(geometry); batch.cast ||= object.castShadow; batch.receive ||= object.receiveShadow;
  });
  group.clear();
  batches.forEach(batch => {
    const geometry = mergeGeometries(batch.geometries, false);
    if (geometry) { const mesh = new THREE.Mesh(geometry, batch.material); mesh.castShadow = batch.cast; mesh.receiveShadow = batch.receive; group.add(mesh); }
    batch.geometries.forEach(g=>g.dispose());
  });
}

export function createWorld(container, callbacks = {}) {
  const { onPlace, onInspect, onHover, onReady, onCancel, onMode, onError } = callbacks;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { onError?.(error); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D Roman city. Drag to orbit, scroll to zoom, or select a building to place.');
  renderer.domElement.tabIndex = 0; container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bec9bc'); scene.fog = new THREE.Fog('#bec9bc', 112, 285);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 550);
  const initialPosition = new THREE.Vector3(24, 61, 66), initialTarget = new THREE.Vector3(3, 0, 9);
  camera.position.copy(initialPosition);
  const controls = new OrbitControls(camera, canvas); controls.target.copy(initialTarget); controls.enableDamping = true; controls.dampingFactor = .075;
  controls.minDistance = 13; controls.maxDistance = 145; controls.maxPolarAngle = Math.PI*.465; controls.minPolarAngle = .2; controls.maxTargetRadius = 72;
  controls.panSpeed = .65; controls.rotateSpeed = .55; controls.zoomSpeed = .75; controls.update();
  scene.add(new THREE.HemisphereLight('#dfebe5', '#686b50', 1.8));
  scene.add(new THREE.AmbientLight('#dddfd7', .25));
  const sun = new THREE.DirectionalLight('#ffe8bf', 2.5); sun.position.set(-45, 74, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-100,right:100,top:95,bottom:-95,near:1,far:200});
  sun.shadow.bias=-.00035; sun.shadow.normalBias=.035; sun.shadow.radius=2; sun.target.position.set(0,0,-10); scene.add(sun,sun.target);
  const staticWorld = new THREE.Group(); scene.add(staticWorld);
  const placedWorld = new THREE.Group(); scene.add(placedWorld);
  const scenic = [], blocked = new Set(), playerLocations = new Set(), plots = [];
  const rand = random(9876);
  const grassTex = surfaceTexture('grass'); grassTex.repeat.set(52,52);
  const stoneTex = surfaceTexture('stone'); stoneTex.repeat.set(1,1);
  const waterTex = surfaceTexture('water'); waterTex.repeat.set(3,48);
  const materials = {
    grass:new THREE.MeshStandardMaterial({color:'#b5b08b',map:grassTex,roughness:1}),
    stone:new THREE.MeshStandardMaterial({color:'#e0d4b7',roughness:.95}),
    cobble:new THREE.MeshStandardMaterial({color:'#e6dcc5',map:stoneTex,roughness:1}),
    dirt:new THREE.MeshStandardMaterial({color:'#aaa076',roughness:1}),
    bank:new THREE.MeshStandardMaterial({color:'#b4ad84',roughness:1}),
    darkStone:new THREE.MeshStandardMaterial({color:'#a99f7d',roughness:1}),
    water:new THREE.MeshStandardMaterial({color:'#89c4b5',map:waterTex,roughness:.33,metalness:.25}),
    wood:new THREE.MeshStandardMaterial({color:'#866242',roughness:1}),
    bronze:new THREE.MeshStandardMaterial({color:'#77774f',roughness:.7,metalness:.4}),
    cloth:new THREE.MeshStandardMaterial({color:'#efe2bc',roughness:1,side:THREE.DoubleSide}),
    hill:new THREE.MeshStandardMaterial({color:'#818863',roughness:1,flatShading:true}),
  };
  function box(x,y,z,w,h,d,material=materials.stone,parent=staticWorld) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material); mesh.position.set(x,y,z); mesh.castShadow=h>.25; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function cylinder(x,y,z,r,h,material=materials.stone,segments=20,parent=staticWorld,rTop=r) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,r,h,segments),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function addModel(model,x,z,scale=1,rotation=0,parent=staticWorld) { model.position.set(x,.11,z);model.scale.setScalar(scale);model.rotation.y=rotation;parent.add(model);return model; }
  function register(model,type,name,description,player=false) {
    model.updateWorldMatrix(true,true); const bounds = new THREE.Box3().setFromObject(model);
    scenic.push({ type, name:name||NAMES[type], description:description||DESCRIPTIONS[type], bounds, player });
  }
  function reserved(x,z) {
    return (x>=0&&x<=24&&z>=-32&&z<=-8) || (x>=-8&&x<=16&&z>=0&&z<=8) || (x===24&&z===8);
  }
  for (let x=-24;x<=40;x+=8) for(let z=-32;z<=32;z+=8) {
    const plot={x,z,occupied:reserved(x,z),scenic:reserved(x,z)};plots.push(plot);if(plot.occupied)blocked.add(key(x,z));
  }

  // Continuous river valley, with banks that wind all the way to the horizon.
  const riverCenter = z => -44 + Math.sin(z*.022)*2.6;
  function terrainStrip(left,right,material,y) {
    const positions=[],uvs=[];for(let z=-260;z<260;z+=4){const x1=left(z),x2=right(z),x3=left(z+4),x4=right(z+4);positions.push(x1,y,z,x3,y,z+4,x2,y,z,x2,y,z,x3,y,z+4,x4,y,z+4);for(let n=0;n<6;n++)uvs.push(positions[(positions.length-18)+n*3]/520+.5,positions[(positions.length-18)+n*3+2]/520+.5);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;staticWorld.add(m);return m;
  }
  terrainStrip(()=>-260,z=>riverCenter(z)-8.1,materials.grass,-.02);
  terrainStrip(z=>riverCenter(z)+8.1,()=>260,materials.grass,-.02);
  terrainStrip(z=>riverCenter(z)-8.1,z=>riverCenter(z)-7.4,materials.bank,.01);
  terrainStrip(z=>riverCenter(z)+7.4,z=>riverCenter(z)+8.1,materials.bank,.01);
  const waterGeometry = new THREE.PlaneGeometry(23,520);waterGeometry.rotateX(-Math.PI/2);
  const river = new THREE.Mesh(waterGeometry,materials.water);river.position.set(-44,-.055,0);river.receiveShadow=true;scene.add(river);

  // Walkable paving with tiny mortar lines and generous forum squares.
  for(let x=-28;x<=76;x+=8) box(x,.02,-18,1.6,.07,124,materials.cobble);
  for(let z=-76;z<=40;z+=8) box(24,.025,z,105,.075,1.6,materials.cobble);
  box(-32,.01,-15,2.3,.09,146,materials.cobble);
  box(10,.06,-20,28,.12,24,materials.cobble);
  box(5,.075,4,28,.14,20,materials.cobble);
  box(5,.16,4,26.6,.1,18.6,materials.stone);
  // Inlaid geometric lines on the forum make its scale legible from above.
  for(let x=-7;x<=17;x+=4)box(x,.22,4,.065,.015,17.5,materials.darkStone);
  for(let z=-4;z<=12;z+=4)box(5,.22,z,25,.015,.065,materials.darkStone);

  const colosseum=addModel(createColosseum(),12,-20,1.15,-.07);
  register(colosseum,'landmark','The Colosseum','Rome’s great amphitheatre. Citizens gather beneath its grand arcades for spectacles and celebrations.');
  const aqueduct=addModel(createAqueduct(92),20,-40,1,0);
  register(aqueduct,'landmark','Aqua Claudia','A procession of stone arches carries fresh spring water into the heart of Rome.');
  const temple=addModel(createBuilding('temple',51),10,2,1.62,0);
  register(temple,'temple','Temple of Jupiter','Above the forum, a monumental temple honors Jupiter, protector of the Roman state.');
  const smallTemple=addModel(createBuilding('temple',54),24,8,1.04,0);
  register(smallTemple,'temple','Temple of Minerva','A quiet sanctuary for wisdom, craft, and the arts.');
  // The forum fountain and bronze figure.
  cylinder(-3,.37,6,2.25,.32,materials.stone,40);
  cylinder(-3,.53,6,1.98,.2,materials.darkStone,40);
  cylinder(-3,.65,6,1.78,.055,materials.water,40);
  cylinder(-3,1.2,6,.37,1.12,materials.stone,16);
  cylinder(-3,1.77,6,1.08,.17,materials.stone,28);
  cylinder(-3,1.89,6,.92,.04,materials.water,28);
  cylinder(-3,2.18,6,.17,.5,materials.stone,14);
  cylinder(-3,2.53,6,.43,.13,materials.stone,24);
  cylinder(-3,2.63,6,.34,.045,materials.water,24);
  cylinder(-3,3.04,6,.105,.72,materials.bronze,10);
  const statueHead=new THREE.Mesh(new THREE.SphereGeometry(.145,10,8),materials.bronze);statueHead.position.set(-3,3.54,6);staticWorld.add(statueHead);
  box(-3,3.25,6,.55,.12,.17,materials.bronze);
  scenic.push({type:'landmark',name:'The Forum Fountain',description:'Fresh water, conversation, and a moment of calm at the center of the city.',bounds:new THREE.Box3(new THREE.Vector3(-5.3,0,3.7),new THREE.Vector3(-.7,3.8,8.3))});
  // Low garden edges, cypresses, and public seating.
  for(const [x,z] of [[-7,-3],[-7,11],[18,-3],[18,11]]) {box(x,.31,z,1.5,.2,1.5,materials.darkStone);addModel(createTree('cypress',x+z+33),x,z,.82);}
  for(const x of [-7,18])for(const z of [2,6]){box(x,.47,z,1.5,.22,.48,materials.stone);box(x-.5,.24,z,.2,.35,.35,materials.darkStone);box(x+.5,.24,z,.2,.35,.35,materials.darkStone);}

  // Established quarters surround playable plots; foreground space invites expansion.
  for(const plot of plots) {
    if(plot.occupied)continue;
    const scenicPlot=plot.z<=-8 ? rand()>.08 : plot.z<=16 ? rand()>.27 : rand()>.56;
    if(!scenicPlot)continue;
    const type=plot.z>=24&&plot.x<=-8?'farm':rand()<.11?'market':rand()<.08?'baths':'domus';
    const model=addModel(createBuilding(type,Math.floor(rand()*99999)),plot.x,plot.z,.86+rand()*.10,rand()>.7?Math.PI/2:0);
    if(type==='domus')model.scale.y*=1+rand()*.48;
    register(model,type);plot.occupied=plot.scenic=true;blocked.add(key(plot.x,plot.z));
  }
  for(let z=-80;z<=32;z+=8)for(let x=-24;x<=72;x+=8) {
    if(x<=40&&z>=-32)continue;
    if(z===-40||rand()<.14)continue;
    const kind=(x>=56&&z>8)?'farm':rand()<.05?'temple':rand()<.13?'market':'domus';
    const home=addModel(createBuilding(kind,Math.floor(rand()*70000)),x+(rand()-.5)*.4,z+(rand()-.5)*.4,.86+rand()*.14,rand()>.52?Math.PI/2:0);
    if(kind==='domus')home.scale.y*=1+rand()*.7;
  }
  // A smaller settlement lies across the river, edged by orchards and fields.
  box(-68,.025,-18,1.7,.08,110,materials.cobble);
  for(let z=-65;z<=38;z+=9)for(const x of [-59,-77])if(rand()>.16)addModel(createBuilding(rand()>.72?'farm':'domus',Math.floor(rand()*60000)),x,z,.72+rand()*.16,Math.PI/2);
  for(let z=-64;z<40;z+=16)box(-68,.025,z,26,.08,1.5,materials.cobble);

  // A stone bridge with piers and open, semicircular archways.
  const bridge=new THREE.Group();staticWorld.add(bridge);
  const bx=-43,bz=21;
  box(bx,1.04,bz,27,.28,3.2,materials.cobble,bridge);
  for(const zz of [bz-1.65,bz+1.65]){box(bx,1.41,zz,27,.6,.23,materials.stone,bridge);for(let x=-55;x<=-30;x+=2.5)box(x,1.65,zz,.27,.5,.3,materials.stone,bridge);}
  for(let x=-54;x<=-31;x+=5.75)box(x,.18,bz,.75,1.7,3.2,materials.darkStone,bridge);
  for(let x=-51.12;x<-31;x+=5.75) {
    const arch=new THREE.Mesh(new THREE.TorusGeometry(2.52,.21,7,18,Math.PI),materials.stone);arch.rotation.z=0;arch.position.set(x,-1.33,bz-1.45);bridge.add(arch);
    const arch2=arch.clone();arch2.position.z=bz+1.45;bridge.add(arch2);
  }
  register(bridge,'landmark','Pons Aemilius','A stone bridge brings travelers and trade across the Tiber.');
  for(const x of [-58,-28])box(x,.46,bz,4.5,1.05,3.1,materials.cobble);
  // Quays and wooden moorings on the warm riverbank.
  for(const z of [-10,4,34]){box(-34,.3,z,2,.5,8,materials.stone);box(-37,.24,z,5,.25,1.65,materials.wood);for(const zz of [z-.6,z+.6])cylinder(-39,.4,zz,.12,1.5,materials.wood,8);}

  // Trees are placed on verges, never over an available construction plot.
  for(let z=-76;z<=40;z+=7) {
    if(Math.abs(z-21)>4)addModel(createTree(z%3===0?'cypress':'pine',z+888),-31.3,z,.8+rand()*.4);
    if(rand()>.14)addModel(createTree('cypress',z+541),45.5,z,.8+rand()*.4);
  }
  for(const plot of plots) {
    if(!plot.occupied) {
      box(plot.x,.005,plot.z,5.9,.025,5.9,materials.dirt);
      for(const side of [-1,1])box(plot.x+side*2.92,.055,plot.z,.10,.075,5.8,materials.darkStone);
      for(let j=0;j<6;j++)box(plot.x-2.3+j*.92,.028,plot.z,.38,.032,4.4,materials.bank);
    }
    if((plot.x+plot.z)%16===0&&plot.z>=-8&&!reserved(plot.x,plot.z))addModel(createTree('cypress',plot.x*17+plot.z+941),plot.x+3.3,plot.z+3.3,.56+rand()*.13);
  }
  for(let i=0;i<70;i++) {const x=-88+rand()*172,z=-88+rand()*132;if(x>-29&&x<76&&z>-83&&z<42)continue;if(Math.abs(x-riverCenter(z))<10)continue;addModel(createTree(rand()>.3?'pine':'cypress',i+123),x,z,.8+rand()*.8);}
  for(let i=0;i<13;i++) {
    const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),materials.hill);
    const x=-150+i*25+(rand()-.5)*15,z=-165+(rand()-.5)*37;const height=6+rand()*9;
    hill.position.set(x,-2,z);hill.scale.set(27+rand()*19,height,24+rand()*20);hill.receiveShadow=true;staticWorld.add(hill);
    for(let j=0;j<17;j++){const angle=rand()*TAU,radius=rand()*.76;const tx=x+Math.cos(angle)*radius*27,tz=z+Math.sin(angle)*radius*23;const ty=height*Math.sqrt(1-radius*radius)*.86-2;const tree=addModel(createTree('pine',i*30+j),tx,tz,.8+rand()*1.2);tree.position.y=ty;}
  }
  // Grassland trees flank the city and soften the horizon.
  for(let i=0;i<110;i++) {const x=80+rand()*90,z=-110+rand()*170;addModel(createTree(rand()>.3?'pine':'cypress',i+891),x,z,.8+rand()*1.5);}
  for(let i=0;i<85;i++) {const x=-160+rand()*66,z=-105+rand()*155;addModel(createTree('pine',i+4551),x,z,.9+rand()*1.4);}
  const adjustedMaterials=new Set();
  const pigment={'b96540':'a84f30','ca7b50':'b86840','985034':'864129','decdaa':'d6c39e','f0dfbb':'e8d7b5'};
  staticWorld.traverse(mesh=>{if(mesh.isMesh&&!adjustedMaterials.has(mesh.material)){adjustedMaterials.add(mesh.material);const hex=mesh.material.color?.getHexString();if(pigment[hex])mesh.material.color.set('#'+pigment[hex]);}});
  mergeStatic(staticWorld);

  // A few small trading boats drift quietly on the Tiber.
  const boats=[];
  for(const [z,offset,size] of [[-20,-2,.9],[10,1,.75],[42,-1,1.1],[-67,1,.85]]) {
    const boat=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),materials.wood);hull.scale.set(.66,.38,2);hull.position.y=.04;boat.add(hull);
    box(0,.2,0,.85,.14,2.7,materials.wood,boat);cylinder(0,1.5,-.3,.045,2.8,materials.wood,7,boat);
    const sailGeometry=new THREE.BufferGeometry();sailGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,2.7,-.3,0,.75,-.3,0,.9,1.4],3));sailGeometry.computeVertexNormals();boat.add(new THREE.Mesh(sailGeometry,materials.cloth));
    boat.position.set(riverCenter(z)+offset,.01,z);boat.scale.setScalar(size);boat.rotation.y=.12;scene.add(boat);boats.push(boat);
  }

  // Instanced citizens: a lively street network with only a handful of draw calls.
  const people=[];const peopleCount=120;const tunicColors=['#c4a477','#b35437','#d9d3ab','#657b79'];
  const citizenGroups=tunicColors.map(color=>{
    const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.095,.135,.38,7),new THREE.MeshStandardMaterial({color,roughness:1}),peopleCount);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return mesh;
  });
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.078,6,5),new THREE.MeshStandardMaterial({color:'#b9895b',roughness:1}),peopleCount);heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(heads);
  for(let i=0;i<peopleCount;i++) {
    let x=-28+Math.floor(rand()*13)*8,z=-68+Math.floor(rand()*14)*8;
    if(x>=-2&&x<=26&&z>=-32&&z<=-8) {x=-20;}
    const horizontal=rand()>.5;people.push({x:x+(horizontal?rand()*6:0),z:z+(horizontal?0:rand()*6),startX:x,startZ:z,horizontal,speed:.33+rand()*.3,phase:rand()*TAU,direction:rand()>.5?1:-1,color:i%4});
  }
  const temp=new THREE.Object3D();
  function updatePeople(time,delta) {
    const counts=[0,0,0,0];
    people.forEach((p,i)=>{p.phase+=delta*p.speed*.12;const travel=(Math.sin(p.phase)*.5+.5)*7;const x=p.startX+(p.horizontal?travel:.3),z=p.startZ+(p.horizontal?.3:travel);temp.position.set(x,.37,z);temp.rotation.set(0,p.horizontal?Math.PI/2:0,0);temp.scale.set(1,1,1);temp.updateMatrix();citizenGroups[p.color].setMatrixAt(counts[p.color]++,temp.matrix);temp.position.y=.65;temp.updateMatrix();heads.setMatrixAt(i,temp.matrix);});
    citizenGroups.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;});heads.instanceMatrix.needsUpdate=true;
  }
  updatePeople(0,0);

  // Plot overlays exist as real geometry, correctly occluded by the city.
  const plotGroup=new THREE.Group();plotGroup.visible=false;scene.add(plotGroup);
  const plotFill=new THREE.MeshBasicMaterial({color:'#9fc774',transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide});
  const plotLineMaterial=new THREE.LineBasicMaterial({color:'#e8ebac',transparent:true,opacity:1,depthWrite:false});
  function refreshPlots() {
    plotGroup.children.forEach(child=>child.geometry?.dispose());plotGroup.clear();
    const verts=[];
    for(const plot of plots) {
      plot.occupied=blocked.has(key(plot.x,plot.z))||playerLocations.has(key(plot.x,plot.z));
      if(plot.occupied)continue;
      const square=new THREE.Mesh(new THREE.PlaneGeometry(6.35,6.35),plotFill);square.rotation.x=-Math.PI/2;square.position.set(plot.x,.28,plot.z);plotGroup.add(square);
      const x=plot.x,z=plot.z,d=3.175;verts.push(x-d,.3,z-d,x+d,.3,z-d,x+d,.3,z-d,x+d,.3,z+d,x+d,.3,z+d,x-d,.3,z+d,x-d,.3,z+d,x-d,.3,z-d,x-.65,.32,z,x+.65,.32,z,x,.32,z-.65,x,.32,z+.65);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));plotGroup.add(new THREE.LineSegments(geometry,plotLineMaterial));
  }
  refreshPlots();
  const preview=new THREE.Group();scene.add(preview);preview.visible=false;
  const previewMat=new THREE.MeshBasicMaterial({color:'#a8ce7b',transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  const footprint=new THREE.Mesh(new THREE.PlaneGeometry(6.45,6.45),previewMat);footprint.rotation.x=-Math.PI/2;footprint.position.y=.16;preview.add(footprint);
  const outlineGeometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(6.45,.18,6.45));
  const outlineMat=new THREE.LineBasicMaterial({color:'#bddb8f',transparent:true,opacity:.95});
  const outline=new THREE.LineSegments(outlineGeometry,outlineMat);outline.position.y=.22;preview.add(outline);
  let ghost=null,buildType=null,hoverPlot=null,lastHover='',speed=1,paused=false,mode='orbit',destroyed=false,animationId=0,ready=false;
  let playerBuildings=[];
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.12),groundPoint=new THREE.Vector3();
  function pointFromEvent(event) {
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(groundPlane,groundPoint);
  }
  function updateHover(event) {
    if(!buildType||!pointFromEvent(event)){preview.visible=false;hoverPlot=null;return;}
    const x=Math.round(groundPoint.x/8)*8,z=Math.round(groundPoint.z/8)*8;
    const plot=plots.find(p=>p.x===x&&p.z===z);const valid=!!plot&&!plot.occupied;
    hoverPlot=valid?plot:null;preview.position.set(x,0,z);preview.visible=true;
    const color=valid?'#b2de87':'#e98974';previewMat.color.set(color);outlineMat.color.set(color);
    ghost?.traverse(m=>{if(m.isMesh)m.material.color.set(color);});
    const message=valid?'Click to place your '+buildType:plot?'This plot is already occupied':'Choose a highlighted city plot';
    const signature=valid+message;if(lastHover!==signature){lastHover=signature;onHover?.(valid,message);}
  }
  function setBuildType(type) {
    buildType=type||null;lastHover='';hoverPlot=null;plotGroup.visible=!!buildType;preview.visible=false;canvas.style.cursor=buildType?'crosshair':mode==='walk'?'grab':'grab';
    if(ghost){preview.remove(ghost);ghost.traverse(m=>{if(m.isMesh)m.material.dispose();});ghost=null;}
    if(buildType){if(mode==='walk')setMode('orbit');ghost=createBuilding(buildType,102);ghost.traverse(mesh=>{if(mesh.isMesh){mesh.material=new THREE.MeshBasicMaterial({color:'#b2de87',transparent:true,opacity:.30,depthWrite:false});mesh.castShadow=false;mesh.receiveShadow=false;}});ghost.position.y=.15;preview.add(ghost);}
  }
  function syncBuildings(buildings=[]) {
    playerBuildings=buildings;placedWorld.clear();playerLocations.clear();
    for(let i=scenic.length-1;i>=0;i--)if(scenic[i].player)scenic.splice(i,1);
    for(const building of buildings) {
      const model=addModel(createBuilding(building.type,building.id?String(building.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0):building.x*31+building.z),building.x,building.z,1,0,placedWorld);
      playerLocations.add(key(building.x,building.z));register(model,building.type,undefined,undefined,true);
    }
    if(buildings.length)mergeStatic(placedWorld);refreshPlots();renderer.shadowMap.needsUpdate=true;
    if(hoverPlot&&playerLocations.has(key(hoverPlot.x,hoverPlot.z))){hoverPlot=null;preview.visible=false;}
  }

  let down=null;const keys=new Set();let walkYaw=0,walkPitch=-.02;
  const walkPad=document.createElement('div');walkPad.className='walk-pad';walkPad.setAttribute('aria-label','Walking controls');walkPad.style.display='none';
  for(const [direction,label,arrow] of [['w','Move forward','↑'],['a','Move left','←'],['s','Move backward','↓'],['d','Move right','→']]) {
    const button=document.createElement('button');button.type='button';button.className='walk-'+direction;button.setAttribute('aria-label',label);button.textContent=arrow;
    button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();button.setPointerCapture(event.pointerId);keys.add(direction);});
    const release=event=>{event.preventDefault();event.stopPropagation();keys.delete(direction);};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',()=>keys.delete(direction));walkPad.appendChild(button);
  }
  container.parentElement.appendChild(walkPad);
  function pointerDown(event) {down={x:event.clientX,y:event.clientY,button:event.button};if(mode==='walk')canvas.style.cursor='grabbing';}
  function pointerMove(event) {
    if(mode==='walk'&&down&&event.buttons===1){const dx=event.clientX-down.x,dy=event.clientY-down.y;walkYaw-=dx*.004;walkPitch=THREE.MathUtils.clamp(walkPitch-dy*.004,-1.1,1.1);camera.rotation.set(walkPitch,walkYaw,0,'YXZ');down.x=event.clientX;down.y=event.clientY;}
    else updateHover(event);
  }
  function pointerUp(event) {
    canvas.style.cursor=buildType?'crosshair':'grab';if(!down)return;const moved=Math.hypot(event.clientX-down.x,event.clientY-down.y);const button=down.button;down=null;
    if(button!==0||moved>6||mode==='walk')return;
    if(buildType){updateHover(event);if(hoverPlot)onPlace?.(hoverPlot.x,hoverPlot.z);else onHover?.(false,'Choose an empty highlighted plot');return;}
    if(!pointFromEvent(event))return;
    const hits=scenic.map(item=>({item,d:raycaster.ray.intersectBox(item.bounds,new THREE.Vector3())})).filter(x=>x.d).sort((a,b)=>a.d.distanceTo(camera.position)-b.d.distanceTo(camera.position));
    onInspect?.(hits.length?{name:hits[0].item.name,description:hits[0].item.description,type:hits[0].item.type}:null);
  }
  function keyDown(event) {
    if(document.querySelector('[aria-modal="true"]'))return;
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(event.key==='Escape'){if(buildType){setBuildType(null);onCancel?.();}else if(mode==='walk')setMode('orbit');else onInspect?.(null);}
    if(mode==='walk'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(event.key.toLowerCase())){keys.add(event.key.toLowerCase());event.preventDefault();}
  }
  function keyUp(event) {keys.delete(event.key.toLowerCase());}
  function blur(){keys.clear();down=null;}
  const savedCamera={position:initialPosition.clone(),target:initialTarget.clone()};
  function setMode(next) {
    if(next===mode)return;
    if(next==='walk') {
      if(buildType){setBuildType(null);onCancel?.();}savedCamera.position.copy(camera.position);savedCamera.target.copy(controls.target);
      mode='walk';controls.enabled=false;camera.position.set(-11,1.7,19);walkYaw=-.08;walkPitch=0;camera.rotation.set(walkPitch,walkYaw,0,'YXZ');
    } else {mode='orbit';keys.clear();controls.enabled=true;camera.position.copy(savedCamera.position);controls.target.copy(savedCamera.target);controls.update();}
    walkPad.style.display=mode==='walk'?'grid':'none';onMode?.(mode);
  }
  function updateWalk(delta) {
    if(document.querySelector('[aria-modal="true"]')){keys.clear();return;}
    if(mode!=='walk')return;let forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    if(!forward&&!side)return;const normalization=(forward&&side)?.707:1;const amount=(keys.has('shift')?10:4.5)*delta*normalization;
    const dx=(-Math.sin(walkYaw)*forward+Math.cos(walkYaw)*side)*amount,dz=(-Math.cos(walkYaw)*forward-Math.sin(walkYaw)*side)*amount;
    const canStand=(x,z)=>x>-30&&x<81&&z>-86&&z<48&&!scenic.some(s=>s.type!=='landmark'&&x>s.bounds.min.x-.16&&x<s.bounds.max.x+.16&&z>s.bounds.min.z-.16&&z<s.bounds.max.z+.16);
    if(canStand(camera.position.x+dx,camera.position.z))camera.position.x+=dx;if(canStand(camera.position.x,camera.position.z+dz))camera.position.z+=dz;camera.position.y=1.7;
  }
  function zoom(delta) {if(mode==='walk')return;const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(delta>0?.82:1.22);offset.setLength(THREE.MathUtils.clamp(offset.length(),controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}
  function resetCamera(){if(mode==='walk')setMode('orbit');camera.position.copy(initialPosition);controls.target.copy(initialTarget);controls.update();}
  const resizeObserver=new ResizeObserver(()=>{const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});resizeObserver.observe(container);
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointerleave',()=>{preview.visible=false;hoverPlot=null;down=null;});
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);
  let previousTime=performance.now(),elapsed=0;
  function frame(now) {
    if(destroyed)return;animationId=requestAnimationFrame(frame);const delta=Math.min((now-previousTime)/1000,.06);previousTime=now;
    if(mode==='orbit')controls.update();else updateWalk(delta);
    if(!paused){elapsed+=delta*speed;updatePeople(elapsed,delta*speed);waterTex.offset.y=elapsed*.004;waterTex.offset.x=Math.sin(elapsed*.05)*.025;boats.forEach((boat,i)=>{boat.position.y=.015+Math.sin(elapsed*.9+i*2)*.055;boat.rotation.z=Math.sin(elapsed*.65+i)*.018;});}
    renderer.render(scene,camera);if(!ready){ready=true;onReady?.();}
  }
  animationId=requestAnimationFrame(frame);
  return {
    setBuildType,syncBuildings,setSpeed:value=>{speed=Number(value)||1;},setPaused:value=>{paused=!!value;},zoom,resetCamera,setMode,getMode:()=>mode,
    getMapData:()=>({plots:plots.map(({x,z,occupied,scenic})=>({x,z,occupied,scenic})),riverX:-44,landmarks:[{x:12,z:-20,name:'Colosseum',type:'colosseum'},{x:10,z:2,name:'Temple',type:'temple'},{x:-3,z:6,name:'Forum',type:'forum'}]}),
    destroy(){destroyed=true;cancelAnimationFrame(animationId);resizeObserver.disconnect();controls.dispose();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);scene.traverse(object=>{object.geometry?.dispose();if(object.material){const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>m.dispose());}});grassTex.dispose();stoneTex.dispose();waterTex.dispose();renderer.dispose();walkPad.remove();canvas.remove();},
  };
}
