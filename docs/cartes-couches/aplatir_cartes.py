# Recompose l'image unique de chaque carte (720 x 1024) à partir des calques : illustration dessous, cadre dessus.
# Sert aux endroits qui affichent une seule image (miniatures du Casier, pouvoir de Juanita, repli cards_layered = off).
# Lancer depuis la racine du dépôt, après decoupe_calques.py, sans_bandeau.py et masques_effets.py.
# Les images d'origine (avec bandeau) restent dans web/public/cards/sources/ : ce sont elles que lisent les scripts de découpe.
import json, os, sys
from PIL import Image
CAL = 'web/public/cards/calques'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'web/public/cards'
W, H = 720, 1024
# CON est un nom de périphérique réservé sous Windows : la carte Con le belliqueux est le fichier corbin.webp (comme web/src/cards.ts)
FICHIER = {'con': 'corbin'}
info = json.load(open(f'{CAL}/calques.json'))
for k, d in info.items():
    a0, b0, a1, b1 = d['illu']
    card = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    illu = Image.open(f'{CAL}/illu_{k}.jpg').convert('RGBA').resize((a1 - a0, b1 - b0), Image.LANCZOS)
    card.paste(illu, (a0, b0))
    cadre = Image.open(f'{CAL}/cadre_{k}.webp').convert('RGBA')
    card.alpha_composite(cadre)
    # coins arrondis : la transparence vient du cadre (l'illustration ne couvre que la fenêtre)
    card.save(f'{OUT}/{FICHIER.get(k, k)}.webp', quality=90, method=6)
    print(k)
