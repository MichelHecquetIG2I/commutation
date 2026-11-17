# Figure « Exemple de résultats » : lancer d'abord  node tools/simef/illustration_donnees.js  (écrit /tmp/illu.json),
# puis le maillage à l'optimum (voir README), puis  python3 tools/simef/illustration_figure.py
import json, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import matplotlib.tri as mtri
from matplotlib.patches import Rectangle
d=json.load(open('/tmp/illu.json')); m=json.load(open('/tmp/illu_mesh.json'))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':11.5,'axes.titleweight':'bold','axes.spines.top':False,'axes.spines.right':False})
fr=FuncFormatter(lambda v,_:('%g'%v).replace('.',','))
fc=lambda v,n=3:(('%.'+str(n)+'g')%v).replace('.',',')
fig=plt.figure(figsize=(15.5,10.2),dpi=140)
gs=fig.add_gridspec(2,3,width_ratios=[1,1.25,1],height_ratios=[1.12,1],hspace=0.42,wspace=0.30,left=0.05,right=0.985,top=0.80,bottom=0.06)
fig.suptitle('Optimisation paramétrique d’une inductance en pot avec entrefer — plan composite centré (15 calculs EF)',fontsize=15,fontweight='bold',x=0.05,y=0.975,ha='left')
o=d['opt'];v=o['v']
fig.text(0.05,0.925,"Facteurs : entrefer g ∈ [0,3 ; 2] mm, rayon du noyau rn ∈ [9 ; 15] mm, hauteur du bobinage h ∈ [25 ; 50] mm — N = 100 spires, I = 10 A, bobinage de 10 mm d’épaisseur,\nfer B(H) non linéaire (µr ≈ 2000, Js = 1,7 T).   Objectif : maximiser L / masse de fer sous la contrainte B moyen dans le noyau ≤ 1,2 T.",fontsize=10.5,color='#444',ha='left',va='top')
# (a) carte de B à l'optimum
ax=fig.add_subplot(gs[0,0]);x=np.array(m['x']);y=np.array(m['y']);T=np.array(m['tri']);B=np.array(m['B'])
for sx in (1,-1):
  for sy in (1,-1):
    tr=mtri.Triangulation(sx*x,sy*y,T);tp=ax.tripcolor(tr,facecolors=B,cmap='turbo',vmin=0,vmax=1.6,edgecolors='none')
    ax.tricontour(tr,np.array(m['psi']),levels=14,colors='white',linewidths=0.6)
for g in m['regs']:
  col='#e8902a' if g['mat']=='coil' else '#222'
  for sx in (1,-1):
    zr=[(-g['z1'],g['z1'])] if g['z0']==0 else [(g['z0'],g['z1']),(-g['z1'],-g['z0'])]
    for za,zb in zr:
      x0,x1=sorted([sx*g['r0'],sx*g['r1']]);ax.add_patch(Rectangle((x0,za),x1-x0,zb-za,fill=False,ec=col,lw=1.4))
ax.axvline(0,color='#888',ls='--',lw=0.8);ax.set_aspect('equal');ax.set_xlim(-34,34);ax.set_ylim(-24,24)
ax.set_title(f"(a) Inductance optimale : |B| et lignes de flux\n g = {fc(v['g'])} mm, rn = {fc(v['rn'],2)} mm, h = {fc(v['h'],2)} mm",loc='left')
ax.set_xlabel('r (mm)');ax.set_ylabel('z (mm)');ax.xaxis.set_major_formatter(fr);ax.yaxis.set_major_formatter(fr)
cb=fig.colorbar(tp,ax=ax,orientation='horizontal',fraction=0.05,pad=0.14);cb.set_label('|B| (T)');cb.formatter=fr;cb.update_ticks()
ax.annotate('entrefer g',xy=(4,0),xytext=(14,-21),arrowprops=dict(arrowstyle='->',color='k'),fontsize=9,bbox=dict(fc='white',ec='none',alpha=.8))
ax.annotate('noyau central\nB ≈ 1,2 T',xy=(-5,9),xytext=(-31,17),arrowprops=dict(arrowstyle='->',color='k'),fontsize=9,bbox=dict(fc='white',ec='none',alpha=.8))
ax.annotate('bobinage\n(N I = 1000 A)',xy=(-15,0),xytext=(-33,-20),arrowprops=dict(arrowstyle='->',color='k'),fontsize=9,bbox=dict(fc='white',ec='none',alpha=.8))
# (b) surface de réponse
ax=fig.add_subplot(gs[0,1]);s=d['surf'];G,Rn=np.meshgrid(s['g'],s['rn']);Z=np.array(s['LsM']);Bm=np.array(s['B'])
cf=ax.contourf(G,Rn,Z,levels=18,cmap='turbo');cs=ax.contour(G,Rn,Z,levels=9,colors='white',linewidths=0.6);ax.clabel(cs,fmt=lambda v:fc(v),fontsize=7.5)
cc=ax.contour(G,Rn,Bm,levels=[1.2],colors='#c00',linewidths=2.2,linestyles='--');ax.clabel(cc,fmt={1.2:'B noyau = 1,2 T'},fontsize=8.5)
ax.contourf(G,Rn,Bm,levels=[1.2,99],colors='none',hatches=['//'])
pts=[r for r in d['runs'] if abs(r['x'][2]+1)<1e-9 or True]
ax.scatter([r['v']['g'] for r in d['runs']],[r['v']['rn'] for r in d['runs']],s=26,c='white',edgecolors='k',zorder=5,label='essais du plan (projetés)')
ax.scatter([v['g']],[v['rn']],marker='*',s=360,c='#ffd400',edgecolors='k',zorder=6,label='optimum',clip_on=False)
ax.set_xlabel('entrefer g (mm)');ax.set_ylabel('rayon du noyau rn (mm)');ax.xaxis.set_major_formatter(fr);ax.yaxis.set_major_formatter(fr)
ax.set_title('(b) Surface de réponse : L / masse de fer (µH/g), h = 25 mm\n hachures : contrainte violée (B noyau > 1,2 T)',loc='left');ax.legend(loc='upper right',fontsize=8,framealpha=.9)
c2=fig.colorbar(cf,ax=ax,fraction=0.046,pad=0.02);c2.set_label('µH/g');c2.formatter=fr;c2.update_ticks()
# (c) effets
ax=fig.add_subplot(gs[0,2]);st=d['stats'];names=st['LsM']['terms'][1:];k=np.arange(len(names))
for i,(key,col,lab) in enumerate([('LsM','#1c58e6','L / masse (µH/g)'),('B','#c23a28','B noyau (T) × 10')]):
  b=np.array(st[key]['beta'][1:])*(10 if key=='B' else 1);ax.barh(k+(i-0.5)*0.38,b,height=0.36,color=col,label=lab)
ax.set_yticks(k);ax.set_yticklabels(names);ax.invert_yaxis();ax.axvline(0,color='k',lw=0.8);ax.xaxis.set_major_formatter(fr)
ax.set_title('(c) Effets des facteurs\n coefficients en variables codées',loc='left');ax.legend(fontsize=8,loc='lower left')
ax.text(0.02,0.42,'\n'.join([f"{lab} : R² = {fc(st[kk]['R2'],4)}, Q² = {fc(st[kk]['Q2'],4)}" for kk,lab in [('L','L'),('B','B noyau'),('LsM','L / masse')]]),transform=ax.transAxes,fontsize=8,va='top',ha='left',bbox=dict(fc='white',ec='#ccc'))
# (d) L(I)
ax=fig.add_subplot(gs[1,0:2]);I=[q['I'] for q in d['LI']]
ax.plot(I,[q['cen'] for q in d['LI']],'o-',color='#888',label='point central (g = 1,15 ; rn = 12 ; h = 37,5 mm)')
ax.plot(I,[q['opt'] for q in d['LI']],'s-',color='#1c58e6',label='inductance optimale')
ax.axvline(10,color='#c00',ls=':',lw=1.2);ax.text(10.4,5.75,'I = 10 A (courant de dimensionnement)',color='#c00',fontsize=8.5,va='top')
ax.set_xlabel('courant I (A)');ax.set_ylabel('L (mH)');ax.xaxis.set_major_formatter(fr);ax.yaxis.set_major_formatter(fr);ax.legend(fontsize=8,loc='lower left')
ax.set_title('(d) Saturation : inductance (sécante) en fonction du courant\n l’optimum garde L constante jusqu’à 10 A',loc='left');ax.grid(alpha=.3)
# (e) tableau optimum
ax=fig.add_subplot(gs[1,2]);ax.axis('off')
rows=[('Inductance L (mH)','L'),('B moyen noyau (T)','B'),('Masse de fer (g)','m'),('L / masse (µH/g)','LsM')]
tab=[[lab,fc(o['pred'][k],4),fc(o['sim'][k],4),(('%+.1f'%((o['pred'][k]/o['sim'][k]-1)*100))+' %').replace('.',',')] for lab,k in rows]
t=ax.table(cellText=tab,colLabels=['Réponse','modèle','calcul EF','écart'],loc='upper center',cellLoc='center',colWidths=[0.44,0.18,0.2,0.18]);t.auto_set_font_size(False);t.set_fontsize(9.5);t.scale(1,1.6)
for (r,c),cell in t.get_celld().items():
  cell.set_edgecolor('#ccc')
  if r==0: cell.set_facecolor('#dce4f2');cell.set_text_props(weight='bold')
ax.set_title('(e) Optimum : modèle et calcul EF',loc='left')
c=d['crit'];ax.text(0.0,0.42,f"Optimum : g = {fc(v['g'])} mm, rn = {fc(v['rn'],2)} mm, h = {fc(v['h'],2)} mm\n→ contrainte B ≤ 1,2 T active ; rn et h à leur borne basse\n   (fer et cuivre minimaux), l’entrefer règle B.\n\nPlan CCF : 15 essais, D-efficacité {fc(c['Deff'],3)} %, VIF max {fc(c['maxVIF'],3)}.\nCalcul de chaque essai : EF axisymétrique,\nmaillage moyen, Newton-Raphson (≈ 0,1 s).",transform=ax.transAxes,fontsize=9.2,va='top')
fig.savefig('/tmp/illu/illustration-optimisation-inductance.png',dpi=140);print('ok')
