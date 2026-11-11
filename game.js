(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),mini=document.getElementById('minimap'),mctx=mini.getContext('2d');
const W=3920, STEP=560, ROAD=112, SIDE=15, MAX=5;
const ui={cash:document.getElementById('cash'),title:document.getElementById('mission-title'),copy:document.getElementById('mission-copy'),status:document.getElementById('mission-status'),dist:document.getElementById('distance'),progress:document.getElementById('mission-progress'),stars:document.getElementById('stars'),note:document.getElementById('wanted-note'),speed:document.getElementById('speed'),gear:document.getElementById('gear'),speedometer:document.getElementById('speedometer'),toast:document.getElementById('toast'),intro:document.getElementById('intro'),hint:document.getElementById('controls-hint')};
let vw=innerWidth,vh=innerHeight,dpr=1,camera={x:1500,y:1500},time=0,last=0,started=false,paused=false,sfx=true,toastTimer=0;
const keys=new Set(), buildings=[],props=[],cars=[],pedestrians=[],particles=[];
let cash=2450,wanted=0,wantedTimer=0,missionStage=0,deliveryTarget={x:2800,y:2000},pickup={x:1770,y:1425},player={x:1458,y:1434,angle:0,speed:0,walking:true,health:100,invuln:0};
let audio=null;
const colors=['#d34a40','#e4bd42','#457aa0','#e8e5d7','#3e9b86','#733e72','#d77d43','#5d6871','#a8c35a','#242a2c'];
function resize(){dpr=Math.min(devicePixelRatio||1,2);vw=innerWidth;vh=innerHeight;canvas.width=Math.floor(vw*dpr);canvas.height=Math.floor(vh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(vw<720)document.body.classList.add('mobile');else document.body.classList.remove('mobile')}
addEventListener('resize',resize);resize();
function rng(seed){let n=seed>>>0;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296}}
function makeCity(){
 const roof=['#69746c','#776d62','#65736d','#837970','#6c7277','#877665','#67736f'];
 for(let gy=0;gy<6;gy++)for(let gx=0;gx<6;gx++){const r=rng(gx*917+gy*2713+71),left=280+gx*STEP+ROAD/2+SIDE+14,top=280+gy*STEP+ROAD/2+SIDE+14,right=280+(gx+1)*STEP-ROAD/2-SIDE-14,bottom=280+(gy+1)*STEP-ROAD/2-SIDE-14,bw=right-left,bh=bottom-top;
  const park=(gx===2&&gy===3)||(gx===5&&gy===1)||(gx===1&&gy===5);
  props.push({type:park?'park':'block',x:left,y:top,w:bw,h:bh,seed:gx*19+gy*41});
  if(park){for(let i=0;i<9;i++)props.push({type:'tree',x:left+25+r()*Math.max(1,bw-50),y:top+25+r()*Math.max(1,bh-50),s:7+r()*6});continue}
  const nx=bw>320?2:1,ny=bh>320?2:1,gap=15;
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){let cellW=(bw-gap*(nx+1))/nx,cellH=(bh-gap*(ny+1))/ny;let x=left+gap+ix*(cellW+gap)+r()*7,y=top+gap+iy*(cellH+gap)+r()*7,w=cellW-r()*10,h=cellH-r()*10;
   if(r()<.1){props.push({type:'yard',x,y,w,h});continue}
   const b={x,y,w,h,roof:roof[Math.floor(r()*roof.length)],seed:Math.floor(r()*10000),height:1+r()*2,kind:r()<.25?'shop':'building'};buildings.push(b);
   // Rooftop details
   for(let j=0;j<1+Math.floor(r()*4);j++)props.push({type:'unit',x:x+12+r()*Math.max(4,w-38),y:y+12+r()*Math.max(4,h-32),w:12+r()*14,h:9+r()*12});
  }
 }
 // Static parked cars tucked along sidewalks and lanes
 for(let row=0;row<7;row++)for(let col=0;col<7;col++){
  const r=rng(881+row*313+col*119);let cx=280+col*STEP,cy=280+row*STEP;
  if(r()<.8){let side=r()<.5?-1:1;cars.push({x:cx+side*(ROAD/2+20),y:cy-35-r()*24,angle:Math.PI/2,speed:0,color:colors[Math.floor(r()*colors.length)],parked:true});}
  if(r()<.66){let side=r()<.5?-1:1;cars.push({x:cx+38+r()*22,y:cy+side*(ROAD/2+20),angle:0,speed:0,color:colors[Math.floor(r()*colors.length)],parked:true});}
 }
 // Moving cross-town traffic
 for(let i=0;i<15;i++){const r=rng(311+i*773);let horizontal=i<9, lane=i%2? -24:24;let row=Math.floor(i/2)%7;cars.push({x:r()*W,y:280+row*STEP+lane,angle:horizontal?(i%3===0?Math.PI:0):(i%3===0?-Math.PI/2:Math.PI/2),speed:horizontal?(i%3===0?-1:1)*(33+r()*18):(i%3===0?-1:1)*(32+r()*20),color:colors[Math.floor(r()*colors.length)],ai:true,phase:r()*6});}
}
makeCity();
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function showToast(text,duration=2400){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=duration}
function setWanted(value){wanted=clamp(value,0,MAX);wantedTimer=15+value*9;updateWanted()}
function updateWanted(){ui.stars.innerHTML=Array.from({length:MAX},(_,i)=>`<span class="${i<wanted?'active':''}">${i<wanted?'★':'☆'}</span>`).join(' ');ui.note.textContent=wanted?'POLICE ARE LOOKING FOR YOU':'KEEP A LOW PROFILE'}
function randomizeJob(){const candidates=[{x:2800,y:2000},{x:3500,y:1500},{x:900,y:3300},{x:2600,y:3500},{x:800,y:800}];deliveryTarget=candidates[Math.floor(Math.random()*candidates.length)]}
function startGame(){started=true;ui.intro.classList.add('hidden');showToast('Find a ride. Make it count.',3000);if(!audio&&sfx){try{audio=new(window.AudioContext||window.webkitAudioContext)()}catch{}}}
document.getElementById('start-button').addEventListener('click',startGame);
function tone(freq=440,duration=.08,type='sine',volume=.025){if(!sfx||!audio)return;let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}
document.getElementById('sound-button').onclick=()=>{sfx=!sfx;document.querySelector('#sound-button span').textContent=sfx?'SOUND ON':'SOUND OFF';if(sfx){if(!audio)try{audio=new(window.AudioContext||window.webkitAudioContext)()}catch{}tone(660)}};
function keyDown(e){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();let k=e.key.toLowerCase();keys.add(k);if(k==='e'&&!e.repeat)interact();if(k===' '&&!e.repeat)boost();if(k==='escape')paused=!paused}
function keyUp(e){keys.delete(e.key.toLowerCase())}
addEventListener('keydown',keyDown);addEventListener('keyup',keyUp);addEventListener('blur',()=>keys.clear());
for(const b of document.querySelectorAll('[data-key]')){const k=b.dataset.key.toLowerCase();b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(k);b.setPointerCapture(e.pointerId)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(k))}
document.querySelector('[data-action="interact"]').addEventListener('pointerdown',e=>{e.preventDefault();interact()});document.querySelector('[data-action="boost"]').addEventListener('pointerdown',e=>{e.preventDefault();boost()});
function interact(){if(!started)return;
 if(player.walking){let nearest=null,nd=68;for(const c of cars){const d=dist(player,c);if(!c.ai&&d<nd){nearest=c;nd=d}}if(nearest){player.walking=false;player.car=nearest;nearest.player=true;nearest.parked=false;player.x=nearest.x;player.y=nearest.y;player.angle=nearest.angle;showToast('Vehicle acquired · keep moving',1800);setWanted(Math.max(1,wanted));tone(240,.12,'square');}else showToast('Get closer to a vehicle',1300)}
 else{const c=player.car;player.walking=true;player.x=c.x+Math.cos(c.angle+Math.PI/2)*32;player.y=c.y+Math.sin(c.angle+Math.PI/2)*32;player.angle=c.angle;player.speed=0;c.player=false;c.parked=true;player.car=null;showToast('On foot · find the marker',1500);tone(330,.08)}
}
function boost(){if(!player.walking){player.speed*=1.28;player.speed=clamp(player.speed,-130,250);tone(180,.1,'sawtooth',.015)}}
function circleRect(x,y,r,b){const nx=clamp(x,b.x,b.x+b.w),ny=clamp(y,b.y,b.y+b.h);return Math.hypot(x-nx,y-ny)<r}
function onRoad(x,y){const a=Math.abs((x-280+STEP/2)%STEP-STEP/2),b=Math.abs((y-280+STEP/2)%STEP-STEP/2);return a<ROAD/2+SIDE+4||b<ROAD/2+SIDE+4}
function blocked(x,y,r){if(x<12||y<12||x>W-12||y>W-12)return true;for(const b of buildings)if(circleRect(x,y,r,b))return true;return false}
function update(dt){time+=dt;if(!started||paused)return;
 for(const c of cars){if(c.ai){c.x+=Math.cos(c.angle)*c.speed*dt;c.y+=Math.sin(c.angle)*c.speed*dt;if(c.x<-30)c.x=W+25;if(c.x>W+30)c.x=-25;if(c.y<-30)c.y=W+25;if(c.y>W+30)c.y=-25;}}
 const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright'),sprint=keys.has('shift');
 if(player.walking){let dx=(right?1:0)-(left?1:0),dy=(down?1:0)-(up?1:0);if(dx||dy){let l=Math.hypot(dx,dy);dx/=l;dy/=l;let sp=sprint?210:145,nx=player.x+dx*sp*dt,ny=player.y+dy*sp*dt;if(!blocked(nx,player.y,10))player.x=nx;if(!blocked(player.x,ny,10))player.y=ny;player.angle=Math.atan2(dy,dx)}
 }else if(player.car){let c=player.car;let throttle=(up?1:0)-(down?1:0),steer=(right?1:0)-(left?1:0);c.speed+=throttle*(sprint?205:150)*dt;c.speed*=Math.pow(.985,dt*60);c.speed=clamp(c.speed,-105,190);if(Math.abs(c.speed)<2)c.speed=0;c.angle+=steer*clamp(c.speed/85,-1.15,1.15)*1.8*dt;let nx=c.x+Math.cos(c.angle)*c.speed*dt,ny=c.y+Math.sin(c.angle)*c.speed*dt;
  if(blocked(nx,ny,18)){c.speed*=-.2;cash=Math.max(0,cash-5);ui.cash.textContent='$'+cash.toLocaleString();tone(90,.12,'square',.03)}else{c.x=nx;c.y=ny}
  // Small impacts with traffic push both vehicles aside.
  for(const other of cars){if(other===c||other.player||!other.ai)continue;if(dist(c,other)<28){c.speed*=.68;other.x+=Math.cos(c.angle+1.4)*12;other.y+=Math.sin(c.angle+1.4)*12;setWanted(Math.max(1,wanted));}}
 }
 if(player.invuln>0)player.invuln-=dt;
 if(wanted>0){wantedTimer-=dt;if(wantedTimer<=0){wanted--;wantedTimer=15+wanted*9;updateWanted();if(!wanted)showToast('You lost the heat.',2200)}}
 // Police pursuit is triggered by a wanted level and chases the player from the edge of view.
 if(wanted>0&&!cars.some(c=>c.police)){const p={x:clamp(player.x+450,100,W-100),y:clamp(player.y-350,100,W-100)};cars.push({x:p.x,y:p.y,angle:Math.atan2(player.y-p.y,player.x-p.x),speed:0,color:'#e9e9dc',ai:false,police:true,flash:0})}
 for(const c of cars.filter(c=>c.police)){let target=player.walking?player:(player.car||player);let a=Math.atan2(target.y-c.y,target.x-c.x),delta=Math.atan2(Math.sin(a-c.angle),Math.cos(a-c.angle));c.angle+=clamp(delta,-1.6*dt,1.6*dt);c.speed=90+wanted*17;c.x+=Math.cos(c.angle)*c.speed*dt;c.y+=Math.sin(c.angle)*c.speed*dt;c.flash+=dt*8;if(dist(c,target)<38){if(player.invuln<=0){player.health-=9;player.invuln=1.2;setWanted(wanted);showToast('Police are closing in!',1000);tone(130,.2,'sawtooth');if(player.health<=0){player.health=100;cash=Math.max(0,cash-250);wanted=0;updateWanted();if(!player.walking)interact();player.x=1458;player.y=1434;showToast('Busted · bail paid $250',2600)}}}}
 if(player.walking&&wanted>0&&cars.filter(c=>c.police).every(c=>dist(c,player)>540)){wantedTimer-=dt*.55}
 updateMission(dt);camera.x+=(player.x-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-camera.y)*Math.min(1,dt*5);if(toastTimer>0){toastTimer-=dt*1000;if(toastTimer<=0)ui.toast.classList.remove('show')}
 ui.cash.textContent='$'+cash.toLocaleString();let speed=player.walking?0:Math.round(Math.abs(player.speed)*.72);ui.speed.textContent=String(speed).padStart(3,'0');ui.gear.textContent=player.walking?'P':Math.abs(player.speed)<2?'N':player.speed<0?'R':'D';ui.speedometer.classList.toggle('visible',!player.walking);
}
function updateMission(dt){let target=missionStage===0?pickup:deliveryTarget,d=dist(player,target);ui.dist.textContent=Math.round(d)+' M';ui.progress.style.width=(missionStage===0?'0%':'58%');if(d<43){if(missionStage===0){missionStage=1;ui.title.textContent='DROP IT OFF';ui.copy.textContent='Package secured. Lose the tail and deliver it.';ui.status.textContent='DELIVER THE PACKAGE';ui.progress.style.width='58%';setWanted(Math.max(wanted,1));showToast('Package secured · police alerted',2600);tone(620,.16)}else{missionStage=0;cash+=1250+Math.max(0,500-wanted*100);ui.title.textContent='A QUICK FAVOR';ui.copy.textContent='Pick up the package. Keep it quiet.';ui.status.textContent='GO TO THE PICKUP';ui.progress.style.width='0%';pickup={x:2800,y:2000};randomizeJob();showToast('Delivery complete · payment received',2800);tone(800,.16);setWanted(Math.max(0,wanted-1))}}}
function visible(x,y,p=80){return Math.abs(x-camera.x)<vw/2+ p&&Math.abs(y-camera.y)<vh/2+p}
function draw(){ctx.clearRect(0,0,vw,vh);let zoom=clamp(vw/1050,.64,1);ctx.save();ctx.translate(vw/2,vh/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);ctx.fillStyle='#667463';ctx.fillRect(0,0,W,W);
 // subtle ground texture
 const x0=Math.floor((camera.x-vw/zoom)/96)*96,y0=Math.floor((camera.y-vh/zoom)/96)*96;for(let x=x0;x<camera.x+vw/zoom;x+=96)for(let y=y0;y<camera.y+vh/zoom;y+=96){let n=((x*7+y*13)%19+19)%19;ctx.fillStyle=n%2?'rgba(234,232,189,.035)':'rgba(18,30,24,.04)';ctx.fillRect(x+12,y+18,2,2)}
 drawRoads(zoom);drawBlocks();drawMarkers();
 for(const c of cars)if(visible(c.x,c.y,70))drawCar(c);
 if(player.walking&&visible(player.x,player.y,50))drawPlayer();
 for(const p of particles){p.x+=p.vx*.016;p.y+=p.vy*.016;p.life-=.016;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;particles.splice(0,particles.length,...particles.filter(p=>p.life>0));
 ctx.restore();drawMinimap();requestAnimationFrame(frame)}
function drawRoads(zoom){let left=camera.x-vw/zoom/2-160,right=camera.x+vw/zoom/2+160,top=camera.y-vh/zoom/2-160,bottom=camera.y+vh/zoom/2+160;
 for(let i=0;i<7;i++){let p=280+i*STEP;if(p>left&&p<right){ctx.fillStyle='#9b9c84';ctx.fillRect(p-(ROAD/2+SIDE),top,ROAD+SIDE*2,bottom-top);ctx.fillStyle='#2d3433';ctx.fillRect(p-ROAD/2,top,ROAD,bottom-top);ctx.fillStyle='#68716b';ctx.fillRect(p-ROAD/2+5,top,ROAD-10,bottom-top);ctx.fillStyle='rgba(236,230,190,.48)';for(let y=Math.floor(top/45)*45;y<bottom;y+=45){ctx.fillRect(p-2,y,4,22)}
  for(let j=0;j<7;j++){let q=280+j*STEP;if(q>top-100&&q<bottom+100){ctx.fillStyle='#e2dfc8';for(let k=-4;k<=4;k++){ctx.fillRect(p-ROAD/2+8+k*11,q-ROAD/2+7,6,25);ctx.fillRect(p-ROAD/2+8+k*11,q+ROAD/2-32,6,25);ctx.fillRect(q-ROAD/2+7,p-ROAD/2+8+k*11,25,6);ctx.fillRect(q+ROAD/2-32,p-ROAD/2+8+k*11,25,6)}ctx.fillStyle='#a1a28e';ctx.fillRect(p-ROAD/2-13,q-ROAD/2-13,ROAD+26,ROAD+26);ctx.fillStyle='#303736';ctx.fillRect(p-ROAD/2,q-ROAD/2,ROAD,ROAD);ctx.fillStyle='#858a78';for(let k=-4;k<=4;k++)ctx.fillRect(p-ROAD/2+8+k*11,q-ROAD/2+7,6,25)} }
 }
 if(p>top&&p<bottom){ctx.fillStyle='#9b9c84';ctx.fillRect(left,p-(ROAD/2+SIDE),right-left,ROAD+SIDE*2);ctx.fillStyle='#2d3433';ctx.fillRect(left,p-ROAD/2,right-left,ROAD);ctx.fillStyle='#68716b';ctx.fillRect(left,p-ROAD/2+5,right-left,ROAD-10);ctx.fillStyle='rgba(236,230,190,.48)';for(let x=Math.floor(left/45)*45;x<right;x+=45)ctx.fillRect(x,p-2,22,4)}
 }
 // Curbs and lane edge lines, kept faint to support the street grid.
 ctx.strokeStyle='rgba(226,223,198,.3)';ctx.lineWidth=1;for(let i=0;i<7;i++){let p=280+i*STEP;ctx.beginPath();ctx.moveTo(p-ROAD/2,top);ctx.lineTo(p-ROAD/2,bottom);ctx.moveTo(p+ROAD/2,top);ctx.lineTo(p+ROAD/2,bottom);ctx.moveTo(left,p-ROAD/2);ctx.lineTo(right,p-ROAD/2);ctx.moveTo(left,p+ROAD/2);ctx.lineTo(right,p+ROAD/2);ctx.stroke()}
}
function drawBlocks(){for(const p of props){if(!visible(p.x+(p.w||0)/2,p.y+(p.h||0)/2,150))continue;
 if(p.type==='block'){ctx.fillStyle='#858676';ctx.fillRect(p.x-5,p.y-5,p.w+10,p.h+10);ctx.fillStyle='#9c9b82';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(58,70,55,.2)';ctx.fillRect(p.x+5,p.y+5,p.w-10,p.h-10);continue}
 if(p.type==='park'){ctx.fillStyle='#728764';ctx.fillRect(p.x-6,p.y-6,p.w+12,p.h+12);ctx.fillStyle='#667b5c';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#b8ad8b';ctx.fillRect(p.x+p.w*.43,p.y+9,13,p.h-18);ctx.fillRect(p.x+10,p.y+p.h*.48,p.w-20,12);ctx.fillStyle='#9f997c';ctx.fillRect(p.x+p.w*.65,p.y+p.h*.18,p.w*.22,30);continue}
 if(p.type==='yard'){ctx.fillStyle='#6c805f';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#b8ab87';ctx.fillRect(p.x+p.w*.2,p.y+p.h*.45,p.w*.6,5);continue}
 if(p.type==='tree'){ctx.fillStyle='rgba(14,29,18,.3)';ctx.beginPath();ctx.ellipse(p.x+3,p.y+6,p.s*1.15,p.s*.8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#416349';ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#759363';ctx.beginPath();ctx.arc(p.x-p.s*.25,p.y-p.s*.22,p.s*.55,0,Math.PI*2);ctx.fill();continue}
 if(p.type==='unit'){ctx.fillStyle='#505c56';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#90907b';ctx.fillRect(p.x+2,p.y+2,p.w-4,p.h-4)}
 }
 for(const b of buildings){if(!visible(b.x+b.w/2,b.y+b.h/2,130))continue;ctx.fillStyle='rgba(22,28,25,.33)';ctx.fillRect(b.x+8,b.y+11,b.w,b.h);ctx.fillStyle=b.roof;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='rgba(232,222,193,.17)';ctx.fillRect(b.x+4,b.y+4,b.w-8,3);ctx.fillStyle='rgba(26,35,34,.18)';ctx.fillRect(b.x+b.w-5,b.y+6,3,b.h-12);
  if(b.kind==='shop'){ctx.fillStyle='#465650';ctx.fillRect(b.x+8,b.y+b.h-14,b.w-16,9);ctx.fillStyle='#d2c997';for(let x=b.x+12;x<b.x+b.w-10;x+=18)ctx.fillRect(x,b.y+b.h-12,11,5);ctx.fillStyle='#a9b69b';ctx.fillRect(b.x+b.w*.3,b.y+b.h*.32,b.w*.38,5)}
  else{let seed=b.seed;ctx.strokeStyle='rgba(220,219,192,.27)';ctx.lineWidth=2;for(let x=b.x+15+(seed%7);x<b.x+b.w-8;x+=25){ctx.beginPath();ctx.moveTo(x,b.y+7);ctx.lineTo(x,b.y+b.h-7);ctx.stroke()}ctx.strokeStyle='rgba(39,49,45,.28)';for(let y=b.y+15;y<b.y+b.h-8;y+=24){ctx.beginPath();ctx.moveTo(b.x+6,y);ctx.lineTo(b.x+b.w-6,y);ctx.stroke()}}
  ctx.fillStyle='rgba(224,217,188,.12)';ctx.fillRect(b.x+b.w*.47,b.y+b.h*.48,Math.min(26,b.w*.18),Math.min(18,b.h*.18));
 }
}
function drawMarkers(){let target=missionStage===0?pickup:deliveryTarget,phase=time*2.7,r=22+Math.sin(phase)*5;ctx.save();ctx.translate(target.x,target.y);ctx.fillStyle='rgba(213,241,99,.13)';ctx.beginPath();ctx.arc(0,0,r+14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8f36a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e9ff91';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(216,243,106,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-r-6);ctx.lineTo(0,-60-Math.sin(phase)*5);ctx.stroke();ctx.fillStyle='rgba(12,18,16,.82)';ctx.fillRect(-52,-83,104,17);ctx.fillStyle='#dff584';ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.fillText(missionStage===0?'PICKUP':'DROP OFF',0,-71);ctx.restore();}
function drawCar(c){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.fillStyle='rgba(10,13,13,.4)';ctx.beginPath();ctx.ellipse(2,4,22,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171d1d';ctx.fillRect(-19,-12,8,4);ctx.fillRect(11,-12,8,4);ctx.fillRect(-19,8,8,4);ctx.fillRect(11,8,8,4);ctx.fillStyle=c.police?'#eceee3':c.color;ctx.beginPath();ctx.roundRect(-22,-9,44,18,5);ctx.fill();ctx.fillStyle=c.police?'#313a3c':'#293938';ctx.beginPath();ctx.roundRect(-8,-7,18,14,4);ctx.fill();ctx.fillStyle='rgba(177,208,197,.62)';ctx.fillRect(-6,-6,6,12);ctx.fillRect(2,-6,6,12);ctx.fillStyle='#ffe9a2';ctx.fillRect(19,-6,3,4);ctx.fillRect(19,2,3,4);ctx.fillStyle='#ef6252';ctx.fillRect(-21,-6,2,4);ctx.fillRect(-21,2,2,4);
 if(c.police){ctx.fillStyle='#3d5bbd';ctx.fillRect(-3,-2,6,4);ctx.fillStyle=(Math.floor(c.flash)%2?'#f24c4c':'#478aff');ctx.fillRect(-3,-8,3,3);ctx.fillStyle=(Math.floor(c.flash)%2?'#478aff':'#f24c4c');ctx.fillRect(0,-8,3,3)}
 if(c.player){ctx.strokeStyle='#d8f36a';ctx.lineWidth=1.5;ctx.strokeRect(-24,-11,48,22)}ctx.restore()}
function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);ctx.fillStyle='rgba(12,15,12,.45)';ctx.beginPath();ctx.ellipse(2,5,8,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#293436';ctx.fillRect(-5,-6,11,13);ctx.fillStyle='#d5cc9d';ctx.beginPath();ctx.arc(1,-7,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bc7652';ctx.fillRect(-4,-2,9,8);ctx.fillStyle='#222b2d';ctx.fillRect(-4,5,3,5);ctx.fillRect(3,5,3,5);ctx.fillStyle='#f3dfae';ctx.fillRect(3,-9,3,2);ctx.restore();}
function drawMinimap(){const w=mini.width,h=mini.height,s=w/W;mctx.clearRect(0,0,w,h);mctx.fillStyle='#657363';mctx.fillRect(0,0,w,h);mctx.fillStyle='#333b39';for(let i=0;i<7;i++){let p=(280+i*STEP)*s;mctx.fillRect(p-ROAD*s/2,0,ROAD*s,h);mctx.fillRect(0,p-ROAD*s/2,w,ROAD*s)}mctx.fillStyle='#8c8b77';for(const b of buildings)mctx.fillRect(b.x*s,b.y*s,b.w*s,b.h*s);for(const c of cars)if(c.police){mctx.fillStyle='#f16b5d';mctx.fillRect(c.x*s-1,c.y*s-1,3,3)}let t=missionStage===0?pickup:deliveryTarget;mctx.fillStyle='#d8f36a';mctx.beginPath();mctx.arc(t.x*s,t.y*s,3,0,Math.PI*2);mctx.fill();mctx.fillStyle='#f6f0d7';mctx.beginPath();mctx.arc(player.x*s,player.y*s,3.3,0,Math.PI*2);mctx.fill();mctx.strokeStyle='#f6f0d7';mctx.lineWidth=1.6;mctx.beginPath();mctx.moveTo(player.x*s,player.y*s);mctx.lineTo((player.x+Math.cos(player.angle)*15)*s,(player.y+Math.sin(player.angle)*15)*s);mctx.stroke()}
function frame(ts){const dt=Math.min(.04,(ts-last)/1000||0);last=ts;update(dt);draw()}
ui.status.textContent='GO TO THE PICKUP';updateWanted();randomizeJob();requestAnimationFrame(frame);
})();
