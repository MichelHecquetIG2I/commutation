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


def video(t: Tuto):
    p = t.p
    t.title("Plans d’expériences", "Optimisation paramétrique d’une inductance (SimEF)")
    t.cap("Objet étudié : une inductance en pot avec entrefer, calculée par éléments finis à chaque essai.", 3.0)
    t.cap("1 · Choisissez les facteurs (2 à 6) et leurs bornes min / max.", 0.3)
    t.hl("#fac", True); t.hover(p.locator("#fac tbody tr").nth(0), 1.0)
    t.hover(p.locator("#fac tbody tr").nth(1), 0.8); t.hover(p.locator("#fac tbody tr").nth(3), 1.0)
    t.cap("Les facteurs non cochés gardent leur valeur « fixe » : ici I = 10 A.", 0.3)
    t.hover(p.locator("#fac tbody tr").nth(5).locator("input").nth(3), 2.2); t.hl("#fac", False)
    t.cap("2 · Le solveur : éléments finis (précis) ou réseau de réluctances (plus rapide).", 0.3)
    t.hover(p.locator("#solver"), 2.4)
    t.cap("3 · Le type de plan : criblage, surface de réponse, hypercube latin ou plans optimaux.", 0.3)
    t.select(p.locator("#design"), "dopt", 1.4)
    t.cap("Un plan D-optimal se règle par le nombre d’essais et le modèle visé.", 0.3)
    t.hover(p.locator("#nruns"), 1.6)
    t.cap("« Comparer les plans » donne D-efficacité, critère I et VIF de chaque plan.", 0.3)
    t.click(p.locator("#cmpDesigns"), 1.0)
    show(t, "#cmpBox", 1.0)
    t.cap("D-efficacité élevée : coefficients précis. Critère I faible : bonnes prédictions.", 3.4)
    show(t, ".side", 0.6)
    t.cap("Prenons un composite centré à faces centrées (CCF) : 15 essais pour 3 facteurs.", 0.3)
    t.select(p.locator("#design"), "ccf", 0.8)
    t.click(p.locator("#gen"), 1.2)
    p.evaluate("document.getElementById('cmpBox').innerHTML=''")
    t.cap("Le tableau liste les essais en variables codées (−1, 0, +1) et en valeurs réelles.", 2.4)
    t.cap("4 · « Lancer les simulations » : un calcul EF par essai.", 0.3)
    t.click(p.locator("#runAll"), 0.4)
    p.wait_for_function("!document.getElementById('runAll').disabled", timeout=300000)
    t.wait(1.0)
    t.cap("Chaque ligne reçoit L, B dans le noyau, la masse de fer, l’énergie…", 2.6)
    show(t, "#modelCard", 1.0)
    t.cap("5 · Modèle quadratique ajusté sur chaque réponse : R² et Q² (validation croisée) proches de 1.", 0.3)
    t.hover(p.locator("#stats"), 2.6)
    t.cap("Le graphique des effets classe les facteurs : l’entrefer g domine.", 0.3)
    t.hover(p.locator("#eff"), 2.6)
    t.cap("Changez de réponse : B moyen dans le noyau.", 0.3)
    t.select(p.locator("#resp"), "B", 2.2)
    t.select(p.locator("#resp"), "LsM", 0.8)
    show(t, "#surf", 0.8)
    t.cap("6 · Surface de réponse : deux facteurs en axes, le troisième par curseur.", 0.3)
    sl = p.locator("#sliders input[type=range]").first
    b = sl.bounding_box()
    t.move(b["x"] + 4, b["y"] + b["height"] / 2)
    p.mouse.down()
    for k in range(1, 13):
        p.mouse.move(b["x"] + 4 + k * (b["width"] - 8) / 12, b["y"] + b["height"] / 2)
        t.wait(0.12)
    p.mouse.up(); t.wait(0.8)
    for k in range(12, -1, -1):
        p.mouse.move(b["x"] + 4 + k * (b["width"] - 8) / 12, b["y"] + b["height"] / 2)
        t.wait(0.06)
    p.mouse.down(); p.mouse.up(); t.wait(0.4)
    show(t, "#dir", 0.9)
    t.cap("7 · Optimisation : maximiser L / masse de fer avec B noyau ≤ 1,2 T.", 0.3)
    t.hover(p.locator("#obj"), 1.0); t.hover(p.locator("#cval"), 1.4)
    t.click(p.locator("#optim"), 1.4)
    t.cap("L’optimum est trouvé sur le modèle : la contrainte B = 1,2 T est atteinte.", 2.4)
    t.cap("« Vérifier par simulation » recalcule l’optimum par éléments finis.", 0.3)
    t.click(p.locator("#verify"), 2.4)
    show(t, "#dir", 0.6)
    t.hover(p.locator("#optRes table").nth(1), 2.8)
    show(t, "#surf", 0.8)
    t.cap("La croix marque l’optimum sur la surface ; la ligne rouge est la contrainte.", 3.0)
    show(t, ".card", 0.6)
    t.cap("Les essais s’exportent en CSV pour un tableur.", 0.3)
    t.hover(p.locator("#csv"), 2.0)
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
