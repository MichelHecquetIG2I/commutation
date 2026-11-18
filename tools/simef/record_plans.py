#!/usr/bin/env python3
"""Enregistre la vidéo tutoriel de l'outil « Plans d'expériences » de SimEF.

Usage (depuis la racine du dépôt, après `python3 tools/build_simef.py` et un serveur local
`python3 -m http.server 8765`) :  python3 tools/simef/record_plans.py
Produit tools/simef/tutoriel/plans-experiences.mp4 et sa vignette .jpg (copiés dans SimEF/ par le script de génération).
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "tuto"))
from record import OVERLAY_JS, Tuto, W, H, CHROME  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://localhost:8765/SimEF/plans.html"
OUT = ROOT / "tools" / "simef" / "tutoriel"
NAME = "plans-experiences"


def show(t, sel, pause=0.8):
    t.p.evaluate("s=>{const y=document.querySelector(s).getBoundingClientRect().top+scrollY-62;window.scrollTo({top:Math.max(0,y),behavior:'smooth'})}", sel)
    t.wait(pause)


def radio(t, val, pause=0.8):
    t.click(t.p.locator(f'input[name=meth][value={val}]').locator('xpath=..'), pause)


def wait_enabled(t, sel, timeout=300000):
    t.p.wait_for_function(f"!document.querySelector('{sel}').disabled", timeout=timeout)


def video(t: Tuto):
    p = t.p
    t.title("Optimisation d’une inductance", "SimEF — plans d’expériences, SQP, NSGA-II, topologie")
    # --- figure cotée
    t.cap("L’objet : une inductance en pot avec entrefer. La figure cotée montre ses paramètres.", 0.3)
    t.hl("#geoCard", True); t.hover(p.locator("#geo"), 2.6)
    t.cap("En bleu, les facteurs du plan avec leur plage ; en gris, les cotes fixes ou déduites.", 0.3)
    t.hover(p.locator("#geo"), 2.4)
    t.cap("« Afficher » dessine les géométries extrêmes du domaine : bornes min…", 0.3)
    t.select(p.locator("#geoShow"), "min", 1.8)
    t.cap("… et bornes max : de 217 g à 896 g de fer.", 0.3)
    t.select(p.locator("#geoShow"), "max", 2.0)
    t.select(p.locator("#geoShow"), "fix", 0.6); t.hl("#geoCard", False)
    # --- facteurs
    t.cap("1 · Les facteurs (2 à 6) et leurs bornes ; la figure suit le tableau en direct.", 0.3)
    t.hl("#fac", True); t.hover(p.locator("#fac tbody tr").nth(0), 0.8)
    fixrn = p.locator("#fac tbody tr").nth(1).locator("input").nth(3)
    t.type_into(fixrn, "10", 1.4); t.type_into(fixrn, "14", 1.0)
    t.cap("Les facteurs non cochés gardent leur valeur « fixe » : N = 100 spires, I = 10 A.", 0.3)
    t.hover(p.locator("#fac tbody tr").nth(5).locator("input").nth(3), 2.0); t.hl("#fac", False)
    t.cap("2 · Le solveur de chaque essai : éléments finis ou réseau de réluctances maillé.", 0.3)
    t.hover(p.locator("#solver"), 1.8)
    t.cap("3 · Le plan : composite centré à faces centrées (CCF), 15 essais pour 3 facteurs.", 0.3)
    t.hover(p.locator("#design"), 1.2)
    t.click(p.locator("#gen"), 1.2)
    show(t, "#runAll", 0.4)
    t.cap("Le tableau des essais s’affiche sous la figure, en variables codées et réelles.", 2.0)
    t.cap("4 · « Lancer les simulations » : un calcul EF par essai.", 0.3)
    t.click(p.locator("#runAll"), 0.4)
    wait_enabled(t, "#runAll"); t.wait(0.8)
    show(t, "#modelCard", 0.8)
    t.cap("5 · Un modèle quadratique par réponse : R² et Q² (validation croisée) proches de 1.", 0.3)
    t.hover(p.locator("#stats"), 2.4)
    show(t, "#surf", 0.6)
    t.cap("6 · Surface de réponse ; la ligne rouge est la contrainte sur B.", 2.4)
    # --- méthode 1
    show(t, "#optCard", 0.8)
    t.cap("7 · Quatre méthodes d’optimisation. Méthode 1 : optimiser sur le modèle du plan.", 0.3)
    t.hover(p.locator("input[name=meth][value=doe]").locator("xpath=.."), 1.0)
    show(t, "#flow-doe", 0.4)
    t.cap("Chaque méthode a son logigramme : actions, équations, nombre de calculs par étape.", 3.0)
    show(t, "#dir", 0.6)
    t.cap("Maximiser L / masse de fer avec B noyau ≤ 1,2 T, puis vérifier par simulation.", 0.3)
    t.click(p.locator("#optim"), 1.0); t.click(p.locator("#verify"), 2.0)
    t.hover(p.locator("#optRes table").nth(1), 2.2)
    # --- méthode 2
    t.cap("Méthode 2 : SQP directement sur le solveur, gradients par différences finies.", 0.3)
    radio(t, "sqp", 0.6)
    show(t, "#sqpRun", 0.4)
    t.click(p.locator("#sqpRun"), 0.4)
    wait_enabled(t, "#sqpRun"); t.wait(0.6)
    t.cap("Convergence en quelques itérations : même optimum que le plan, à 0,5 % près.", 0.3)
    t.hover(p.locator("#sqpCh"), 2.2)
    t.hover(p.locator("#sqpRes"), 2.0)
    # --- méthode 3
    t.cap("Méthode 3 : NSGA-II, deux objectifs : maximiser W et minimiser la masse.", 0.3)
    radio(t, "nsga", 0.6)
    show(t, "#nsRun", 0.4)
    t.cap("N reste entier (pas de 1, 2… spires) : l’algorithme génétique gère les variables discrètes.", 0.3)
    t.hover(p.locator("#nsStepN"), 1.8)
    t.click(p.locator("#nsRun"), 0.4)
    wait_enabled(t, "#nsRun"); t.wait(0.6)
    show(t, "#pareto", 0.5)
    t.cap("Le front de Pareto : chaque point est un compromis énergie / masse.", 2.2)
    show(t, "#nsGeo", 0.5)
    t.cap("La bobine évolue le long du front ; le curseur parcourt les solutions.", 0.3)
    sl = p.locator("#nsSlide"); bb = sl.bounding_box()
    t.move(bb["x"] + 6, bb["y"] + bb["height"] / 2); p.mouse.down()
    for k in range(1, 16):
        p.mouse.move(bb["x"] + 6 + k * (bb["width"] - 12) / 15, bb["y"] + bb["height"] / 2); t.wait(0.18)
    p.mouse.up(); t.wait(0.6)
    t.cap("À droite, la carte de |B| du point choisi.", 2.0)
    # --- méthode 4
    t.cap("Méthode 4 : optimisation topologique ON/OFF, à ne pas confondre avec le paramétrique.", 0.3)
    radio(t, "topo", 0.6)
    show(t, "#flow-cmp", 0.4)
    t.cap("Paramétrique : quelques cotes d’une forme imposée. Topologique : des centaines de cellules fer / air.", 3.4)
    show(t, "#flow-topo", 0.4)
    t.cap("Sensibilité B² (problème auto-adjoint), filtrage, mise à jour ON/OFF, retour arrière.", 3.0)
    show(t, "#tpX0", 0.4)
    t.cap("On part de l’optimum SQP et on lance EF puis MEC, avec vérification croisée.", 0.3)
    t.select(p.locator("#tpX0"), "sqp", 0.6)
    t.click(p.locator("#tpBoth"), 0.4)
    p.wait_for_timeout(600); wait_enabled(t, "#tpBoth"); t.wait(0.4)
    t.select(p.locator("#tpView"), "ef", 0.4)
    show(t, "#tpMap", 0.4)
    t.cap("Le fer peu sollicité disparaît : coins des flasques, haut du noyau près de l’axe.", 0.3)
    sl = p.locator("#tpSlide"); bb = sl.bounding_box()
    t.move(bb["x"] + 4, bb["y"] + bb["height"] / 2); p.mouse.down()
    for k in range(0, 13):
        p.mouse.move(bb["x"] + 4 + k * (bb["width"] - 8) / 12, bb["y"] + bb["height"] / 2); t.wait(0.2)
    p.mouse.up(); t.wait(0.6)
    show(t, "#tpRes", 0.4)
    t.cap("Moins de fer pour la même énergie : un gain hors de portée de l’optimisation paramétrique.", 3.2)
    show(t, "#geoCard", 0.6)
    t.cap("La figure peut aussi afficher l’optimum SQP ou le point choisi sur le front.", 0.3)
    t.select(p.locator("#geoShow"), "sqp", 2.0)
    t.cap("", 0.4)


def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = br.new_context(viewport={"width": W, "height": H}, record_video_dir=str(tmp), record_video_size={"width": W, "height": H}, locale="fr-FR")
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_timeout(1500)
        page.evaluate(OVERLAY_JS)
        video(Tuto(page))
        page.wait_for_timeout(300)
        ctx.close()
        br.close()
    if errors:
        raise SystemExit(f"Erreurs JavaScript : {errors}")
    webm = next(tmp.glob("*.webm"))
    OUT.mkdir(parents=True, exist_ok=True)
    mp4 = OUT / f"{NAME}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.4", "-i", str(webm), "-c:v", "libx264", "-preset", "veryfast",
                    "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(mp4)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.0", "-i", str(mp4), "-frames:v", "1", "-q:v", "4", str(OUT / f"{NAME}.jpg")], check=True)
    shutil.rmtree(tmp)
    print("OK", mp4)


if __name__ == "__main__":
    main()
