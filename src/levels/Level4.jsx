import { useEffect, useRef, useState } from 'react';
import leftSrc        from '../assets/left.png';
import rightSrc       from '../assets/right.png';
import truthSrc       from '../assets/truth.png';
import perspectiveSrc from '../assets/perspective.png';

const W=1400,H=500,GND=432,WW=2400,SR=25,BW=34,BH=46;
const GX=1480,EX=2260,CW=BW+20,CH=BH+24;
const PWIN={x:60,y:44,w:200,h:GND-44};
const WIN={x:1080,y:44,w:330,h:GND-44};
const KP={x:1820,y:120,w:120,h:14},KPX=1875,KPY=108;
const CBP={x:1620,y:244,w:80,h:12};
const BSPD=195,G=880,SV=260,SA=2700,SJ=600,SG=900,PAT=80,BLW=12,BLH=5,BLS=680;

const STARS=Array.from({length:130},(_,i)=>{
  const h=s=>{const x=Math.sin(s*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  return[h(i)*WW,h(i+100)*(GND*0.78),h(i+200)*1.3+0.25];
});

// ─── Draw ─────────────────────────────────────────────────────────────────────
function pBg(ctx,evil,cx){
  const vR=cx+W,sky=ctx.createLinearGradient(cx,0,cx,GND);
  evil?(sky.addColorStop(0,'#08040f'),sky.addColorStop(1,'#140820')):(sky.addColorStop(0,'#0c1628'),sky.addColorStop(1,'#1a2e50'));
  ctx.fillStyle=sky;ctx.fillRect(cx,0,W,GND);
  const vL=Math.max(cx,GX),vR2=Math.min(vR,EX);
  if(vR2>vL){ctx.fillStyle=evil?'rgba(60,10,90,0.22)':'rgba(20,55,110,0.14)';ctx.fillRect(vL,0,vR2-vL,GND);}
  ctx.fillStyle=evil?'#0a0710':'#0e1828';ctx.fillRect(cx,GND,W,H-GND);
  const gl=ctx.createLinearGradient(cx,GND,cx,GND+8);
  gl.addColorStop(0,evil?'rgba(100,30,160,0.5)':'rgba(40,80,160,0.4)');gl.addColorStop(1,'transparent');
  ctx.fillStyle=gl;ctx.fillRect(cx,GND,W,8);
  ctx.fillStyle=evil?'rgba(220,190,255,0.45)':'rgba(200,220,255,0.38)';
  for(const[sx,sy,sr]of STARS)if(sx>=cx-2&&sx<=vR+2){ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.fill();}
}

function drawFrame(ctx,x,y,w,h,f=14){
  ctx.fillStyle='#1c0e00';ctx.fillRect(x-f-2,y-f-2,w+f*2+4,h+f*2+4);
  const gg=ctx.createLinearGradient(x-f,y,x+w+f,y+h);
  gg.addColorStop(0,'#c8960a');gg.addColorStop(0.5,'#e8b820');gg.addColorStop(1,'#a07008');
  ctx.fillStyle=gg;ctx.fillRect(x-f,y-f,w+f*2,h+f*2);
  ctx.fillStyle='#100800';ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.strokeStyle='#f0d040';ctx.lineWidth=1.5;ctx.strokeRect(x-f+4,y-f+4,w+f*2-8,h+f*2-8);
}

function pPWin(ctx,img){
  const{x,y,w,h}=PWIN;
  drawFrame(ctx,x,y,w,h);
  if(img?.complete){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x,y,w,h);ctx.restore();}
}

function pWin(ctx,imgs,flip,truth){
  const{x,y,w,h}=WIN;
  drawFrame(ctx,x,y,w,h);
  const b=1-Math.min(1,truth*1.8);
  const di=(img,a)=>{if(img?.complete&&a>0.01){ctx.save();ctx.globalAlpha=a;ctx.drawImage(img,x,y,w,h);ctx.restore();}};
  di(imgs.left,(1-flip)*b);di(imgs.right,flip*b);
  if(truth>0.01&&imgs.truth?.complete){ctx.save();ctx.globalAlpha=Math.min(1,truth);ctx.drawImage(imgs.truth,x,y,w,h);ctx.restore();}
}

function pGate(ctx){
  const gx=GX,pw=16,ph=100,ar=34,pg=ctx.createLinearGradient(gx-pw,0,gx,0);
  pg.addColorStop(0,'#1e2a3a');pg.addColorStop(1,'#2d3f58');
  ctx.fillStyle=pg;ctx.fillRect(gx-pw,GND-ph,pw,ph);
  ctx.beginPath();ctx.arc(gx-pw/2,GND-ph,ar,Math.PI,0);ctx.fill();
  ctx.strokeStyle='rgba(140,160,220,0.35)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(gx-pw/2,GND-ph,ar,Math.PI,0);ctx.stroke();ctx.strokeRect(gx-pw,GND-ph,pw,ph);
  ctx.fillStyle='rgba(160,180,240,0.35)';ctx.font='10px monospace';ctx.textAlign='left';
  ctx.fillText('SPHERE VILLAGE ▶',gx+6,GND-ph-ar-36);
}

function pKP(ctx){
  const{x,y,w,h}=KP;
  ctx.save();ctx.shadowColor='rgba(255,215,0,0.35)';ctx.shadowBlur=14;
  const pg=ctx.createLinearGradient(x,y,x,y+h);pg.addColorStop(0,'#4a5568');pg.addColorStop(1,'#2d3748');
  ctx.fillStyle=pg;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='rgba(255,215,0,0.4)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,215,0,0.1)';ctx.lineWidth=1;ctx.setLineDash([3,6]);
  ctx.beginPath();ctx.moveTo(x+w/2,y+h);ctx.lineTo(x+w/2,GND);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,215,0,0.25)';ctx.font='9px monospace';ctx.textAlign='center';
  ctx.fillText('4 SPHERES',x+w/2,y-6);ctx.restore();
}

function pCBP(ctx,used){
  const{x,y,w}=CBP,bx=x+w/2;
  const pg=ctx.createLinearGradient(x,y,x,y+CBP.h);pg.addColorStop(0,'#4a3a5a');pg.addColorStop(1,'#2d2040');
  ctx.fillStyle=pg;ctx.fillRect(x,y,w,CBP.h);
  ctx.strokeStyle=used?'rgba(80,80,100,0.4)':'rgba(200,80,50,0.5)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,CBP.h);
  ctx.fillStyle='#333';ctx.fillRect(bx-4,y-8,8,8);
  ctx.save();ctx.shadowColor=used?'transparent':'rgba(255,60,0,0.6)';ctx.shadowBlur=used?0:12;
  ctx.fillStyle=used?'#444':'#ff3300';ctx.beginPath();ctx.ellipse(bx,y-8,10,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle=used?'rgba(100,100,120,0.4)':'rgba(255,140,60,0.5)';ctx.font='9px monospace';ctx.textAlign='center';
  ctx.fillText(used?'used':'▼ CAGE',bx,y-22);
}

function pExit(ctx,hasKey){
  const ex=EX,aw=60,ah=96,pw=14;
  const pg=ctx.createLinearGradient(ex,0,ex+aw,0);pg.addColorStop(0,'#1e2a3a');pg.addColorStop(1,'#2d3f58');
  ctx.fillStyle=pg;ctx.fillRect(ex,GND-ah,pw,ah);ctx.fillRect(ex+aw-pw,GND-ah,pw,ah);
  ctx.beginPath();ctx.arc(ex+aw/2,GND-ah,aw/2,Math.PI,0);ctx.fill();
  ctx.fillStyle=hasKey?'#065f46':'#0e0e1e';ctx.fillRect(ex+pw,GND-ah+8,aw-pw*2,ah-8);
  ctx.textAlign='center';
  if(hasKey){ctx.fillStyle='#22c55e';ctx.shadowColor='#22c55e';ctx.shadowBlur=14;ctx.font='bold 20px sans-serif';ctx.fillText('✓',ex+aw/2,GND-ah/2+8);ctx.shadowBlur=0;}
  else{ctx.font='18px sans-serif';ctx.fillText('🔒',ex+aw/2,GND-ah/2+6);}
  ctx.strokeStyle=hasKey?'rgba(34,197,94,0.5)':'rgba(100,120,200,0.3)';ctx.lineWidth=2;
  ctx.strokeRect(ex,GND-ah,aw,ah);ctx.beginPath();ctx.arc(ex+aw/2,GND-ah,aw/2,Math.PI,0);ctx.stroke();
  ctx.fillStyle=hasKey?'rgba(100,255,150,0.6)':'rgba(180,190,240,0.35)';ctx.font='10px monospace';
  ctx.fillText('EXIT',ex+aw/2,GND-ah-8);
}

function pKey(ctx,kx,ky,glow){
  ctx.save();if(glow){ctx.shadowColor='#ffd700';ctx.shadowBlur=20;}
  ctx.fillStyle='#ffd700';ctx.strokeStyle='#a07808';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(kx,ky,10,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.beginPath();ctx.arc(kx,ky,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffd700';ctx.fillRect(kx+10,ky-3.5,22,7);ctx.fillRect(kx+22,ky+3.5,5,7);ctx.fillRect(kx+28,ky+3.5,4,5);ctx.restore();
}

function pCage(ctx,c,now){
  const{x,y,w,h,hp}=c;
  ctx.save();ctx.shadowColor='rgba(80,160,255,0.5)';ctx.shadowBlur=10;ctx.strokeStyle='#7090c8';ctx.lineWidth=3;
  for(let i=0;i<=7;i++){const bx=x+i*(w/7);ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx,y+h);ctx.stroke();}
  [y,y+h/2,y+h].forEach(hy=>{ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x+w,hy);ctx.stroke();});
  ctx.shadowBlur=0;
  for(let i=0;i<3;i++){ctx.fillStyle=i<hp?'#ff4444':'rgba(255,80,80,0.15)';ctx.beginPath();ctx.arc(x+10+i*14,y-12,5,0,Math.PI*2);ctx.fill();}
  if(hp>0){ctx.fillStyle=`rgba(120,180,255,${0.1+0.07*Math.sin(now*0.006)})`;ctx.fillRect(x,y,w,h);}
  ctx.restore();
}

function pCageFall(ctx,cf,now){
  const p=0.3+0.25*Math.sin(now*0.01);
  ctx.fillStyle=`rgba(255,80,40,${p})`;ctx.fillRect(cf.x,GND-3,CW,3);
  ctx.fillStyle=`rgba(255,80,40,${p*0.3})`;ctx.beginPath();ctx.ellipse(cf.x+CW/2,GND,CW*0.6,6,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.strokeStyle='rgba(112,144,200,0.9)';ctx.lineWidth=3;ctx.shadowColor='rgba(100,180,255,0.4)';ctx.shadowBlur=8;
  for(let i=0;i<=5;i++){const bx=cf.x+i*(CW/5);ctx.beginPath();ctx.moveTo(bx,cf.y);ctx.lineTo(bx,cf.y+CH);ctx.stroke();}
  [cf.y,cf.y+CH].forEach(hy=>{ctx.beginPath();ctx.moveTo(cf.x,hy);ctx.lineTo(cf.x+CW,hy);ctx.stroke();});
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(140,180,255,0.25)';ctx.lineWidth=1;
  for(let i=1;i<5;i++){const bx=cf.x+i*(CW/5);ctx.beginPath();ctx.moveTo(bx,cf.y-18);ctx.lineTo(bx,cf.y);ctx.stroke();}
  ctx.restore();
}

// state: 'demon'(default box mode) | 'brave'(box in village) | 'frightened'(not used currently, available) | 'innocent'(sphere mode)
function pSphere(ctx,sx,sy,state){
  ctx.save();
  if(state==='demon'){
    const g=ctx.createRadialGradient(sx-7,sy-7,2,sx,sy,SR);g.addColorStop(0,'#440060');g.addColorStop(1,'#080012');
    ctx.fillStyle=g;ctx.shadowColor='rgba(160,0,255,0.4)';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(sx,sy,SR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#1a002e';
    [[sx-15,sy-SR+2,sx-9,sy-SR-13,sx-3,sy-SR],[sx+3,sy-SR,sx+9,sy-SR-13,sx+15,sy-SR+2]].forEach(([x1,y1,x2,y2,x3,y3])=>{
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();
    });
    ctx.fillStyle='#f01030';ctx.shadowColor='#f00';ctx.shadowBlur=6;
    ctx.beginPath();ctx.ellipse(sx-8,sy-4,5,4,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(sx+8,sy-4,5,4,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#ddd';ctx.fillRect(sx-5,sy+5,3,6);ctx.fillRect(sx+2,sy+5,3,6);

  }else if(state==='brave'){
    const g=ctx.createRadialGradient(sx-6,sy-6,1,sx,sy,SR);g.addColorStop(0,'#fffce0');g.addColorStop(0.55,'#e8d060');g.addColorStop(1,'#a08828');
    ctx.fillStyle=g;ctx.shadowColor='rgba(220,170,30,0.3)';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(sx,sy,SR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#2a1808';
    ctx.beginPath();ctx.ellipse(sx-9,sy-3,5.5,3.5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(sx+9,sy-3,5.5,3.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,250,180,0.8)';ctx.beginPath();ctx.arc(sx-11,sy-4,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sx+7,sy-4,1.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#2a1808';ctx.lineWidth=2.8;
    ctx.beginPath();ctx.moveTo(sx-15,sy-13);ctx.lineTo(sx-4,sy-9);ctx.stroke();ctx.beginPath();ctx.moveTo(sx+4,sy-9);ctx.lineTo(sx+15,sy-13);ctx.stroke();
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx-8,sy+8);ctx.lineTo(sx+8,sy+8);ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx-8,sy+8);ctx.lineTo(sx-10,sy+5);ctx.stroke();ctx.beginPath();ctx.moveTo(sx+8,sy+8);ctx.lineTo(sx+10,sy+5);ctx.stroke();

  }else{  // innocent
    const g=ctx.createRadialGradient(sx-7,sy-7,2,sx,sy,SR);g.addColorStop(0,'#fff');g.addColorStop(1,'#6080c0');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,SR,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3050a0';ctx.beginPath();ctx.arc(sx-8,sy-5,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sx+8,sy-5,3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#3050a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy+5,7,0,Math.PI);ctx.stroke();
  }
  ctx.restore();
}

function pBox(ctx,bx,by,evil,facing,trapped){
  ctx.save();
  if(evil){
    ctx.fillStyle='#0c0014';ctx.shadowColor=trapped?'#ff8800':'#cc0030';ctx.shadowBlur=trapped?20:14;
    ctx.fillRect(bx,by,BW,BH);ctx.shadowBlur=0;ctx.fillStyle='#280044';
    [[bx+4,by,bx+8,by-14,bx+14,by],[bx+20,by,bx+26,by-14,bx+30,by]].forEach(([x1,y1,x2,y2,x3,y3])=>{
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();
    });
    if(trapped){
      ctx.strokeStyle='#ff8800';ctx.lineWidth=2.5;ctx.shadowColor='#ff8800';ctx.shadowBlur=6;
      [[bx+3,by+10,bx+11,by+18],[bx+11,by+10,bx+3,by+18],[bx+21,by+10,bx+29,by+18],[bx+29,by+10,bx+21,by+18]].forEach(([x1,y1,x2,y2])=>{
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      });ctx.shadowBlur=0;
    }else{ctx.fillStyle='#ff1840';ctx.shadowColor='#f00';ctx.shadowBlur=6;ctx.fillRect(bx+5,by+12,6,6);ctx.fillRect(bx+23,by+12,6,6);ctx.shadowBlur=0;}
  }else{
    const g=ctx.createLinearGradient(bx,by,bx+BW,by+BH);g.addColorStop(0,'#f0e4c0');g.addColorStop(1,'#d4c090');
    ctx.fillStyle=g;ctx.fillRect(bx,by,BW,BH);ctx.strokeStyle='#b09040';ctx.lineWidth=1.5;ctx.strokeRect(bx+1,by+1,BW-2,BH-2);
    ctx.fillStyle='#8b6830';ctx.fillRect(bx+5,by+13,6,6);ctx.fillRect(bx+BW-11,by+13,6,6);
    ctx.strokeStyle='#8b6830';ctx.lineWidth=2;ctx.beginPath();ctx.arc(bx+BW/2,by+BH-10,6,0.2,Math.PI-0.2);ctx.stroke();
  }
  const gx=facing>0?bx+BW:bx-12;ctx.fillStyle=evil?'#200010':'#806030';ctx.fillRect(gx,by+BH/2-3,12,6);ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MoralDemo(){
  const canvasRef=useRef(null),keysRef=useRef({}),imgsRef=useRef({left:null,right:null,truth:null,perspective:null});

  const S=useRef({
    mode:'box',showTruth:false,truthAlpha:0,flipAlpha:0,
    keyState:'uncollected',keySphId:null,keyFallen:null,
    won:false,sphereWon:false,msg:'Walk right — discover the village.',
    bullets:[],cage:null,cageFalling:null,boxTrapped:false,buttonTriggered:false,slashEffects:[],
    tabLatch:false,shootLatch:false,jumpLatch:false,patrolDir:1,camX:0,
    box:{x:44,y:GND-BH,vx:0,facing:1},
    spheres:[{id:0,x:1540,y:GND-SR,vx:0,vy:0,wd:1},{id:1,x:1670,y:GND-SR,vx:0,vy:0,wd:-1},
             {id:2,x:1830,y:GND-SR,vx:0,vy:0,wd:1},{id:3,x:1970,y:GND-SR,vx:0,vy:0,wd:-1}],
  });

  const[ui,setUi]=useState({mode:'box',keyState:'uncollected',msg:'',won:false,sphereWon:false,boxTrapped:false});
  const sync=()=>{const s=S.current;setUi({mode:s.mode,keyState:s.keyState,msg:s.msg,won:s.won,sphereWon:s.sphereWon,boxTrapped:s.boxTrapped});};

  useEffect(()=>{
    [leftSrc,rightSrc,truthSrc,perspectiveSrc].forEach((src,i)=>{const img=new Image();img.src=src;imgsRef.current[['left','right','truth','perspective'][i]]=img;});
    const dn=e=>{const k=e.key.toLowerCase();keysRef.current[k]=true;if(k===' '||k==='tab')e.preventDefault();};
    const up=e=>{keysRef.current[e.key.toLowerCase()]=false;};
    window.addEventListener('keydown',dn);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',dn);window.removeEventListener('keyup',up);};
  },[]);

  const onClick=e=>{
    const r=canvasRef.current.getBoundingClientRect();
    const wx=(e.clientX-r.left)*(W/r.width)+S.current.camX,wy=(e.clientY-r.top)*(H/r.height);
    if(wx>=WIN.x&&wx<=WIN.x+WIN.w&&wy>=WIN.y&&wy<=WIN.y+WIN.h) S.current.showTruth=!S.current.showTruth;
  };

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');let raf,last=performance.now();

    // Shared melee kill: box rect vs sphere, works in both modes
    const meleeKill=(s,b,sphs)=>{
      if(s.boxTrapped)return;
      for(let i=sphs.length-1;i>=0;i--){
        const sp=sphs[i],cx=Math.max(b.x,Math.min(b.x+BW,sp.x)),cy=Math.max(b.y,Math.min(b.y+BH,sp.y));
        if(Math.hypot(sp.x-cx,sp.y-cy)<SR){
          if(s.keyState==='spheres_have'&&sp.id===s.keySphId){s.keyState='fallen';s.keyFallen={x:sp.x,y:GND-20};s.keySphId=null;s.msg='Key dropped! Walk over it.';sync();}
          s.slashEffects.push({x:sp.x,y:sp.y,t:0});sphs.splice(i,1);
        }
      }
    };

    const tick=now=>{
      const dt=Math.min(0.025,(now-last)/1000);last=now;
      const s=S.current,keys=keysRef.current;

      s.camX+=(Math.max(0,Math.min(WW-W,s.box.x-W*0.35))-s.camX)*Math.min(1,dt*6);
      s.truthAlpha+=((s.showTruth?1:0)-s.truthAlpha)*Math.min(1,dt*3.5);
      const inVillage=s.box.x+BW/2>GX;
      s.flipAlpha+=((inVillage?1:0)-s.flipAlpha)*Math.min(1,dt*4);
      const evil=inVillage;

      if(keys['tab']&&!s.tabLatch){s.mode=s.mode==='box'?'sphere':'box';sync();}
      s.tabLatch=keys['tab'];

      const{box:b,spheres:sphs}=s,space=keys[' '];

      // Cage falling — auto-tracks box x
      if(s.cageFalling){
        const cf=s.cageFalling;
        cf.x=b.x-(CW-BW)/2;cf.vy+=G*dt;cf.y+=cf.vy*dt;
        if(cf.y+CH>=b.y&&cf.y<=b.y+BH&&b.x+BW>cf.x&&b.x<cf.x+CW){
          s.cage={x:cf.x,y:b.y-12,w:CW,h:CH,hp:3};s.cageFalling=null;s.boxTrapped=true;
          b.x=s.cage.x+(CW-BW)/2;s.msg='Box trapped! Tab→box then shoot [Space].';sync();
        }else if(cf.y+CH>=GND){s.cage={x:cf.x,y:GND-CH,w:CW,h:CH,hp:3};s.cageFalling=null;s.msg='Cage on ground.';sync();}
      }

      if(!s.won){
        if(s.mode==='box'){
          if(!s.boxTrapped){
            b.vx=0;
            if(keys['a']||keys['arrowleft']){b.vx=-BSPD;b.facing=-1;}
            if(keys['d']||keys['arrowright']){b.vx=BSPD;b.facing=1;}
            b.x=Math.max(0,Math.min(WW-BW,b.x+b.vx*dt));
          }else if(s.cage) b.x=s.cage.x+(CW-BW)/2;

          if(space&&!s.shootLatch) s.bullets.push({x:b.facing>0?b.x+BW:b.x-BLW,y:b.y+BH/2-BLH/2,vx:BLS*b.facing});
          s.shootLatch=space;

          s.bullets=s.bullets.filter(bl=>{
            bl.x+=bl.vx*dt;if(bl.x<-20||bl.x>WW+20)return false;
            if(s.cage){const c=s.cage;if(bl.x+BLW>c.x&&bl.x<c.x+c.w&&bl.y+BLH>c.y&&bl.y<c.y+c.h){c.hp--;if(c.hp<=0){s.cage=null;s.boxTrapped=false;s.msg='Cage destroyed!';sync();}return false;}}
            for(let i=sphs.length-1;i>=0;i--){
              if(Math.hypot(bl.x+BLW/2-sphs[i].x,bl.y+BLH/2-sphs[i].y)<SR+6){
                if(s.keyState==='spheres_have'&&sphs[i].id===s.keySphId){s.keyState='fallen';s.keyFallen={x:sphs[i].x,y:GND-20};s.keySphId=null;s.msg='Key dropped! Walk over it.';sync();}
                s.slashEffects.push({x:sphs[i].x,y:sphs[i].y,t:0});sphs.splice(i,1);return false;
              }
            }
            return true;
          });

          // Sphere patrol
          for(const sp of sphs){
            sp.vy+=G*dt;sp.y=Math.min(GND-SR,sp.y+sp.vy*dt);
            if(sp.y>=GND-SR){sp.y=GND-SR;sp.vy=0;sp.vx=sp.wd*PAT;}
            sp.x=Math.max(GX+SR,Math.min(EX-SR,sp.x+sp.vx*dt));
            if(sp.x+SR>=EX)sp.wd=-1;if(sp.x-SR<=GX)sp.wd=1;
          }
          meleeKill(s,b,sphs); // box touch kills sphere

          if(s.cage&&!s.boxTrapped){const c=s.cage;if(b.x+BW>c.x&&b.x<c.x+c.w&&b.y+BH>c.y&&b.y<c.y+c.h){s.boxTrapped=true;b.x=c.x+(CW-BW)/2;s.msg='Trapped! Tab→box then shoot.';sync();}}
          if(s.keyState==='fallen'&&s.keyFallen&&Math.abs(b.x+BW/2-s.keyFallen.x)<BW/2+20){s.keyState='box_has';s.keyFallen=null;s.msg='Key! Reach EXIT →';sync();}
          if(s.keyState==='box_has'&&b.x+BW>=EX){s.won=true;s.sphereWon=false;s.showTruth=true;s.msg='You escaped. But at what cost?';sync();}

        }else{
          for(const sp of sphs){
            if(keys['a']||keys['arrowleft'])  sp.vx=Math.max(-SV,sp.vx-SA*dt);
            else if(keys['d']||keys['arrowright'])sp.vx=Math.min(SV,sp.vx+SA*dt);
            else sp.vx*=Math.pow(0.06,dt);
            const onGnd=sp.y+SR>=GND-2;
            const onKP =Math.abs(sp.y-(KP.y-SR))<5&&sp.x>=KP.x-5&&sp.x<=KP.x+KP.w+5;
            const onCBP=Math.abs(sp.y-(CBP.y-SR))<5&&sp.x>=CBP.x-5&&sp.x<=CBP.x+CBP.w+5;
            const onStk=!onGnd&&!onKP&&!onCBP&&sphs.some(o=>o.id!==sp.id&&Math.abs(sp.x-o.x)<SR*1.8&&(o.y-sp.y)>=SR*1.6&&(o.y-sp.y)<=SR*2.4);
            if(space&&!s.jumpLatch&&(onGnd||onKP||onCBP||onStk))sp.vy=-SJ;
            sp.vy+=SG*dt;
            sp.x=Math.max(GX+SR,Math.min(EX-SR,sp.x+sp.vx*dt));sp.y+=sp.vy*dt;
            if(sp.y+SR>=GND){sp.y=GND-SR;sp.vy=Math.min(0,sp.vy);}
            for(const pl of[KP,CBP]){if(sp.vy>=0&&sp.y+SR>=pl.y&&sp.y<pl.y&&sp.x>=pl.x-SR*0.4&&sp.x<=pl.x+pl.w+SR*0.4){sp.y=pl.y-SR;sp.vy=0;}}
            if(sp.y-SR<=0){sp.y=SR;sp.vy=Math.max(0,sp.vy)*0.4;}
          }
          s.jumpLatch=space;
          // Stacking
          for(let it=0;it<3;it++){
            sphs.sort((a,b)=>b.y-a.y);
            for(let i=0;i<sphs.length;i++)for(let j=i+1;j<sphs.length;j++){
              const dx=sphs[j].x-sphs[i].x,dy=sphs[j].y-sphs[i].y,d=Math.hypot(dx,dy);
              if(d<SR*2&&d>0.1){const ov=SR*2-d+0.5;if(dy<0){sphs[j].y-=ov;if(sphs[j].vy>0)sphs[j].vy=0;}else{sphs[i].y-=ov;if(sphs[i].vy>0)sphs[i].vy=0;}sphs[i].y=Math.min(GND-SR,sphs[i].y);sphs[j].y=Math.min(GND-SR,sphs[j].y);}
            }
          }
          // Cage button
          if(!s.buttonTriggered&&!s.cage&&!s.cageFalling){
            for(const sp of sphs){if(Math.abs(sp.y-(CBP.y-SR))<8&&sp.x>=CBP.x&&sp.x<=CBP.x+CBP.w){s.buttonTriggered=true;s.cageFalling={x:b.x-(CW-BW)/2,y:-CH,vy:0};s.msg='Cage falling!';sync();break;}}
          }
          // Key pickup (must be standing on platform)
          if(s.keyState==='uncollected'){
            for(const sp of sphs){if(Math.abs(sp.y-(KP.y-SR))<8&&sp.x>=KP.x&&sp.x<=KP.x+KP.w){s.keyState='spheres_have';s.keySphId=sp.id;s.msg='Key! Run to EXIT or cage the box first.';sync();break;}}
          }
          // Sphere escape
          if(s.keyState==='spheres_have'){const ks=sphs.find(sp=>sp.id===s.keySphId);if(ks&&ks.x+SR>=EX){s.won=true;s.sphereWon=true;s.showTruth=true;s.msg='The spheres escaped.';sync();}}
          meleeKill(s,b,sphs); // box still fatal in sphere mode unless trapped
          // Box patrol
          if(s.boxTrapped){if(s.cage)b.x=s.cage.x+(CW-BW)/2;}
          else{b.x+=s.patrolDir*100*dt;b.facing=s.patrolDir;if(b.x+BW>=EX-10){s.patrolDir=-1;b.x=EX-BW-10;}if(b.x<=GX+10){s.patrolDir=1;b.x=GX+10;}}
        }
      }

      // ─ Render ─
      const sphState=s.mode==='sphere'?'innocent':(evil?'brave':'demon');
      ctx.save();ctx.translate(-Math.round(s.camX),0);
      pBg(ctx,evil,s.camX);pPWin(ctx,imgsRef.current.perspective);pWin(ctx,imgsRef.current,s.flipAlpha,s.truthAlpha);pGate(ctx);pKP(ctx);pCBP(ctx,s.buttonTriggered);pExit(ctx,s.keyState==='box_has');
      if(s.keyState==='uncollected'){pKey(ctx,KPX,KPY+Math.sin(now*0.002)*4,true);ctx.fillStyle='rgba(255,215,0,0.4)';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('KEY',KPX+8,KPY-20);}
      if(s.keyState==='fallen'&&s.keyFallen)pKey(ctx,s.keyFallen.x,s.keyFallen.y,true);
      if(s.cageFalling)pCageFall(ctx,s.cageFalling,now);
      if(s.cage)pCage(ctx,s.cage,now);
      if(s.mode==='sphere'&&s.keyState==='uncollected'){
        const top=sphs.reduce((m,sp)=>Math.min(m,sp.y-SR),GND);
        ctx.fillStyle='rgba(180,200,255,0.32)';ctx.font='10px monospace';ctx.textAlign='center';
        ctx.fillText(`Stack: ${Math.round(GND-top)}px / need ~${Math.round(GND-(KP.y-SR))}px`,GX+(EX-GX)/2,GND-6);
      }
      for(const sp of sphs){pSphere(ctx,sp.x,sp.y,sphState);if(s.keyState==='spheres_have'&&sp.id===s.keySphId)pKey(ctx,sp.x+SR,sp.y-SR-8,false);}
      s.bullets.forEach(bl=>{ctx.save();ctx.shadowColor='#ffdd00';ctx.shadowBlur=8;ctx.fillStyle='#fffbaa';ctx.beginPath();ctx.ellipse(bl.x+BLW/2,bl.y+BLH/2,BLW/2,BLH/2,0,0,Math.PI*2);ctx.fill();ctx.restore();});
      pBox(ctx,b.x,b.y,evil,b.facing,s.boxTrapped);
      if(s.keyState==='box_has')pKey(ctx,b.x+BW+3,b.y-8,false);
      // Slash effects
      s.slashEffects=s.slashEffects.filter(ef=>{
        ef.t+=dt;if(ef.t>0.45)return false;
        const p=ef.t/0.45,a=1-p,r=14+p*22;
        ctx.save();ctx.strokeStyle=`rgba(255,60,40,${a})`;ctx.lineWidth=3.5-p*2.5;ctx.shadowColor=`rgba(255,30,0,${a*0.6})`;ctx.shadowBlur=12;
        ctx.beginPath();ctx.moveTo(ef.x-r*0.75,ef.y-r*0.75);ctx.lineTo(ef.x+r*0.75,ef.y+r*0.75);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ef.x+r*0.75,ef.y-r*0.75);ctx.lineTo(ef.x-r*0.75,ef.y+r*0.75);ctx.stroke();
        ctx.shadowBlur=0;ctx.strokeStyle=`rgba(255,120,60,${a*0.5})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ef.x,ef.y,r*0.9,0,Math.PI*2);ctx.stroke();ctx.restore();return true;
      });
      ctx.restore();
      ctx.fillStyle=s.mode==='box'?'rgba(240,215,155,0.6)':'rgba(155,180,255,0.6)';ctx.font='bold 11px monospace';ctx.textAlign='right';
      ctx.fillText(s.mode==='box'?'[ BOX ]':'[ SPHERE ]',W-10,20);
      if(s.won){
        ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle=s.sphereWon?'#a0d8ff':'#f0e8d0';ctx.font='bold 32px serif';ctx.textAlign='center';
        ctx.fillText(s.sphereWon?'The spheres escaped.':'You escaped.',W/2,H/2-20);
        ctx.fillStyle='rgba(200,190,170,0.7)';ctx.font='17px serif';
        ctx.fillText(s.sphereWon?'They had a home worth defending.':'But at what cost?',W/2,H/2+18);
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[]);

  const{mode,keyState,msg,won,sphereWon,boxTrapped}=ui;
  const steps=[
    {label:'Walk right — find the image window, then the gate',done:mode==='sphere'||keyState!=='uncollected'||won},
    {label:'Tab: be the spheres — button drops cage, stack 4 for key',done:keyState!=='uncollected'},
    {label:'Run to EXIT with key, or trap box first then escape',done:won},
  ];
  return(
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <div className="max-w-[1520px] mx-auto grid lg:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-1">Level 4 · Moral</div>
            <h1 className="text-2xl font-semibold">Point of View</h1>
            <p className="text-sm text-neutral-400 mt-3 leading-6 italic">"{msg}"</p>
            {boxTrapped&&<p className="text-xs text-orange-400 mt-2 animate-pulse">▣ BOX TRAPPED — Tab→box, shoot [Space]</p>}
          </div>
          <div className={`rounded-3xl p-5 border transition-all duration-500 ${mode==='box'?'bg-amber-900/20 border-amber-700/30':'bg-indigo-950/40 border-indigo-700/30'}`}>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">You are</div>
            {mode==='box'?<><div className="font-semibold text-amber-300">The Box</div><div className="text-sm text-neutral-500 mt-1">Armed. Fatal to touch.</div></>
                         :<><div className="font-semibold text-indigo-300">The Spheres</div><div className="text-sm text-neutral-500 mt-1">Village residents. Use the button, stack for the key.</div></>}
          </div>
          <div className="rounded-3xl bg-white/4 border border-white/8 p-5 space-y-3">
            <div className="text-xs uppercase tracking-widest text-neutral-500">Objective</div>
            {steps.map((step,i)=>(
              <div key={i} className={`flex gap-3 text-sm leading-5 ${step.done?'text-neutral-600 line-through':'text-neutral-300'}`}>
                <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] mt-0.5 ${step.done?'bg-emerald-800/60 border-emerald-700 text-emerald-400':'border-neutral-600 text-neutral-500'}`}>{step.done?'✓':i+1}</span>
                {step.label}
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-white/4 border border-white/8 p-5 text-sm text-neutral-500 space-y-2 leading-7">
            <div className="font-semibold text-neutral-300 mb-1">Controls</div>
            <div><span className="font-mono text-neutral-200">A D / ← →</span> — move</div>
            <div><span className="font-mono text-neutral-200">Space</span> — shoot (box) / jump (sphere)</div>
            <div><span className="font-mono text-neutral-200">Tab</span> — switch perspective</div>
            <div><span className="font-mono text-neutral-200">Escape</span> — truth reveals itself</div>
          </div>
          {won&&<div className={`rounded-3xl p-5 border ${sphereWon?'bg-sky-950/40 border-sky-700/40':'bg-amber-950/30 border-amber-700/30'}`}>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{sphereWon?'Sphere Victory':'Box Victory'}</div>
            <p className="text-sm leading-6">{sphereWon?'The spheres defended their home.':'The box escaped — by force.'}</p>
          </div>}
        </div>
        <div className="rounded-3xl bg-white/3 border border-white/8 p-4 overflow-hidden">
          <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto rounded-2xl block" onClick={onClick} style={{cursor:'default'}}/>
          <div className="mt-3 text-xs text-neutral-600 text-center">Walk right to explore. Cross the gate — the image and all faces transform.</div>
        </div>
      </div>
    </div>
  );
}
