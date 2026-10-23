const R=[-90,-30,30,90],$=id=>document.getElementById(id);
let role=null,naira=2500,saved=0,heat=0,pass=null,cool=0,fineCd=0,phase=0,T=0,th=0,sp=0;
let inv={garri:0,yam:0,phone:0,fuel:0,poster:0,megaphone:0,uniform:0,tagbook:0},wk={garri:1,yam:1,phone:1,fuel:1,poster:1,megaphone:1,uniform:1,tagbook:1};
let mode="walk",currentCar=null,ownedCars=["none"],warnings=0,lastFineMsg="";
const G={
  garri:["Garri bag",350],
  yam:["Yam tuber",600],
  phone:["Used phone",8500],
  fuel:["Fuel can (station)",4200],
  poster:["AB station poster pack",1200],
  megaphone:["Street megaphone",3500],
  uniform:["Station uniform",3500],
  tagbook:["Charge tag log book",1800]
};
const CARS={
  none:{n:"On foot",c:0xdb9a6a,s:9,price:0},
  keke:{n:"Keke Napep",c:0xffc400,s:18,price:45000},
  taxi:{n:"Yellow Taxi",c:0xf1c40f,s:28,price:180000},
  private:{n:"Private car",c:0x2ecc71,s:36,price:420000},
  police:{n:"Police SUV",c:0x1e5bff,s:40,price:0},
  okada:{n:"Okada (bike)",c:0xe74c3c,s:32,price:95000}
};
/* Roles kept same keys so world/AI still work. Copy stresses: tools first, pay in sessions. */
const ROLES={
  driver:{i:"🚕",n:"Driver",c:0xffc400,s:34,d:"Contract runs only. Pick up 3 passengers and complete their drops, then collect one run payment. Red lights still fine you."},
  police:{i:"👮",n:"Police",c:0x1e5bff,s:42,d:"Patrol contract: arrest 2 wanted suspects, then book them at Police HQ for the session payout. Wrong person = warning + fine."},
  thief:{i:"🦹",n:"Thief",c:0x2b2b2b,s:40,d:"Risky street work. Snatch builds a stash — you only cash out when you fence at Motor Park. High heat = bust."},
  banker:{i:"🏦",n:"POS / Bank teller",c:0xf5f5f5,s:30,d:"Business partner desk. Serve 4 customers at Uyo Bank or First Bank, then close the till for commission. Need uniform."},
  trader:{i:"🛒",n:"Trader",c:0x2ecc71,s:28,d:"Buy cheap at markets, sell at plazas/estates. Stock must sit in inventory — no instant magic money."},
  marketer:{i:"📢",n:"AB Street Marketer",c:0xe67e22,s:26,d:"Promote Abasieyene Oil and Gas. Buy posters/megaphone first. Log 3 promos, then collect campaign pay at AB Station."},
  worker:{i:"👷",n:"Station / site worker",c:0xf39c12,s:24,d:"Shift work at AB Station, Stadium, Works or Airport. Clock 3 tasks on site, then end shift for wage. Uniform helps."}
};
/* Session / contract progress (not saved — per play) */
let contract={role:null,done:0,need:0,stash:0,active:false};
try{const s=JSON.parse(localStorage.getItem("uyo2")||"{}");
  if(s.naira!=null){naira=s.naira;saved=s.saved||0;ownedCars=s.ownedCars||ownedCars;warnings=s.warnings||0;
    inv=Object.assign({garri:0,yam:0,phone:0,fuel:0,poster:0,megaphone:0,uniform:0,tagbook:0},s.inv||{});}
}catch(e){}

// ========== SCENE ==========
const sc=new THREE.Scene();sc.background=new THREE.Color(0x87ceeb);sc.fog=new THREE.Fog(0x87ceeb,140,380);
const cam=new THREE.PerspectiveCamera(55,1,.5,500);
const rd=new THREE.WebGLRenderer({antialias:true});rd.setPixelRatio(Math.min(devicePixelRatio,2));rd.shadowMap.enabled=true;rd.shadowMap.type=THREE.PCFSoftShadowMap;
$("app").prepend(rd.domElement);

const hemi=new THREE.HemisphereLight(0xffffff,0x4a6b3a,0.85);sc.add(hemi);
const sun=new THREE.DirectionalLight(0xfff5e0,0.9);sun.position.set(60,100,40);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=10;sun.shadow.camera.far=320;
sun.shadow.camera.left=-140;sun.shadow.camera.right=140;sun.shadow.camera.top=140;sun.shadow.camera.bottom=-140;
sc.add(sun);sc.add(new THREE.AmbientLight(0x404060,0.25));

const box=(w,h,d,c,x,y,z,shadow=true)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:c}));
  m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;sc.add(m);return m;
};

// Ground + roads
box(420,1,420,0x3d8b40,0,-.5,0,false).receiveShadow=true;
R.forEach(r=>{
  box(380,.25,16,0x333338,0,.05,r);
  box(16,.25,380,0x333338,r,.07,0);
  for(let i=-170;i<=170;i+=18){
    box(0.6,.26,4,0xf1c40f,i,.12,r);
    box(4,.26,0.6,0xf1c40f,r,.12,i);
  }
});

function label(t,x,y,z,scale=1){
  const c=document.createElement("canvas");c.width=360;c.height=80;
  const g=c.getContext("2d");g.fillStyle="rgba(0,0,0,.72)";g.fillRect(0,0,360,80);
  g.fillStyle="#fff";g.font="bold 26px system-ui,sans-serif";g.textAlign="center";g.fillText(t,180,52);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));
  s.scale.set(30*scale,7*scale,1);s.position.set(x,y,z);sc.add(s);return s;
}

// ========== LANDMARKS (Uyo map + AB Oil & Gas / Etinan signs) ==========
const L=[
  {id:"market",n:"Itam Market",x:-40,z:40,c:0xff8a3d,h:10},
  {id:"watt",n:"Watt Market",x:-90,z:30,c:0xe67e22,h:9},
  {id:"plaza",n:"Ibom Plaza",x:40,z:-40,c:0x9b59b6,h:32},
  {id:"bank",n:"Uyo Bank HQ",x:40,z:40,c:0x2e86de,h:26},
  {id:"fbn",n:"First Bank + POS",x:0,z:90,c:0x1a5276,h:14},
  {id:"police",n:"Police HQ",x:-40,z:-40,c:0x1e3a8a,h:14},
  {id:"park",n:"Motor Park",x:100,z:-40,c:0xe0c341,h:8},
  {id:"stadium",n:"Godswill Akpabio Stadium",x:-110,z:110,c:0x27ae60,h:18},
  {id:"airport",n:"Uyo Airport",x:130,z:110,c:0x5d6d7e,h:11},
  {id:"uniuyo",n:"Uniuyo Main Gate",x:-130,z:-80,c:0x16a085,h:12},
  {id:"shelter",n:"Shelter Afrique Estate",x:90,z:90,c:0x2980b9,h:16},
  {id:"ekorinim",n:"Ekorinim Estate",x:-90,z:-110,c:0x8e44ad,h:15},
  {id:"aka",n:"Aka Offot Estate",x:0,z:-130,c:0xd35400,h:13},
  {id:"plaza2",n:"Tropicana Mall",x:110,z:0,c:0xc0392b,h:20},
  {id:"hospital",n:"Uyo Specialist Hospital",x:-60,z:0,c:0x1abc9c,h:18},
  {id:"church",n:"All Saints Cathedral",x:60,z:0,c:0xecf0f1,h:22},
  {id:"fuel",n:"AB Oil & Gas (Etinan)",x:0,z:0,c:0xf1c40f,h:9},
  {id:"works",n:"Public Works Yard",x:130,z:-90,c:0x7f8c8d,h:9},
  {id:"charge",n:"AB Device Charging",x:25,z:15,c:0x2ecc71,h:6},
  {id:"etinan",n:"Etinan Junction",x:-50,z:70,c:0x3498db,h:8}
];
L.forEach(l=>{
  box(28,l.h,28,l.c,l.x,l.h/2,l.z);
  label(l.n,l.x,l.h+5.5,l.z,0.95);
});

// Stadium details
(function(){
  const sx=-110,sz=110;
  box(44,0.3,30,0x2ecc71,sx,0.2,sz);
  for(let i=0;i<4;i++){const h=4+i*3,w=50+i*4,d=36+i*4;box(w,2,d,0xecf0f1,sx,h,sz)}
  box(58,1.5,42,0xbdc3c7,sx,16,sz);
})();

// Airport
(function(){
  const ax=130,az=110;
  box(100,0.2,14,0x2c3e50,ax+25,0.15,az+45);
  for(let i=-45;i<=45;i+=12) box(4,0.22,0.8,0xffffff,ax+25+i,0.22,az+45);
  box(6,22,6,0x7f8c8d,ax-15,11,az-10);
  box(8,3,8,0x34495e,ax-15,23,az-10);
})();

// Extra residential blocks & small businesses (more density)
const estateBlocks=[
  [-60,-80],[60,80],[80,-80],[-80,60],[20,120],[-20,-100],[100,40],[-110,20]
];
estateBlocks.forEach(([bx,bz])=>{
  for(let i=0;i<4;i++){
    const h=6+Math.random()*18|0;
    const g=90+Math.random()*100|0;
    const col=(g<<16)|(g<<8)|(g+20);
    const ox=(i%2?11:-11),oz=(i>1?11:-11);
    box(12,h,12,col,bx+ox,h/2,bz+oz);
    if(h>9){
      for(let wy=2.5;wy<h-1.5;wy+=3.2){
        box(1.8,1.4,0.25,0x87ceeb,bx+ox+6.2,wy,bz+oz);
        box(1.8,1.4,0.25,0x87ceeb,bx+ox-6.2,wy,bz+oz);
      }
    }
  }
  // small corner shop
  box(8,5,8,0xe67e22,bx+18,2.5,bz+18);
});

// More generic buildings on grid
[-130,-70,-10,50,110].forEach(bx=>[-130,-70,-10,50,110].forEach(bz=>{
  if(L.some(l=>Math.abs(l.x-bx)<25&&Math.abs(l.z-bz)<25))return;
  if(Math.abs(bx)<20&&Math.abs(bz)<20)return;
  for(let i=0;i<2;i++){
    const h=6+Math.random()*22|0;
    const g=95+Math.random()*85|0;
    const col=(g<<16)|(g<<8)|(g+12);
    const ox=(i?10:-10),oz=(i?10:-10);
    box(13,h,13,col,bx+ox,h/2,bz+oz);
  }
}));

// Flyovers
function makeFlyover(x,z,rotY=0){
  const g=new THREE.Group();
  [-18,0,18].forEach(ox=>{
    const p=new THREE.Mesh(new THREE.BoxGeometry(2.5,8,2.5),new THREE.MeshLambertMaterial({color:0x7f8c8d}));
    p.position.set(ox,4,0);p.castShadow=true;g.add(p);
  });
  const deck=new THREE.Mesh(new THREE.BoxGeometry(52,1.2,12),new THREE.MeshLambertMaterial({color:0x4a4a50}));
  deck.position.y=8.5;deck.castShadow=true;deck.receiveShadow=true;g.add(deck);
  [-5.5,5.5].forEach(sz=>{
    const r=new THREE.Mesh(new THREE.BoxGeometry(52,1.4,0.5),new THREE.MeshLambertMaterial({color:0x95a5a6}));
    r.position.set(0,9.5,sz);g.add(r);
  });
  g.position.set(x,0,z);g.rotation.y=rotY;sc.add(g);
}
makeFlyover(0,0,0);makeFlyover(0,60,0);makeFlyover(60,0,Math.PI/2);makeFlyover(-60,0,Math.PI/2);

// Street lights
function addStreetLight(x,z){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,7,6),new THREE.MeshLambertMaterial({color:0x555555}));
  pole.position.y=3.5;g.add(pole);
  const head=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.4,0.8),new THREE.MeshLambertMaterial({color:0x333333}));
  head.position.set(0,7.1,0.6);g.add(head);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,8),new THREE.MeshBasicMaterial({color:0xffeaa7}));
  bulb.position.set(0,6.9,0.9);g.add(bulb);
  const pl=new THREE.PointLight(0xffeaa7,0.55,26,2);pl.position.set(0,6.8,0.9);g.add(pl);
  g.position.set(x,0,z);sc.add(g);
}
R.forEach(r=>{
  for(let i=-140;i<=140;i+=32){
    addStreetLight(i,r+9);addStreetLight(i,r-9);
    addStreetLight(r+9,i);addStreetLight(r-9,i);
  }
});

// Traffic lights
const lx=[],lz=[];
R.forEach(q=>R.forEach(r=>{
  [[q+9,r+9,lx],[q-9,r-9,lz]].forEach(([x,z,a])=>{
    const m=new THREE.MeshBasicMaterial({color:0x3ddc84});
    const s=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),m);
    s.position.set(x,6.5,z);sc.add(s);a.push(m);
  });
}));
function lights(){
  lx.forEach(m=>m.color.setHex(phase===0?0x3ddc84:0xff4444));
  lz.forEach(m=>m.color.setHex(phase===1?0x3ddc84:0xff4444));
}
lights();

// ========== HUMAN + VEHICLE MODELS ==========
function makeHuman(skin=0xdb9a6a,shirt=0x3498db,pants=0x2c3e50,scale=1,isWorker=false){
  const g=new THREE.Group();
  const mat=c=>new THREE.MeshLambertMaterial({color:c});
  [-0.32,0.32].forEach(x=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.4*scale,1.25*scale,0.4*scale),mat(pants));
    leg.position.set(x*scale,0.62*scale,0);g.add(leg);
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.05*scale,1.35*scale,0.55*scale),mat(shirt));
  body.position.y=1.85*scale;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.4*scale,8,8),mat(skin));
  head.position.y=2.9*scale;g.add(head);
  [-0.65,0.65].forEach(x=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.3*scale,1.1*scale,0.3*scale),mat(shirt));
    arm.position.set(x*scale,1.8*scale,0);g.add(arm);
  });
  if(isWorker){
    const hat=new THREE.Mesh(new THREE.CylinderGeometry(0.48*scale,0.52*scale,0.32*scale,8),mat(0xf1c40f));
    hat.position.y=3.35*scale;g.add(hat);
  }
  const mk=new THREE.Mesh(new THREE.ConeGeometry(0.8*scale,1.6*scale,8),new THREE.MeshBasicMaterial({color:0xffffff}));
  mk.rotation.x=Math.PI;mk.position.y=5*scale;mk.visible=false;g.add(mk);
  sc.add(g);
  return {g,mk};
}

function car(c,scale=1,type="car"){
  const g=new THREE.Group();
  const b=(w,h,d,col,y,z=0)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w*scale,h*scale,d*scale),new THREE.MeshLambertMaterial({color:col}));
    m.position.set(0,y*scale,z*scale);m.castShadow=true;g.add(m);
  };
  if(type==="bike"){
    b(0.9,0.7,2.4,c,0.7);
    b(0.5,0.5,0.8,0x222,1.3,0.3);
    [-0.9,0.9].forEach(z=>{
      const w=new THREE.Mesh(new THREE.CylinderGeometry(0.35*scale,0.35*scale,0.2*scale,10),new THREE.MeshLambertMaterial({color:0x111}));
      w.rotation.z=Math.PI/2;w.position.set(0,0.35*scale,z*scale);g.add(w);
    });
  }else{
    b(3.1,1.05,5.8,c,0.95);
    b(2.6,0.95,3.0,0x222831,1.95,-0.15);
    [-1.25,1.25].forEach(x=>[-1.95,1.95].forEach(z=>{
      const w=new THREE.Mesh(new THREE.CylinderGeometry(0.42*scale,0.42*scale,0.38*scale,8),new THREE.MeshLambertMaterial({color:0x111}));
      w.rotation.z=Math.PI/2;w.position.set(x*scale,0.42*scale,z*scale);g.add(w);
    }));
  }
  sc.add(g);return g;
}

// Player starts as person
const playerHuman=makeHuman(0xdb9a6a,0x2ecc71,0x2c3e50,1.05);
playerHuman.g.position.set(0,0,0);
let P=playerHuman.g; // current visual
let playerCarMesh=null;

function setMode(m){
  mode=m;
  if(m==="walk"){
    if(playerCarMesh){playerCarMesh.visible=false}
    playerHuman.g.visible=true;
    P=playerHuman.g;
    th=P.rotation.y;
  }else{
    playerHuman.g.visible=false;
    if(!playerCarMesh){
      const def=CARS[currentCar]||CARS.taxi;
      playerCarMesh=car(def.c,1,currentCar==="okada"?"bike":"car");
    }
    playerCarMesh.visible=true;
    playerCarMesh.position.copy(playerHuman.g.position);
    playerCarMesh.rotation.y=th;
    P=playerCarMesh;
  }
}

// AI traffic
const tr=[];
function mkT(police=false){
  const ax=Math.random()<.5?"x":"z",dir=Math.random()<.5?1:-1;
  const colors=[0xe74c3c,0xecf0f1,0x2ecc71,0x95a5a6,0xf39c12,0x3498db];
  tr.push({
    g:car(police?0x1e5bff:colors[Math.random()*colors.length|0]),
    ax,dir,r:R[Math.random()*4|0],p:(Math.random()*2-1)*140,
    sp:police?16:11+Math.random()*6,police,lane:dir*3.6*(ax==="x"?1:-1)
  });
}
for(let i=0;i<22;i++)mkT(false);
mkT(true);mkT(true);mkT(true);

// Flying cars + planes (kept light)
const flyers=[];
function mkFlyer(){
  const g=car([0x00cec9,0x6c5ce7,0xfd79a8][Math.random()*3|0],0.85);
  flyers.push({g,t:Math.random()*Math.PI*2,r:80+Math.random()*55,h:24+Math.random()*16,sp:0.22+Math.random()*0.18});
}
for(let i=0;i<4;i++)mkFlyer();

const planes=[];
function mkPlane(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.4,9),new THREE.MeshLambertMaterial({color:0xecf0f1}));body.position.y=1;g.add(body);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(12,0.3,2.2),new THREE.MeshLambertMaterial({color:0x3498db}));wing.position.y=1.2;g.add(wing);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.4,2.5,1.8),new THREE.MeshLambertMaterial({color:0x2980b9}));tail.position.set(0,2.2,-3.5);g.add(tail);
  sc.add(g);
  planes.push({g,t:Math.random()*Math.PI*2,r:150+Math.random()*40,h:38+Math.random()*22,sp:0.1+Math.random()*0.07});
}
for(let i=0;i<3;i++)mkPlane();

const taxiPlane=(()=>{
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.5,1.6,11),new THREE.MeshLambertMaterial({color:0xffffff}));body.position.y=1.2;g.add(body);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(14,0.35,2.5),new THREE.MeshLambertMaterial({color:0xe74c3c}));wing.position.y=1.4;g.add(wing);
  sc.add(g);return {g,p:-30,dir:1};
})();

// NPCs
const npcs=[];
function mkN(isWorker=false){
  const shirts=[0xe74c3c,0x3498db,0xf1c40f,0x1abc9c,0xecf0f1,0x9b59b6,0xe67e22];
  const pants=[0x2c3e50,0x34495e,0x1a1a2e,0x4a4a4a];
  const skins=[0xdb9a6a,0xc68642,0x8d5524,0xf1c27d,0xffdbac];
  const h=makeHuman(skins[Math.random()*skins.length|0],isWorker?0xf39c12:shirts[Math.random()*shirts.length|0],pants[Math.random()*pants.length|0],1,isWorker);
  const t=Math.random();
  npcs.push({
    g:h.g,mk:h.mk,
    type:isWorker?"worker":(t<.14?"thief":t<.36?"pass":"cit"),
    ax:Math.random()<.5?"x":"z",
    r:R[Math.random()*4|0],
    side:Math.random()<.5?9.5:-9.5,
    p:(Math.random()*2-1)*140,
    dir:Math.random()<.5?1:-1,
    sp:1.5+Math.random()*2.1,
    wanted:false,away:0,isWorker
  });
}
for(let i=0;i<42;i++)mkN(false);
for(let i=0;i<10;i++)mkN(true);

const hide=(n,s)=>{n.g.visible=false;n.away=s;n.wanted=false};

// ========== HELPERS ==========
const onRoad=(x,z)=>Math.abs(x)<170&&Math.abs(z)<170&&(R.some(r=>Math.abs(x-r)<7.5)||R.some(r=>Math.abs(z-r)<7.5));
const onSidewalk=(x,z)=>Math.abs(x)<170&&Math.abs(z)<170; // allow walking almost everywhere
const axisGo=a=>a==="x"?phase===0:phase===1;
const zone=()=>{let b=null,bd=48;L.forEach(l=>{const d=Math.hypot(P.position.x-l.x,P.position.z-l.z);if(d<bd){bd=d;b=l}});return b};
const ZM={market:.72,watt:.78,plaza:1.45,bank:1.05,fbn:1.08,police:1,park:1.05,stadium:1.12,airport:1.3,uniuyo:1.15,shelter:1.25,ekorinim:1.2,aka:1.18,plaza2:1.35,hospital:1.1,church:1.05,fuel:1.15,works:0.95};
const price=k=>{const z=zone();return Math.max(50,Math.round(G[k][1]*wk[k]*(z?ZM[z.id]||1:1)))};
const sellP=k=>Math.floor(price(k)*(role==="trader"?1.08:role==="marketer"?1.02:0.9));
function say(t,isWarn=false){
  const e=$("toast");e.textContent=t;e.style.opacity=1;
  e.style.background=isWarn?"#f39c12":"var(--ac)";
  clearTimeout(say.t);say.t=setTimeout(()=>e.style.opacity=0,2800);hud();
}
const facing=()=>Math.abs(Math.sin(th))>Math.abs(Math.cos(th))?"x":"z";
const fmt=n=>"₦"+n.toLocaleString();

function hud(){
  let h=role?'<span class="chip">'+ROLES[role].i+" "+ROLES[role].n+"</span>":"";
  h+='<span class="chip">'+fmt(naira)+'</span><span class="chip">🏦 '+fmt(saved)+'</span>';
  if(contract.active)h+='<span class="chip">📋 '+contract.done+"/"+contract.need+(contract.stash?" · "+fmt(contract.stash):"")+"</span>";
  if(role==="thief")h+='<span class="chip">🔥 '+heat+"</span>";
  if(warnings>0)h+='<span class="chip">⚠️ '+warnings+'</span>';
  h+='<span class="chip">'+(mode==="walk"?"🚶 Walk":"🚗 Drive")+'</span>';
  h+='<span class="chip">🚦 '+(axisGo(facing())?"GO":"STOP")+"</span>";
  $("hud").innerHTML=h;
  const z=zone();let o=z?"📍 "+z.n+" | ":"";
  if(role==="driver")o+=pass?"Drop at "+pass.n+" (run pay at end)":"Find yellow passenger · 3 drops = run pay";
  else if(role==="police")o+=contract.active&&contract.done>=2?"Book at Police HQ to collect":"Arrest 2 wanted → book at HQ for pay";
  else if(role==="thief")o+=contract.stash?"Fence stash at Motor Park":"Snatch then fence at Motor Park";
  else if(role==="banker")o+="Serve 4 at bank/POS · uniform required · pay at till close";
  else if(role==="trader")o+="Buy low at markets, sell high at plazas/estates";
  else if(role==="marketer")o+=contract.active&&contract.done>=3?"Collect at AB Oil & Gas (centre)":"3 promos then collect at AB Station";
  else if(role==="worker")o+="3 tasks at AB Station / sites · then shift pay";
  $("obj").innerHTML=role?"<span>"+o+"</span>":"";
  try{localStorage.setItem("uyo2",JSON.stringify({naira,saved,inv,ownedCars,warnings}))}catch(e){}
}

function applyFine(base,reason){
  warnings++;
  let mult=1+Math.min(warnings*0.25,1.5);
  let amt=Math.min(naira,Math.round(base*mult));
  naira-=amt;
  let msg=reason+"  ⚠️ Warning #"+warnings+". Fine "+fmt(amt);
  if(warnings>=4){
    msg+="  (Multiple offences – consider changing role or driving carefully)";
  }else if(warnings>=2){
    msg+="  (Next fines will be heavier)";
  }
  say(msg,true);
  if(warnings>=6){warnings=3;say("Court caution issued. Warnings partially cleared after payment.",true)}
}

function bust(){
  const loss=Math.floor(naira*0.45);
  naira-=loss;heat=0;
  playerHuman.g.position.set(0,0,-40);
  if(playerCarMesh)playerCarMesh.position.copy(playerHuman.g.position);
  sp=0;th=0;setMode("walk");
  say("Busted by Police! Lost "+fmt(loss)+" + vehicle temporarily grounded. Walk for now.",true);
}

function near(f,d){let b=null,bd=d;npcs.forEach(n=>{if(!n.g.visible||!f(n))return;const q=Math.hypot(n.g.position.x-P.position.x,n.g.position.z-P.position.z);if(q<bd){bd=q;b=n}});return b}

function ensureContract(need){
  if(!contract.active||contract.role!==role){
    contract={role:role,done:0,need:need,stash:0,active:true};
  }
}
function finishContract(pay,msg){
  naira+=pay;
  contract={role:null,done:0,need:0,stash:0,active:false};
  say(msg+" Session pay "+fmt(pay));
}

function act(){
  if(!role||Date.now()<cool)return;cool=Date.now()+480;
  const z=zone();
  if(role==="driver"){
    ensureContract(3);
    if(!pass){
      const n=near(n=>n.type==="pass",13);
      if(!n)return say("No passenger close. Look for yellow markers");
      hide(n,9);
      const d=L.filter(l=>!z||l.id!==z.id);
      pass=d[Math.random()*d.length|0];
      say("Passenger wants "+pass.n+". ("+(contract.done+1)+"/"+contract.need+" of this run)");
    }else if(z&&z.id===pass.id){
      pass=null;
      contract.done++;
      contract.stash+=1800+Math.round(Math.random()*1600);
      if(contract.done>=contract.need){
        finishContract(contract.stash,"Run complete ("+contract.need+" drops).");
      }else say("Drop done. "+contract.done+"/"+contract.need+" — keep driving for full run pay.");
    }else say("Drop point is still "+pass.n);
  }
  else if(role==="police"){
    ensureContract(2);
    const w=near(n=>n.wanted,14);
    if(w){
      hide(w,11);
      contract.done++;
      contract.stash+=3200;
      if(contract.done>=contract.need){
        if(z&&z.id==="police"){
          finishContract(contract.stash,"Suspects booked at HQ.");
        }else{
          say("Arrested "+contract.done+"/"+contract.need+". Go to Police HQ and ACT to book & collect pay.");
          contract.need=contract.done; // hold until HQ
        }
      }else say("Arrest logged "+contract.done+"/"+contract.need+". Need another suspect.");
      return;
    }
    if(contract.active&&contract.done>=2&&z&&z.id==="police"){
      finishContract(Math.max(contract.stash,5000),"Booked at HQ.");
      return;
    }
    if(near(()=>true,9)){applyFine(1200,"Wrong person arrested");return}
    say("No suspect nearby. Chase red markers — pay only after booking at HQ.");
  }
  else if(role==="thief"){
    ensureContract(3);
    if(z&&z.id==="park"&&contract.stash>0){
      const pay=contract.stash;
      heat=Math.max(0,heat-25);
      finishContract(pay,"Fenced goods at Motor Park.");
      return;
    }
    const v=near(n=>n.type!=="thief",9);
    if(!v)return say(contract.stash?"Fence your stash at Motor Park (ACT there)":"Get closer to a citizen");
    const g=600+Math.random()*1800|0;
    contract.stash+=g;heat=Math.min(100,heat+22);hide(v,7);
    contract.done++;
    say("Stash now "+fmt(contract.stash)+". Heat "+heat+". Fence at Motor Park to cash out.");
    if(heat>=100)bust();
  }
  else if(role==="banker"){
    if(!(inv.uniform>0))return say("Buy a Station uniform from the shop before POS/bank duty");
    ensureContract(4);
    if(z&&(z.id==="bank"||z.id==="fbn")){
      contract.done++;
      contract.stash+=900+Math.random()*500|0;
      if(contract.done>=contract.need){
        finishContract(contract.stash,"Till closed after "+contract.need+" customers.");
      }else say("Customer served "+contract.done+"/"+contract.need+". Keep working the desk.");
    }else say("Go to Uyo Bank HQ or First Bank + POS to serve.");
  }
  else if(role==="trader"){openShop()}
  else if(role==="marketer"){
    const hasTools=inv.poster>0||inv.megaphone>0;
    if(!hasTools)return say("Buy AB posters or megaphone from shop first");
    ensureContract(3);
    if(z&&(z.id==="fuel"||z.id==="charge")&&contract.done>=contract.need&&contract.stash>0){
      finishContract(contract.stash,"Campaign reported at AB Station.");
      return;
    }
    const busy=z&&["market","watt","plaza","plaza2","park","stadium","uniuyo","shelter","etinan","fuel"].includes(z.id);
    let earn=500+Math.random()*700|0;
    if(busy)earn=Math.round(earn*1.6);
    if(inv.megaphone>0)earn=Math.round(earn*1.25);
    if(inv.poster>0){inv.poster--;earn+=350}
    contract.done++;
    contract.stash+=earn;
    if(contract.done>=contract.need){
      say("3 promos logged. Go to AB Oil & Gas (centre) and ACT to collect campaign pay ("+fmt(contract.stash)+").");
    }else say((busy?"Busy spot. ":"")+"Promo "+contract.done+"/"+contract.need+". Stash "+fmt(contract.stash));
  }
  else if(role==="worker"){
    ensureContract(3);
    const sites=["fuel","charge","stadium","works","airport","shelter","ekorinim","aka"];
    if(z&&sites.includes(z.id)){
      contract.done++;
      contract.stash+=1100+Math.random()*900|0;
      if(inv.uniform>0)contract.stash+=200;
      if(contract.done>=contract.need){
        finishContract(contract.stash,"Shift ended at "+z.n+".");
      }else say("Task "+contract.done+"/"+contract.need+" at "+z.n+". Finish shift for wage.");
    }else say("Work at AB Station, Charging desk, Stadium, Works, Airport or estates.");
  }
}

// ========== SHOP (location-aware) ==========
function shopR(){
  const z=zone();
  let title=z?z.n:"Roadside / Street stall";
  let h="<h3>🛒 "+title+"</h3><p>"+fmt(naira)+" cash | Savings "+fmt(saved)+"</p>";
  if(role==="worker"&&z&&["stadium","works","airport"].includes(z.id)){
    h+="<p><b>Work site shop</b> – tools & energy drinks available</p>";
  }
  if(role==="marketer")h+="<p>📢 Marketing tools help you earn more on the street</p>";
  Object.keys(G).forEach(k=>{
    h+='<div class="row"><span>'+G[k][0]+"<br><small>Buy "+fmt(price(k))+" | Sell "+fmt(sellP(k))+" | Own "+inv[k]+'</small></span><span><button data-a="b" data-g="'+k+'">Buy</button><button data-a="s" data-g="'+k+'">Sell</button></span></div>';
  });
  h+='<div class="row"><span><button data-a="sv">Save ₦5,000</button><button data-a="wd">Withdraw all</button></span><button data-a="x">Close</button></div>';
  h+='<small>Prices change by location. Markets cheaper, plazas & estates more expensive. Savings grow ~3% every 20s.</small>';
  $("shop").innerHTML=h;
}
function openShop(){$("shop").style.display="block";$("garage").style.display="none";$("travel").style.display="none";shopR()}
$("shop").addEventListener("click",e=>{
  const a=e.target.dataset.a,g=e.target.dataset.g;if(!a)return;
  if(a==="x")$("shop").style.display="none";
  else if(a==="b"){const p=price(g);if(naira>=p){naira-=p;inv[g]++;say("Bought "+G[g][0])}else say("Not enough Naira",true)}
  else if(a==="s"){if(inv[g]>0){inv[g]--;naira+=sellP(g);say("Sold for "+fmt(sellP(g)))}else say("You own none")}
  else if(a==="sv"){if(naira>=5000){naira-=5000;saved+=5000;say("Saved ₦5,000")}else say("Need ₦5,000",true)}
  else if(a==="wd"){naira+=saved;saved=0;say("Withdrew all savings")}
  shopR();hud();
});

// ========== GARAGE – buy / switch cars ==========
function garageR(){
  let h="<h3>🚗 Garage & Vehicles</h3><p>"+fmt(naira)+" | Current: "+(CARS[currentCar||"none"].n)+"</p>";
  Object.keys(CARS).forEach(k=>{
    if(k==="police")return;
    const c=CARS[k];
    const own=ownedCars.includes(k);
    h+='<div class="row"><span><b>'+c.n+'</b><br><small>Speed '+c.s+(own?"":" | "+fmt(c.price))+'</small></span><span>';
    if(own){
      h+='<button data-a="use" data-c="'+k+'">'+(currentCar===k||(k==="none"&&mode==="walk")?"Using":"Select")+'</button>';
    }else if(c.price>0){
      h+='<button data-a="buy" data-c="'+k+'">Buy</button>';
    }
    h+='</span></div>';
  });
  h+='<div class="row"><button data-a="x">Close</button></div>';
  h+='<small>Walk freely on sidewalks. Cars are faster but must stay on roads & obey lights.</small>';
  $("garage").innerHTML=h;
}
function openGarage(){$("garage").style.display="block";$("shop").style.display="none";$("travel").style.display="none";garageR()}
$("garage").addEventListener("click",e=>{
  const a=e.target.dataset.a,c=e.target.dataset.c;if(!a)return;
  if(a==="x")$("garage").style.display="none";
  else if(a==="buy"){
    const car=CARS[c];
    if(naira>=car.price){
      naira-=car.price;ownedCars.push(c);currentCar=c;
      if(playerCarMesh){sc.remove(playerCarMesh);playerCarMesh=null}
      setMode(c==="none"?"walk":"drive");
      say("Purchased "+car.n+"!");
    }else say("Need "+fmt(car.price),true);
  }
  else if(a==="use"){
    currentCar=c;
    if(playerCarMesh){sc.remove(playerCarMesh);playerCarMesh=null}
    setMode(c==="none"?"walk":"drive");
    say("Now using "+CARS[c].n);
  }
  garageR();hud();
});

// ========== TRAVEL ==========
function travelR(){
  let h="<h3>✈️ Travel around Uyo</h3><p>Quick ride (costs fuel money)</p>";
  L.forEach(l=>{
    h+='<div class="row"><span>'+l.n+'</span><button data-a="go" data-id="'+l.id+'">Go ₦1,200</button></div>';
  });
  h+='<div class="row"><button data-a="x">Close</button></div><small>Instant travel to major landmarks. Useful for trader / worker / marketer routes.</small>';
  $("travel").innerHTML=h;
}
function openTravel(){$("travel").style.display="block";$("shop").style.display="none";$("garage").style.display="none";travelR()}
$("travel").addEventListener("click",e=>{
  const a=e.target.dataset.a,id=e.target.dataset.id;if(!a)return;
  if(a==="x")$("travel").style.display="none";
  else if(a==="go"){
    if(naira<1200)return say("Need ₦1,200 for the ride",true);
    naira-=1200;
    const dest=L.find(l=>l.id===id);
    if(dest){
      playerHuman.g.position.set(dest.x+18,0,dest.z+18);
      if(playerCarMesh)playerCarMesh.position.copy(playerHuman.g.position);
      P.position.copy(playerHuman.g.position);
      say("Arrived at "+dest.n);
    }
    $("travel").style.display="none";
  }
  hud();
});

// Roles UI
function roleUI(){
  let h="<h2>Uyo Streets × AB Oil & Gas 🇳🇬</h2><small>Walk or drive Uyo &amp; Etinan. Pay comes in <b>sessions</b> (finish the contract), not every ACT. Buy tools in Shop when a role needs them. ACT = Space / E.</small>";
  Object.keys(ROLES).forEach(k=>{
    const r=ROLES[k];
    h+='<button class="card" data-r="'+k+'"><b>'+r.i+" "+r.n+"</b><br>"+r.d+"</button>";
  });
  $("roles").innerHTML=h;$("roles").style.display="flex";
}
$("roles").addEventListener("click",e=>{
  const c=e.target.closest("[data-r]");if(!c)return;
  role=c.dataset.r;pass=null;heat=0;warnings=Math.max(0,warnings-1);
  contract={role:null,done:0,need:0,stash:0,active:false};
  // colour player shirt
  if(playerHuman.g.children[2])playerHuman.g.children[2].material.color.setHex(ROLES[role].c);
  $("roles").style.display="none";hud();
  say("You are now a "+ROLES[role].n+". Complete the full session before you get paid.");
});
$("bRole").onclick=roleUI;
$("bShop").onclick=openShop;
$("bAct").onclick=act;
$("bGarage").onclick=openGarage;
$("bTravel").onclick=openTravel;

// Controls
const k={l:0,r:0,u:0,d:0};
document.querySelectorAll("#bar [data-k]").forEach(b=>{
  const q=b.dataset.k;
  b.addEventListener("pointerdown",e=>{e.preventDefault();k[q]=1});
  ["pointerup","pointerleave","pointercancel"].forEach(v=>b.addEventListener(v,()=>k[q]=0));
});
const KM={ArrowLeft:"l",a:"l",ArrowRight:"r",d:"r",ArrowUp:"u",w:"u",ArrowDown:"d",s:"d"};
addEventListener("keydown",e=>{if(KM[e.key])k[KM[e.key]]=1;if(e.key===" "||e.key==="e")act()});
addEventListener("keyup",e=>{if(KM[e.key])k[KM[e.key]]=0});

// 1s tick
setInterval(()=>{
  if(!role)return;T++;
  heat=Math.max(0,heat-2.5);
  if(T%9===0){phase^=1;lights()}
  if(T%20===0)saved=Math.round(saved*1.03);
  if(T%8===0&&npcs.filter(n=>n.wanted).length<2){
    const c=npcs.filter(n=>n.type==="thief"&&n.g.visible&&!n.wanted);
    if(c.length)c[Math.random()*c.length|0].wanted=true;
  }
  if(T%10===0){Object.keys(wk).forEach(g=>wk[g]=.75+Math.random()*.5)}
  if(role!=="thief"&&role!=="police"){
    const t=near(n=>n.wanted,5.5);
    if(t&&naira>0){
      const l=Math.min(naira,800+Math.random()*600|0);
      naira-=l;hide(t,6);say("Pickpocketed! -"+fmt(l),true);
    }
  }
  if(role==="thief"&&heat>38&&tr.some(c=>c.police&&Math.hypot(c.g.position.x-P.position.x,c.g.position.z-P.position.z)<18))bust();
  if($("shop").style.display==="block")shopR();
  hud();
},1000);

// Loop
function rs(){const a=$("app");rd.setSize(a.clientWidth,a.clientHeight);cam.aspect=a.clientWidth/a.clientHeight;cam.updateProjectionMatrix()}
addEventListener("resize",rs);rs();
const clk=new THREE.Clock();

function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,clk.getDelta());

  if(role){
    const mx=mode==="walk"?9:(CARS[currentCar]||CARS.taxi).s;
    th+=(k.l-k.r)*2.4*dt;
    if(k.u)sp=Math.min(mx,sp+38*dt);
    else if(k.d)sp=Math.max(-mx*.35,sp-55*dt);
    else sp-=Math.sign(sp)*Math.min(Math.abs(sp),22*dt);

    let x=P.position.x,z=P.position.z;
    let nx=x+Math.sin(th)*sp*dt,nz=z+Math.cos(th)*sp*dt,mv=false;

    if(mode==="walk"){
      if(onSidewalk(nx,z)){x=nx;mv=true}
      if(onSidewalk(x,nz)){z=nz;mv=true}
    }else{
      if(onRoad(nx,z)){x=nx;mv=true}
      if(onRoad(x,nz)){z=nz;mv=true}
      if(!mv)sp*=0.6;
    }
    if(!mv&&mode==="drive")sp=0;
    P.position.set(x,0,z);P.rotation.y=th;
    // keep human & car in sync
    playerHuman.g.position.set(x,0,z);playerHuman.g.rotation.y=th;
    if(playerCarMesh){playerCarMesh.position.set(x,0,z);playerCarMesh.rotation.y=th}

    fineCd-=dt;
    if(mode==="drive"&&role!=="police"&&fineCd<=0&&sp>7&&R.some(q=>Math.abs(x-q)<7.5)&&R.some(q=>Math.abs(z-q)<7.5)&&!axisGo(facing())){
      fineCd=3.5;
      applyFine(900,"Ran a red light!");
    }
  }else th+=.003;

  const px=P.position.x,pz=P.position.z;
  const camDist=mode==="walk"?16:26;
  const camH=mode==="walk"?12:18;
  cam.position.lerp(new THREE.Vector3(px-Math.sin(th)*camDist,camH,pz-Math.cos(th)*camDist),.12);
  cam.lookAt(px+Math.sin(th)*8,2.5,pz+Math.cos(th)*8);

  // AI cars
  tr.forEach(c=>{
    let s=c.sp*dt;
    for(const q of R){const a=(q-c.p)*c.dir;if(a>7&&a<11&&!axisGo(c.ax))s=0}
    c.p+=c.dir*s;if(Math.abs(c.p)>155)c.p=-c.dir*155;
    if(c.ax==="x"){c.g.position.set(c.p,0,c.r+c.lane);c.g.rotation.y=c.dir>0?Math.PI/2:-Math.PI/2}
    else{c.g.position.set(c.r+c.lane,0,c.p);c.g.rotation.y=c.dir>0?0:Math.PI}
  });

  flyers.forEach(f=>{
    f.t+=f.sp*dt;
    f.g.position.set(Math.cos(f.t)*f.r,f.h,Math.sin(f.t)*f.r);
    f.g.rotation.y=-f.t+Math.PI/2;
  });
  planes.forEach(p=>{
    p.t+=p.sp*dt;
    p.g.position.set(Math.cos(p.t)*p.r,p.h,Math.sin(p.t)*p.r);
    p.g.rotation.y=-p.t+Math.PI/2;
    p.g.rotation.z=Math.sin(p.t*2)*0.07;
  });
  taxiPlane.p+=taxiPlane.dir*11*dt;
  if(taxiPlane.p>60)taxiPlane.dir=-1;
  if(taxiPlane.p<-40)taxiPlane.dir=1;
  taxiPlane.g.position.set(130+taxiPlane.p,0,155);
  taxiPlane.g.rotation.y=taxiPlane.dir>0?Math.PI/2:-Math.PI/2;

  npcs.forEach(n=>{
    if(n.away>0){n.away-=dt;if(n.away<=0){n.g.visible=true;n.p=(Math.random()*2-1)*130}return}
    n.p+=n.dir*n.sp*dt;
    if(Math.abs(n.p)>145)n.dir*=-1;
    if(n.ax==="x")n.g.position.set(n.p,0,n.r+n.side);
    else n.g.position.set(n.r+n.side,0,n.p);
    n.g.position.y=Math.sin(T*3+n.p)*0.035;
    const sd=role==="driver"&&!pass&&n.type==="pass";
    const sw=role==="police"&&n.wanted;
    n.mk.visible=sd||sw;
    n.mk.material.color.setHex(sw?0xff2222:0xffd23f);
  });

  rd.render(sc,cam);
}
loop();hud();roleUI();
