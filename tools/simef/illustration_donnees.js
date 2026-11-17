// Calcule les données de l'illustration : plan CCF (g, rn, h ; I = 10 A ; EF moyen ; B(H)), modèles quadratiques, optimum vérifié, L(I).
const F=require('../../fem-axi.js'),D=require('./doe.js'),fs=require('fs');
const FACT=[{id:'g',min:0.3,max:2},{id:'rn',min:9,max:15},{id:'h',min:25,max:50}],fix={eb:10,N:100,I:10};
const P=v=>{const ri=v.rn+1,re=ri+v.eb;return{core:'pot',N:v.N,I:v.I,rn:v.rn,ri,re,h:v.h,gap:v.g,jeu:1,mur:2000,Js:1.7,material:'bh',ds:1,Rmax:400}};
function sim(v){const p=P(v),r=F.solve(p),ic=r.regs.findIndex(q=>q.name==='Noyau central');let s=0,w=0;for(let e=0;e<r.G.ne;e++){if(r.m.reg[e]!==ic)continue;const a=r.G.area[e]*r.G.rc[e];s+=r.B.Bm[e]*a;w+=a}
  let vfe=0;for(const q of F.buildGeometry(p))if(q.mat==='iron')vfe+=Math.PI*(q.r1*q.r1-q.r0*q.r0)*(q.z1-q.z0)*2;const m=vfe*1e-9*7650*1000;return{L:r.L*1e3,B:s/w,m,LsM:r.L*1e6/m}}
const real=x=>Object.fromEntries(FACT.map((f,j)=>[f.id,f.min+(x[j]+1)/2*(f.max-f.min)]));
const des=D.ccd(3,'ccf',1).D,runs=des.map(x=>({x,v:real(x),r:sim({...fix,...real(x)})}));
const T=D.terms(3,'quad'),fit={};for(const k of ['L','B','m','LsM'])fit[k]=D.fit(des,runs.map(r=>r.r[k]),T);
const pred=(k,x)=>D.predict(fit[k].beta,T,x);
// optimum : max LsM sous B <= 1.2
let best=[-1e9,null];const R=D.rng(5);for(let i=0;i<20000;i++){const x=[0,0,0].map(()=>-1+2*R());if(pred('B',x)<=1.2&&pred('LsM',x)>best[0])best=[pred('LsM',x),x]}
let [s,x]=best,st=0.2;while(st>1e-4){let imp=false;for(let j=0;j<3;j++)for(const d of[st,-st]){const y=x.slice();y[j]=Math.max(-1,Math.min(1,y[j]+d));if(pred('B',y)<=1.2&&pred('LsM',y)>s){s=pred('LsM',y);x=y;imp=true}}if(!imp)st/=2}
const vo=real(x),so=sim({...fix,...vo});
// surface LsM et B en (g, rn) à h optimum
const n=60,surf={g:[],rn:[],LsM:[],B:[]};for(let a=0;a<=n;a++){surf.rn.push(9+6*a/n);surf.LsM.push([]);surf.B.push([]);for(let b=0;b<=n;b++){if(a===0)surf.g.push(0.3+1.7*b/n);const xx=[-1+2*b/n,-1+2*a/n,x[2]];surf.LsM[a].push(pred('LsM',xx));surf.B[a].push(pred('B',xx))}}
// L(I) à l'optimum et au point central
const LI=[];for(const I of [1,2,4,6,8,10,12,15,20,25,30]){LI.push({I,opt:F.solve(P({...fix,...vo,I})).L*1e3,cen:F.solve(P({...fix,g:1.15,rn:12,h:37.5,I})).L*1e3})}
const names=['g','rn','h'];
const out={runs:runs.map(r=>({x:r.x,v:r.v,...r.r})),stats:Object.fromEntries(Object.entries(fit).map(([k,f])=>[k,{R2:f.R2,Q2:f.Q2,beta:f.beta,t:f.t,terms:T.map(t=>D.termName(t,names))}])),
  opt:{x,v:vo,pred:{L:pred('L',x),B:pred('B',x),m:pred('m',x),LsM:pred('LsM',x)},sim:so},surf,LI,crit:D.criteria(des,T)};
fs.writeFileSync('/tmp/illu.json',JSON.stringify(out));console.log(JSON.stringify({opt:out.opt,stats:Object.fromEntries(Object.entries(out.stats).map(([k,v])=>[k,[v.R2.toFixed(4),v.Q2.toFixed(4)]]))}));
