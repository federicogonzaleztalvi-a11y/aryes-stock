#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Pagina "Vendedores digitales" para el deck de Pazque. Diseno nivel pitch-deck
# premium, consistente con el sistema del PDF (HelveticaNeue real, verde #0e795e).
import os, math
import fitz

SRC = "Pazque-Presentacion-ORIGINAL.pdf"
OUT = "Pazque-Presentacion.pdf"
REG = "/tmp/HelveticaNeue-Regular.ttf"
BLD = "/tmp/HelveticaNeue-Bold.ttf"

def rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))

GREEN, GREEN_EYE = rgb("0e795e"), rgb("0f7a5f")
DARK, GRAY, GRAYFT = rgb("1d1d1f"), rgb("6e6e73"), rgb("86868b")
BORDER, DIVIDER = rgb("e5e5ea"), rgb("e7e7ec")
TINT, TINT_BORDER = rgb("eef7f3"), rgb("d7ebe2")
WHITE = (1, 1, 1)

doc = fitz.open(SRC)
W, H = 595, 842
page = doc.new_page(pno=4, width=W, height=H)
fB = fitz.Font(fontfile=BLD)
fR = fitz.Font(fontfile=REG)

def bold(pt, text, size, color):
    page.insert_text(pt, text, fontsize=size, fontname="HNB", fontfile=BLD, color=color)

def box(rect, text, size, color, fb_, lh=1.32, align=0):
    page.insert_textbox(rect, text, fontsize=size,
                        fontname=("HNB" if fb_ == "b" else "HNR"),
                        fontfile=(BLD if fb_ == "b" else REG),
                        color=color, lineheight=lh, align=align)

def tracked(x, y, text, size, color, track):
    cur = x
    for ch in text:
        page.insert_text((cur, y), ch, fontsize=size, fontname="HNB", fontfile=BLD, color=color)
        cur += fB.text_length(ch, size) + track

L, Rr = 62, 533

# ======= ICONOS (trazo blanco dentro del chip) =======
def stroke(pts, w=1.6, closed=False):
    s = page.new_shape()
    s.draw_polyline(pts)
    s.finish(color=WHITE, width=w, lineCap=1, lineJoin=1, closePath=closed)
    s.commit()

def arc_pts(cx, cy, r, a0, a1, n=28):
    return [(cx + r*math.cos(t), cy + r*math.sin(t))
            for t in [a0 + (a1-a0)*i/(n-1) for i in range(n)]]

def ico_target(cx, cy):          # clientes nuevos (apuntar / captar)
    for r in (7.2, 3.6):
        s = page.new_shape(); s.draw_circle((cx, cy), r)
        s.finish(color=WHITE, width=1.5); s.commit()
    s = page.new_shape(); s.draw_circle((cx, cy), 1.1)
    s.finish(color=WHITE, fill=WHITE); s.commit()

def _arrowhead(tip, ang, size=3.4):
    for d in (ang + math.radians(150), ang - math.radians(150)):
        stroke([tip, (tip[0] + size*math.cos(d), tip[1] + size*math.sin(d))], w=1.6)

def ico_recover(cx, cy):         # recuperar venta (flecha de retorno)
    pts = arc_pts(cx, cy, 7, math.radians(60), math.radians(330))
    stroke(pts, w=1.6)
    tip = pts[-1]
    tang = math.atan2(pts[-1][1]-pts[-2][1], pts[-1][0]-pts[-2][0])
    _arrowhead(tip, tang)

def ico_trend(cx, cy):           # subir el ticket (flecha ascendente)
    stroke([(cx-7, cy+6), (cx-1.5, cy-0.5), (cx+1.5, cy+2), (cx+7, cy-6)], w=1.7)
    _arrowhead((cx+7, cy-6), math.atan2(-6-2, 7-1.5), size=3.6)

def ico_repeat(cx, cy):          # volver a comprar (dos flechas en ciclo)
    a = arc_pts(cx, cy, 7, math.radians(-40), math.radians(150))
    stroke(a, w=1.6); _arrowhead(a[-1], math.atan2(a[-1][1]-a[-2][1], a[-1][0]-a[-2][0]))
    b = arc_pts(cx, cy, 7, math.radians(140), math.radians(330))
    stroke(b, w=1.6); _arrowhead(b[-1], math.atan2(b[-1][1]-b[-2][1], b[-1][0]-b[-2][0]))

def ico_clock(cx, cy):           # 24/7
    s = page.new_shape(); s.draw_circle((cx, cy), 8.2)
    s.finish(color=WHITE, width=1.6); s.commit()
    stroke([(cx, cy), (cx, cy-4.6)], w=1.6)
    stroke([(cx, cy), (cx+3.4, cy+1.2)], w=1.6)

# ======= ENCABEZADO =======
tracked(L, 78, "TU EQUIPO DIGITAL", 8.2, GREEN_EYE, 1.6)
bold((L, 112), "Vendedores digitales", 24.8, DARK)
bold((L, 142), "que trabajan 24/7 por vos.", 24.8, DARK)
box(fitz.Rect(L, 158, Rr, 214),
    "Pazque no es solo un portal. Adentro trabaja un equipo de agentes que consiguen "
    "clientes, recuperan ventas y hacen que te vuelvan a comprar \u2014 solos, de d\u00eda y de "
    "noche, sin que levantes el tel\u00e9fono.",
    10.5, GRAY, "r", lh=1.35)

# ======= GRILLA 2x2 (embudo: conseguir / recuperar / agrandar / retener) =======
cards = [
    (ico_target,  "Clientes nuevos sin buscarlos",
     "Pazque busca compradores que encajan con tu distribuidora y te los acerca listos para contactar."),
    (ico_recover, "Recuper\u00e1 ventas que se escapan",
     "Si un cliente deja el carrito sin confirmar, Pazque le escribe y rescata la venta antes de que se pierda."),
    (ico_trend,   "Sub\u00ed el ticket de cada pedido",
     "El portal sugiere lo relacionado y el \u201cvolver a pedir\u201d en un toque. Cada compra tiende a ser m\u00e1s grande."),
    (ico_repeat,  "Que te vuelvan a comprar",
     "Aprende el ritmo de cada cliente y le recuerda reponer lo de siempre, justo antes de que se quede sin stock."),
]

col_w, gap_x, gap_y, card_h = 230, 11, 22, 146
x0s = [L, L + col_w + gap_x]
y0s = [248, 248 + card_h + gap_y]

for i, (draw_ico, title, body) in enumerate(cards):
    cx, cy = x0s[i % 2], y0s[i // 2]
    page.draw_rect(fitz.Rect(cx, cy, cx + col_w, cy + card_h), color=BORDER, fill=WHITE, width=1)
    page.draw_rect(fitz.Rect(cx + 20, cy + 22, cx + 44, cy + 46), color=None, fill=GREEN)
    draw_ico(cx + 32, cy + 34)
    box(fitz.Rect(cx + 20, cy + 58, cx + col_w - 16, cy + 80), title, 12.5, DARK, "b", lh=1.1)
    box(fitz.Rect(cx + 20, cy + 83, cx + col_w - 16, cy + card_h - 14), body, 9.7, GRAY, "r", lh=1.36)

# ======= BANDA: portal siempre disponible =======
band_y0 = y0s[1] + card_h + 34
page.draw_rect(fitz.Rect(L, band_y0, Rr, band_y0 + 92), color=TINT_BORDER, fill=TINT, width=1)
page.draw_rect(fitz.Rect(L + 24, band_y0 + 32, L + 52, band_y0 + 60), color=None, fill=GREEN)
ico_clock(L + 38, band_y0 + 46)
tx = L + 76
bold((tx, band_y0 + 40), "Tu portal no cierra nunca.", 13.5, DARK)
box(fitz.Rect(tx, band_y0 + 50, Rr - 24, band_y0 + 88),
    "Tus clientes te compran a cualquier hora \u2014 de madrugada, un domingo, un feriado. "
    "El portal est\u00e1 siempre prendido y los pedidos te llegan ordenados.",
    9.7, GRAY, "r", lh=1.34)

# ======= FOOTER =======
page.draw_line(fitz.Point(L, 789), fitz.Point(Rr, 789), color=DIVIDER, width=1)
box(fitz.Rect(L, 792, Rr, 806),
    "pazque.com \u00b7 La plataforma para distribuidoras", 8.2, GRAYFT, "r", align=2)

tmp = OUT + ".tmp"
doc.save(tmp, deflate=True, garbage=3)
n = doc.page_count; doc.close(); os.replace(tmp, OUT)
print("OK ->", n, "paginas")
