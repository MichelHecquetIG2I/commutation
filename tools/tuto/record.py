#!/usr/bin/env python3
"""Enregistre les vidéos du tutoriel en pilotant l'application dans Chrome (Playwright).

Usage (depuis la racine du dépôt, serveur local lancé : python3 -m http.server 8765) :
    python3 tools/tuto/record.py [1 2 3]

Produit tutoriel/NN-*.mp4 (H.264) et une vignette .jpg par vidéo.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "tutoriel"
URL = "http://localhost:8765/index.html"
W, H = 1280, 720
CHROME = shutil.which("google-chrome") or shutil.which("chromium")

OVERLAY_JS = r"""
(() => {
  if (document.getElementById('tuto-cursor')) return;
  const st = document.createElement('style');
  st.textContent = `
  #tuto-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:99999;pointer-events:none;
    transition:transform .55s cubic-bezier(.4,.1,.2,1);transform:translate(640px,360px)}
  .tuto-ring{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #f59e0b;
    z-index:99998;pointer-events:none;animation:tutoring .55s ease-out forwards}
  @keyframes tutoring{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
  #tuto-cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:86%;z-index:99999;pointer-events:none;
    background:rgba(17,24,39,.88);color:#fff;font:500 21px/1.35 system-ui,'Segoe UI',sans-serif;padding:10px 20px;border-radius:10px;
    text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .25s}
  #tuto-cap:empty{opacity:0}
  #tuto-title{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    background:#1e3a8a;color:#fff;font-family:system-ui,'Segoe UI',sans-serif;transition:opacity .5s}
  #tuto-title h1{font-size:46px;margin:0;font-weight:700}#tuto-title p{font-size:24px;margin:0;opacity:.85}
  .tuto-hl{outline:3px solid #f59e0b!important;outline-offset:2px;border-radius:6px}`;
  document.head.appendChild(st);
  const c = document.createElement('div'); c.id = 'tuto-cursor';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.5 15 L18 15 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  const cap = document.createElement('div'); cap.id = 'tuto-cap'; document.body.appendChild(cap);
  window.__tuto = {
    move(x, y, ms) { c.style.transitionDuration = (ms || 550) + 'ms'; c.style.transform = `translate(${x - 3}px,${y - 2}px)`; },
    ring(x, y) { const r = document.createElement('div'); r.className = 'tuto-ring'; r.style.left = x + 'px'; r.style.top = y + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700); },
    cap(t) { cap.textContent = t || ''; },
    title(h, p) { const d = document.createElement('div'); d.id = 'tuto-title'; d.innerHTML = '<h1></h1><p></p>';
      d.querySelector('h1').textContent = h; d.querySelector('p').textContent = p || ''; document.body.appendChild(d); },
    untitle() { const d = document.getElementById('tuto-title'); if (d) { d.style.opacity = 0; setTimeout(() => d.remove(), 600); } },
    hl(sel, on) { document.querySelectorAll(sel).forEach(e => e.classList.toggle('tuto-hl', on)); },
  };
})();
"""


class Tuto:
    def __init__(self, page):
        self.p = page
        self.pos = (W / 2, H / 2)

    def wait(self, s):
        self.p.wait_for_timeout(int(s * 1000))

    def cap(self, text, s=0.0):
        self.p.evaluate("t=>__tuto.cap(t)", text)
        if s:
            self.wait(s)

    def move(self, x, y):
        d = ((x - self.pos[0]) ** 2 + (y - self.pos[1]) ** 2) ** 0.5
        ms = int(min(900, max(300, d * 1.1)))
        self.p.evaluate("([x,y,ms])=>__tuto.move(x,y,ms)", [x, y, ms])
        self.p.mouse.move(x, y, steps=max(4, ms // 40))
        self.pos = (x, y)
        self.wait(ms / 1000 + 0.1)

    def click_xy(self, x, y, pause=0.45):
        self.move(x, y)
        self.p.evaluate("([x,y])=>__tuto.ring(x,y)", [x, y])
        self.p.mouse.click(x, y)
        self.wait(pause)

    def center(self, locator):
        locator.scroll_into_view_if_needed()
        b = locator.bounding_box()
        return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2

    def click(self, locator, pause=0.5):
        x, y = self.center(locator)
        self.click_xy(x, y, pause)

    def hover(self, locator, pause=0.6):
        x, y = self.center(locator)
        self.move(x, y)
        self.wait(pause)

    def grid(self, gx, gy):
        x, y = self.p.evaluate("""([gx,gy])=>{const r=document.getElementById('sch').getBoundingClientRect();
            const [px,py]=toS(gx,gy);return [r.left+px,r.top+py]}""", [gx, gy])
        return x, y

    def click_grid(self, gx, gy, pause=0.45):
        self.click_xy(*self.grid(gx, gy), pause)

    def key(self, k, pause=0.4):
        self.p.keyboard.press(k)
        self.wait(pause)

    def type_into(self, locator, text, pause=0.5):
        self.click(locator, 0.2)
        self.p.keyboard.press("Control+A")
        self.p.keyboard.type(text, delay=110)
        self.p.keyboard.press("Enter")
        locator.evaluate("e=>e.dispatchEvent(new Event('change',{bubbles:true}))")
        self.wait(pause)

    def select(self, locator, value, pause=0.6):
        self.click(locator, 0.25)
        locator.select_option(value)
        self.wait(pause)

    def tool(self, name):
        self.click(self.p.locator(f'#pal .tool[data-tool="{name}"]'), 0.35)

    def comp(self, name):
        """Clique sur le composant nommé du schéma."""
        gx, gy = self.p.evaluate("n=>{const c=circuit.comps.find(c=>c.name===n);return [c.x,c.y]}", name)
        self.click_grid(gx, gy, 0.6)

    def hl(self, sel, on=True):
        self.p.evaluate("([s,o])=>__tuto.hl(s,o)", [sel, on])

    def title(self, h, p, s=2.6):
        self.p.evaluate("([h,p])=>__tuto.title(h,p)", [h, p])
        self.wait(s)
        self.p.evaluate("__tuto.untitle()")
        self.wait(0.7)

    def btn(self, text, scope=None):
        base = scope if scope is not None else self.p
        return base.get_by_role("button", name=text, exact=True).first


# ---------------------------------------------------------------------------
def video1(t: Tuto):
    p = t.p
    t.title("1 · Construire un schéma", "Placer les composants, les relier, régler les valeurs")
    t.cap("Commencez par « Nouveau » pour partir d’une feuille vierge.", 0.3)
    t.click(p.locator("#clear"), 0.6)
    # Vue agrandie centrée sur la zone de travail (comme un zoom à la molette)
    p.evaluate("""()=>{const r=document.getElementById('sch').getBoundingClientRect();const s=1.8;
        view.s=s;view.ox=r.width/2-11*G*s;view.oy=r.height/2-12*G*s;draw()}""")
    t.wait(0.6)

    t.cap("Choisissez un composant dans la palette, puis cliquez sur la grille pour le poser.", 0.4)
    t.tool("Vdc"); t.click_grid(6, 12, 0.6)
    t.cap("La touche R fait pivoter le composant sélectionné.", 0.3)
    t.key("r", 1.0)

    t.cap("Une résistance…", 0.2)
    t.tool("R"); t.click_grid(10, 10, 0.7)
    t.cap("… une inductance, pivotée elle aussi avec R…", 0.2)
    t.tool("L"); t.click_grid(16, 12, 0.4); t.key("r", 0.8)
    t.cap("… et la masse, qui fixe la référence des potentiels (0 V).", 0.2)
    t.tool("gnd"); t.click_grid(6, 14, 1.0)

    t.cap("Outil « Fil » (touche W) : cliquez sur une borne, puis sur l’autre.", 0.3)
    t.tool("wire")
    t.click_grid(6, 10, 0.3); t.click_grid(8, 10, 0.3); t.key("Escape", 0.3)
    t.click_grid(12, 10, 0.3); t.click_grid(16, 10, 0.3); t.key("Escape", 0.3)
    t.cap("Échap termine le fil en cours. Une borne rouge signale une borne non reliée.", 0.2)
    t.click_grid(6, 14, 0.3); t.click_grid(16, 14, 0.3); t.key("Escape", 1.2)

    t.cap("Revenez à la sélection (touche V) et cliquez sur un composant pour régler ses paramètres.", 0.3)
    t.tool("select")
    t.comp("R1")
    t.type_into(p.locator("#f-R"), "10", 0.8)
    t.comp("V1")
    t.cap("Les valeurs acceptent les préfixes : 10m = 0,01 · 100µ (ou 100u) · 1k · 2M.", 0.3)
    t.type_into(p.locator("#f-V"), "10", 0.6)
    t.comp("L1")
    t.type_into(p.locator("#f-L"), "100m", 0.8)

    t.cap("Ajoutez des sondes : courant dans L…", 0.3)
    t.click(t.btn("+ courant", p.locator("#insp")), 0.8)
    t.comp("R1")
    t.cap("… et tension a−b aux bornes de R. Les repères a et b apparaissent sur le schéma.", 0.3)
    t.click(t.btn("+ tension a−b", p.locator("#insp")), 1.6)

    t.cap("Réglez la durée de simulation, puis cliquez sur « Simuler ».", 0.3)
    t.type_into(p.locator("#tstop"), "60m", 0.4)
    t.click(p.locator("#run"), 1.0)
    t.cap("Les courbes s’affichent dans l’oscilloscope. Toute modification relance la simulation.", 3.2)
    t.cap("Astuce : Ctrl+Z annule, Suppr efface, la molette zoome sur le schéma.", 3.0)
    t.cap("", 0.5)


def video2(t: Tuto):
    p = t.p
    t.title("2 · Visualiser les courbes", "Sondes, oscilloscopes, zoom et repères a / b")
    t.cap("Chargez un exemple depuis la liste « Exemple ».", 0.3)
    t.select(p.locator("#preset"), "rl", 1.4)

    t.cap("Les repères a et b montrent où est mesurée chaque tension : u = Va − Vb.", 0.3)
    t.move(*t.grid(10, 9)); t.wait(1.6)
    t.move(*t.grid(15, 12)); t.wait(1.8)
    t.cap("Leur couleur est celle de la courbe correspondante.", 2.0)

    t.cap("Cochez ou décochez une sonde pour l’afficher dans l’oscilloscope actif.", 0.3)
    cb = p.locator("#probes .pr input[type=checkbox]")
    t.click(cb.nth(1), 1.2); t.click(cb.nth(1), 1.2)

    sc = p.locator(".scope").first
    t.cap("« Pistes séparées » superpose ou sépare les courbes.", 0.3)
    t.click(sc.locator('input[data-id="lanes"]'), 1.5)
    t.click(sc.locator('input[data-id="lanes"]'), 1.0)

    canvas = sc.locator('canvas[data-id="scope"]')
    b = canvas.bounding_box()
    t.cap("Survolez l’oscilloscope : le curseur donne les valeurs à chaque instant.", 0.3)
    t.move(b["x"] + b["width"] * .25, b["y"] + b["height"] * .45); t.wait(0.6)
    t.move(b["x"] + b["width"] * .55, b["y"] + b["height"] * .45); t.wait(1.4)
    t.cap("Molette : zoom sur le temps · glisser : déplacer · double-clic : tout afficher.", 0.3)
    for _ in range(5):
        p.mouse.wheel(0, -240); t.wait(0.25)
    t.wait(0.8)
    t.click(t.btn("Tout", sc), 1.0)
    t.cap("« Régime établi » cadre la fin de la simulation.", 0.3)
    t.click(t.btn("Régime établi", sc), 1.6)
    t.click(t.btn("Tout", sc), 0.8)

    t.cap("« + Oscillo » ajoute un oscilloscope ; cliquez dessus pour le rendre actif.", 0.3)
    t.click(p.locator("#addscope"), 1.2)
    sc2 = p.locator(".scope").nth(1)
    t.cap("Les cases cochées concernent alors cet oscilloscope.", 0.3)
    t.click(cb.nth(2), 1.4)
    t.cap("« Côte à côte » place le schéma et les oscilloscopes en colonnes.", 0.3)
    t.click(p.locator("#layout"), 2.0)
    t.click(p.locator("#layout"), 1.0)
    t.click(sc2.locator('[data-id="close"]'), 1.0)

    t.cap("Une sonde « potentiel » mesure la tension d’une borne par rapport à la masse.", 0.3)
    t.comp("L")
    t.click(t.btn("+ potentiel a", p.locator("#insp")), 2.0)
    t.cap("", 0.6)


def video3(t: Tuto):
    p = t.p
    t.title("3 · Mesures et calculs", "Valeurs moyennes, courbes calculées, puissance et énergie")
    t.select(p.locator("#preset"), "rle", 1.4)
    t.cap("Le panneau « Mesures » donne, pour chaque courbe, moyenne, efficace, min, max et crête-à-crête.", 0.3)
    t.hover(p.locator("#meas"), 3.0)
    t.cap("Les mesures portent sur la plage affichée : zoomez pour mesurer une partie seulement.", 0.3)
    sc = p.locator(".scope").first
    t.click(t.btn("Régime établi", sc), 2.4)
    t.click(t.btn("Tout", sc), 0.8)

    t.cap("Pour une puissance : sélectionnez le composant puis « + puissance » (u × i).", 0.3)
    t.comp("L")
    t.click(t.btn("+ puissance", p.locator("#insp")), 1.6)

    t.cap("« Courbe calculée » combine deux courbes : A + B, A − B, A × B, A ÷ B…", 0.3)
    op = p.locator("#mf-op")
    t.cap("… ou transforme une courbe : intégrale, dérivée, valeur efficace ou moyenne glissante.", 0.3)
    t.select(op, "int", 0.6)
    a = p.locator('#probes .mform select[aria-label="Courbe A"]')
    last = a.locator("option").last.get_attribute("value")
    t.select(a, last, 0.6)
    t.click(t.btn("+ Ajouter la courbe", p.locator("#probes")), 1.6)
    t.cap("L’intégrale de la puissance donne l’énergie, en joules (ici l’énergie stockée dans L).", 3.0)

    t.cap("Modifiez une valeur : toutes les courbes et mesures sont recalculées.", 0.3)
    t.comp("E")
    t.type_into(p.locator("#f-V"), "6", 2.6)
    t.cap("Le second oscilloscope montre la puissance et l’énergie dissipées dans R.", 2.6)

    t.cap("« Enregistrer » sauvegarde le circuit et ses courbes dans un fichier ; « Ouvrir… » le recharge.", 0.3)
    t.hover(p.locator("#save"), 1.4); t.hover(p.locator("#open"), 2.0)
    t.cap("Chaque exemple a un lien direct (…/?ex=rl, ?ex=rc, ?ex=rle, ?ex=mcc) à partager.", 3.2)
    t.cap("", 0.5)


VIDEOS = {
    "1": ("01-construire-un-schema", video1),
    "2": ("02-visualiser-les-courbes", video2),
    "3": ("03-mesures-et-calculs", video3),
}


def record(key):
    name, fn = VIDEOS[key]
    tmp = pathlib.Path(tempfile.mkdtemp())
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = br.new_context(viewport={"width": W, "height": H}, record_video_dir=str(tmp),
                             record_video_size={"width": W, "height": H}, locale="fr-FR")
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL + "?ex=rl")
        page.evaluate("localStorage.clear()")
        page.goto(URL + "?ex=rl")
        page.wait_for_timeout(1200)
        page.evaluate(OVERLAY_JS)
        fn(Tuto(page))
        page.wait_for_timeout(400)
        ctx.close()
        br.close()
    if errors:
        raise SystemExit(f"Erreurs JavaScript pendant {name} : {errors}")
    webm = next(tmp.glob("*.webm"))
    OUT.mkdir(exist_ok=True)
    mp4 = OUT / f"{name}.mp4"
    # On retire la première seconde (page en cours de chargement, avant le titre).
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.2", "-i", str(webm), "-c:v", "libx264", "-preset", "veryfast",
                    "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(mp4)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.0", "-i", str(mp4), "-frames:v", "1", "-q:v", "4",
                    str(OUT / f"{name}.jpg")], check=True)
    shutil.rmtree(tmp)
    print("OK", mp4)


if __name__ == "__main__":
    for k in (sys.argv[1:] or ["1", "2", "3"]):
        record(k)
