// SVG-Zeichnungen der Arten. Erzeugt nur Zeichenketten, kein DOM-Zugriff.

// Pseudozufall mit festem Startwert, damit jede Art immer gleich aussieht
function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
let uid = 0;

function zeichneFisch(o, seed) {
  const p = Object.assign({ r: .24, pos: .38, bellyF: 1, hl: .24, snout: .5, mouth: "end", ped: .3,
    back: "#4a5a5e", side: "#c8cecc", belly: "#f2f2ee", fin: "#9aa3a0", tail: "fork", depth: .35,
    dorsal: [{ at: .42, w: .16, h: .55 }], adipose: false, anal: { at: .7, w: .1, h: .4 }, pelvic: .5, pect: 1,
    iris: null, eyeBig: 1, barbels: 0, barbLen: 1, spots: [], bands: 0, bandC: "rgba(30,35,25,.45)", lateral: null,
    scales: false, eel: false, scutes: false, finEdge: null, redFins: null }, o);
  const id = "f" + (uid++), R = rng(seed);
  const cy = 50, x0 = 12, x1 = p.eel ? 226 : 192, L = x1 - x0;
  const H = Math.min(38, p.r * L / 2);
  const noseOff = p.mouth === "under" ? -H * .22 : p.mouth === "up" ? H * .18 : 0;
  const pw = .4 + p.snout * 1.2;
  const prof = (t, k) => (t = Math.min(1, Math.max(0, t))) < p.pos ? Math.pow(Math.sin(Math.PI / 2 * t / p.pos), pw)
    : k + (1 - k) * Math.pow(Math.cos(Math.PI / 2 * (t - p.pos) / (1 - p.pos)), 1.3);
  const fade = t => Math.max(0, 1 - t / p.pos);
  const top = t => cy - H * prof(t, p.ped) + noseOff * fade(t);
  const bot = t => cy + H * p.bellyF * prof(t, p.ped) + noseOff * fade(t);
  const X = t => x0 + t * L;
  const N = 60; let pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([X(t), top(t)]); }
  for (let i = N; i >= 0; i--) { const t = i / N; pts.push([X(t), bot(t)]); }
  const body = "M" + pts.map(q => q[0].toFixed(1) + "," + q[1].toFixed(1)).join("L") + "Z";
  const ph = H * p.ped, tl = 30, tH = Math.min(H * .8, 30);
  let s = `<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" role="img"><defs>
    <linearGradient id="${id}g" x1="0" y1="${cy - H}" x2="0" y2="${cy + H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${p.back}"/><stop offset=".5" stop-color="${p.side}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient>
    <clipPath id="${id}c"><path d="${body}"/></clipPath></defs>`;
  const fin = (c, e) => `fill="${c || p.fin}" stroke="${e ? p.finEdge : "var(--fishline)"}" stroke-width="${e ? 1.6 : .7}"`;

  // Schwanzflosse
  if (!p.eel) {
    let tp;
    if (p.tail === "round") tp = `M${x1 - 2},${cy - ph}Q${x1 + tl},${cy - ph - tH * .6} ${x1 + tl},${cy}Q${x1 + tl},${cy + ph + tH * .6} ${x1 - 2},${cy + ph}Z`;
    else if (p.tail === "hetero") tp = `M${x1 - 2},${cy - ph}L${x1 + tl + 6},${cy - ph - tH * 1.1}L${x1 + tl * .9},${cy - ph - tH * .9}L${x1 + tl * .4},${cy + ph + tH * .5}L${x1 - 2},${cy + ph}Z`;
    else tp = `M${x1 - 2},${cy - ph}L${x1 + tl},${cy - ph - tH}Q${x1 + tl * (1 - p.depth) - 2},${cy} ${x1 + tl},${cy + ph + tH}L${x1 - 2},${cy + ph}Z`;
    s += `<path d="${tp}" ${fin()}/>`;
  } else {
    // durchgehender Flossensaum beim Aal
    const a = p.dStart || .38, b = .6; let fp = "M" + X(a) + "," + top(a);
    for (let t = a; t <= 1.001; t += .02) fp += "L" + X(t).toFixed(1) + "," + (top(t) - 5 * Math.min(1, (t - a) * 8)).toFixed(1);
    fp += `L${x1 + 8},${cy}`;
    for (let t = 1; t >= b; t -= .02) fp += "L" + X(t).toFixed(1) + "," + (bot(t) + 4 * Math.min(1, (t - b) * 8)).toFixed(1);
    fp += "L" + X(b) + "," + bot(b) + "Z";
    if (!p.noFin) s += `<path d="${fp}" ${fin()}/>`;
  }
  // Rückenflossen
  (p.eel ? [] : p.dorsal).forEach(d => {
    const a = d.at, b = d.at + d.w, h = H * d.h;
    const ya = top(a), yb = top(b);
    let dp;
    if (d.round) dp = `M${X(a)},${ya + 1}Q${X(a + d.w * .1)},${ya - h} ${X(a + d.w * .5)},${Math.min(ya, yb) - h}Q${X(b)},${yb - h * .8} ${X(b)},${yb + 1}Z`;
    else dp = `M${X(a)},${ya + 1}L${X(a + d.w * .18)},${ya - h}Q${X(a + d.w * .6)},${(ya + yb) / 2 - h * .55} ${X(b)},${yb - h * .15}L${X(b)},${yb + 1}Z`;
    s += `<path d="${dp}" ${fin(d.c, !d.c && p.finEdge)}/>`;
    if (d.spiky) for (let i = 1; i < 7; i++) { const t = a + d.w * i / 7; s += `<line x1="${X(t)}" y1="${top(t)}" x2="${X(t) + 1}" y2="${top(t) - h * (i < 3 ? .95 : .7)}" stroke="var(--fishline)" stroke-width=".6"/>`; }
    if (d.spot) s += `<ellipse cx="${X(b - d.w * .15)}" cy="${yb - h * .35}" rx="3" ry="2.6" fill="#1a1a1a"/>`;
    if (d.dots) for (let i = 0; i < 5; i++) s += `<circle cx="${X(a + d.w * (.2 + i * .15))}" cy="${top(a) - h * .45}" r="1.1" fill="#2a2a2a"/>`;
  });
  if (p.adipose) { const a = .8, yb = top(a); s += `<path d="M${X(a)},${yb + 1}Q${X(a + .03)},${yb - H * .3} ${X(a + .06)},${top(a + .06) + 1}Z" ${fin()}/>`; }
  // Afterflosse
  if (p.anal && !p.eel) { const a = p.anal.at, b = a + p.anal.w, h = H * p.anal.h;
    s += `<path d="M${X(a)},${bot(a) - 1}L${X(a + p.anal.w * .2)},${bot(a) + h}Q${X(a + p.anal.w * .6)},${(bot(a) + bot(b)) / 2 + h * .5} ${X(b)},${bot(b) + h * .1}L${X(b)},${bot(b) - 1}Z" ${fin(p.redFins, !p.redFins && p.finEdge)}/>`; }
  // Bauchflosse
  if (p.pelvic && !p.eel) { const a = p.pelvic; s += `<path d="M${X(a)},${bot(a) - 1}L${X(a + .02)},${bot(a) + H * .42}L${X(a + .07)},${bot(a + .06)}Z" ${fin(p.redFins, !p.redFins && p.finEdge)}/>`; }

  // Körper
  s += `<path d="${body}" fill="url(#${id}g)"/>`;
  s += `<g clip-path="url(#${id}c)">`;
  if (p.scales) { for (let x = X(p.hl + .03); x < x1 - 4; x += 6) for (let y = cy - H; y < cy + H; y += 5) s += `<path d="M${x},${y + ((x / 6 | 0) % 2) * 2.5}q3,3 6,0" fill="none" stroke="rgba(40,30,10,.28)" stroke-width=".6"/>`; }
  if (p.lateral) s += `<rect x="${X(p.hl)}" y="${cy - H * .12 + noseOff * 0}" width="${L}" height="${p.latH || H * .22}" fill="${p.lateral}" opacity=".75"/>`;
  if (p.lines) for (let i = 0; i < p.lines; i++) s += `<rect x="${X(p.hl)}" y="${cy - H * .55 + i * H * .35}" width="${L}" height="1.6" fill="rgba(30,25,10,.6)"/>`;
  for (let i = 0; i < p.bands; i++) { const t = .3 + i * (.55 / Math.max(1, p.bands - 1)); s += `<path d="M${X(t) - 3},${cy - H}L${X(t) + 3},${cy - H}L${X(t) + (p.oblique ? -4 : 1.5)},${cy + H * .45}L${X(t) + (p.oblique ? -9 : -2)},${cy + H * .45}Z" fill="${p.bandC}"/>`; }
  p.spots.forEach(sp => {
    for (let i = 0; i < sp.n; i++) {
      const t = (sp.from || .14) + R() * ((sp.to || .95) - (sp.from || .14));
      const yt = top(t), yb = bot(t);
      let y; if (sp.area === "up") y = yt + (cy - yt) * (.15 + R() * .8); else if (sp.area === "top") y = yt + (cy - yt) * (.05 + R() * .45);
      else if (sp.area === "mid") y = cy - (cy - yt) * .5 + R() * (yb - yt) * .45; else y = yt + (yb - yt) * (.1 + R() * .75);
      const r = (sp.r || 1.6) * (.75 + R() * .5), x = X(t);
      if (sp.ring) s += `<circle cx="${x}" cy="${y}" r="${r + 1.3}" fill="${sp.ring}"/>`;
      if (sp.x) s += `<path d="M${x - r},${y - r}L${x + r},${y + r}M${x + r},${y - r}L${x - r},${y + r}" stroke="${sp.c}" stroke-width="1.1"/>`;
      else if (sp.long) s += `<ellipse cx="${x}" cy="${y}" rx="${r * 1.8}" ry="${r * .8}" fill="${sp.c}" opacity="${sp.op || 1}"/>`;
      else s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${sp.c}" opacity="${sp.op || 1}"/>`;
    }
  });
  if (p.scutes) for (let t = .2; t < .95; t += .055) { s += `<path d="M${X(t)},${top(t) + 3}l2,-3l2,3z" fill="#e8e2c8"/><path d="M${X(t)},${cy + 1}l2,-2.5l2,2.5z" fill="#e8e2c8"/>`; }
  if (p.gills) for (let i = 0; i < 7; i++) s += `<circle cx="${X(.06 + i * .022)}" cy="${cy - 1}" r="1.1" fill="#2a2a20"/>`;
  s += `</g>`;
  s += `<path d="${body}" fill="none" stroke="var(--fishline)" stroke-width=".9"/>`;
  // Brustflosse
  if (p.pect && !p.gills) { const a = p.hl + .02, y = cy + H * .3; const big = p.pect;
    s += `<path d="M${X(a)},${y}Q${X(a + .06 * big)},${y + H * .15 * big} ${X(a + .1 * big)},${y + H * .35 * big}Q${X(a + .04)},${y + H * .3} ${X(a)},${y + 2}Z" ${fin(p.redFins)}/>`; }
  // Kiemendeckel, Auge, Maul
  if (!p.eel || p.gillLine) { const g = p.hl; s += `<path d="M${X(g)},${top(g) + 3}Q${X(g) + 5},${cy} ${X(g)},${bot(g) - 3}" fill="none" stroke="var(--fishline)" stroke-width=".9"/>`; }
  const et = p.hl * .38 * (p.eel ? .5 : 1), ex = X(et), ey = top(et) + (cy - top(et)) * .5 + noseOff * .2;
  const er = Math.max(2.2, H * .13) * p.eyeBig;
  s += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="${p.iris || "#e9e4cf"}" stroke="var(--fishline)" stroke-width=".6"/><circle cx="${ex + .3}" cy="${ey}" r="${er * .55}" fill="#111"/>`;
  const my = top(0.01) + (bot(0.01) - top(0.01)) * (p.mouth === "under" ? .9 : p.mouth === "up" ? .15 : .55);
  const mlen = (p.bigMouth ? .13 : p.smallMouth ? .03 : .06) * L;
  s += `<path d="M${x0 + 1},${my}L${x0 + mlen},${my + (p.mouth === "up" ? 4 : 1.5)}" stroke="var(--fishline)" stroke-width="1" fill="none"/>`;
  // Barteln
  for (let i = 0; i < p.barbels; i++) {
    const long = p.barbels === 1 ? 1.2 : (i < 2 ? 1 : .45);
    const bx = x0 + 3 + i * 2.5, by = my + 1, len = 9 * long * p.barbLen;
    s += `<path d="M${bx},${by}q${-len * .5},${len * .5} ${-len * .1 + i},${len}" fill="none" stroke="#3a2e1e" stroke-width=".9" stroke-linecap="round"/>`;
  }
  return s + `</svg>`;
}

function zeichneKrebs(o) {
  const c = o.c || "#5a3e2c", u = o.u || "#b8442c", sc = o.scale || 1;
  const g = `<g transform="translate(${120 - 110 * sc} ${50 - 40 * sc}) scale(${sc})">`;
  return `<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" role="img">${g}
    <path d="M150,40 q40,-6 62,4 l8,-5 l-2,12 l2,12 l-8,-5 q-22,10 -62,4z" fill="${c}" stroke="var(--fishline)" stroke-width=".8"/>
    ${[0,1,2,3,4].map(i => `<path d="M${168 + i * 9},38 v24" stroke="var(--fishline)" stroke-width=".6"/>`).join("")}
    <ellipse cx="120" cy="50" rx="34" ry="16" fill="${c}" stroke="var(--fishline)" stroke-width=".8"/>
    <path d="M88,50 l-10,-3 l10,-3z" fill="${c}"/>
    ${[0,1,2,3].map(i => `<path d="M${108 + i * 10},62 l-6,16 M${108 + i * 10},38 l-6,-16" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`).join("")}
    <path d="M92,44 C70,30 50,30 40,32" stroke="${c}" stroke-width="4" fill="none"/>
    <path d="M92,56 C70,70 50,70 40,68" stroke="${c}" stroke-width="4" fill="none"/>
    <path d="M40,32 q-26,-10 -30,2 q8,6 30,4z" fill="${c}" stroke="${u}" stroke-width="2.5"/>
    <path d="M40,68 q-26,10 -30,-2 q8,-6 30,-4z" fill="${c}" stroke="${u}" stroke-width="2.5"/>
    ${o.weiss ? `<circle cx="42" cy="35" r="2.5" fill="#e8f2f0"/>` : ""}
    <path d="M90,46 q-40,-30 -80,-36 M90,54 q-40,30 -80,36" stroke="${c}" stroke-width=".8" fill="none"/>
    <circle cx="94" cy="45" r="2" fill="#111"/></g></svg>`;
}
function zeichneMuschel() {
  let rings = ""; for (let i = 1; i < 6; i++) rings += `<path d="M${60 + i * 4},${62 - i} Q120,${12 + i * 7} ${185 - i * 6},${58 - i}" fill="none" stroke="rgba(30,25,10,.35)" stroke-width=".8"/>`;
  return `<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" role="img"><path d="M55,64 Q60,20 120,18 Q190,20 192,58 Q180,80 120,80 Q62,80 55,64z" fill="#4e4a2e" stroke="var(--fishline)"/>${rings}<circle cx="88" cy="32" r="5" fill="#6e6a48"/></svg>`;
}

/* ---------- Zeichenparameter je Art (Schlüssel = id aus data/regeln-bw.json) ---------- */
// seed: Startwert für das Punktmuster. Ohne Angabe wird die id verwendet.
const BLACK = "#1b1b1b";
const SILBER = { back: "#4a6070", side: "#ccd4d8", belly: "#f6f6f4", fin: "#9aa6aa" };
const BILD = {
  bachforelle: { r: .22, back: "#5d5a2e", side: "#b8a15a", belly: "#f2e6c4", fin: "#9a8a4c", adipose: true, depth: .12,
      spots: [{ c: BLACK, n: 26, area: "up", r: 1.5 }, { c: "#d1352b", ring: "#f4ecd8", n: 11, area: "mid", r: 1.5 }] },
  regenbogen: { r: .23, back: "#4d6a5e", side: "#c9cfc6", belly: "#f1f1ea", fin: "#8fa098", adipose: true, depth: .15, lateral: "#d87aa0",
      spots: [{ c: BLACK, n: 55, area: "all", r: 1.1, to: 1.0 }] },
  seeforelle: { r: .24, back: "#4d5d66", side: "#c6ccd0", belly: "#f4f4f0", fin: "#8c979c", adipose: true, depth: .12, bigMouth: true,
      spots: [{ c: BLACK, n: 16, area: "up", r: 1.8, x: true }] },
  bachsaibling: { r: .23, back: "#3e4a2a", side: "#8a7a3a", belly: "#e66b2a", fin: "#e46a2a", finEdge: "#f6f4ee", adipose: true, depth: .12,
      spots: [{ c: "#e8d27a", n: 30, area: "top", r: 1.4, long: true }, { c: "#e8d27a", n: 14, area: "up", r: 1.2 }, { c: "#d1352b", ring: "#5a8ad8", n: 8, area: "mid", r: 1.2 }] },
  seesaibling: { r: .22, back: "#4a5a5e", side: "#a8a890", belly: "#d9573a", fin: "#d26a4a", finEdge: "#f6f4ee", adipose: true, depth: .2,
      spots: [{ c: "#ece6c8", n: 12, area: "up", r: 1.2, op: .7 }] },
  aesche: { r: .21, back: "#3f4c55", side: "#a9b2b4", belly: "#eef0ee", fin: "#7a6888", smallMouth: true, adipose: true, depth: .3, snout: .7,
      dorsal: [{ at: .3, w: .3, h: 1.35, round: true, c: "#6f5a86" }], spots: [{ c: BLACK, n: 8, area: "up", r: 1.2, from: .2, to: .4 }] },
  huchen: { r: .17, back: "#5b4a3a", side: "#b88a60", belly: "#eadccb", fin: "#9a7a5a", adipose: true, bigMouth: true, snout: .7, depth: .12,
      spots: [{ c: BLACK, n: 30, area: "up", r: 1 }] },
  felchen: { r: .22, back: "#556c78", side: "#cfd6d8", belly: "#f6f6f4", fin: "#9aa6aa", adipose: true, depth: .55, hl: .2, smallMouth: true },
  hecht: { r: .16, pos: .5, snout: 1.1, hl: .3, bigMouth: true, back: "#3b4a26", side: "#7f8c45", belly: "#ece7c9", fin: "#8a6a3a", depth: .2,
      dorsal: [{ at: .74, w: .12, h: .65 }], anal: { at: .76, w: .1, h: .5 }, pelvic: .56,
      spots: [{ c: "#d8d3a0", n: 34, area: "all", r: 1.6, long: true, from: .3 }] },
  zander: { r: .2, back: "#4f5a52", side: "#a9afa4", belly: "#eeeeea", fin: "#8f968c", iris: "#d9e2cc", eyeBig: 1.3, snout: .75, bigMouth: true, bands: 7, bandC: "rgba(40,45,35,.22)", depth: .25,
      dorsal: [{ at: .3, w: .2, h: .75, spiky: true, dots: true }, { at: .53, w: .2, h: .55 }] },
  aal: { eel: true, r: .07, pos: .2, ped: .22, hl: .1, back: "#3a3a28", side: "#5e5a3a", belly: "#d9cf9a", fin: "#5a5638", gillLine: true, pect: .6 },
  quappe: { r: .17, pos: .25, hl: .24, snout: .15, ped: .22, back: "#4a4a30", side: "#7d7650", belly: "#d8d2b0", fin: "#6a6444", tail: "round", barbels: 1,
      dorsal: [{ at: .28, w: .1, h: .4, round: true }, { at: .42, w: .44, h: .35, round: true }], anal: { at: .5, w: .36, h: .32 },
      spots: [{ c: "#3a3a22", n: 40, area: "all", r: 2.2, op: .5 }] },
  rapfen: { r: .23, back: "#4a5a68", side: "#c8ced2", belly: "#f4f4f2", fin: "#a6aaa8", mouth: "up", bigMouth: true, snout: .6, depth: .5 },
  barsch: { r: .31, pos: .4, back: "#4b5a2a", side: "#a4a250", belly: "#eee6c0", fin: "#a8a070", redFins: "#d0502c", bands: 6, depth: .25,
      dorsal: [{ at: .28, w: .22, h: .75, spiky: true, spot: true }, { at: .53, w: .18, h: .55 }] },
  wels: { r: .2, pos: .22, hl: .26, snout: .1, ped: .22, back: "#2f3330", side: "#5e6058", belly: "#d8d6c8", fin: "#4a4c46", tail: "round", barbels: 6, barbLen: 1.8, bigMouth: true, eyeBig: .6,
      dorsal: [{ at: .3, w: .05, h: .4 }], anal: { at: .5, w: .46, h: .32 }, pelvic: .45,
      spots: [{ c: "#1e221f", n: 30, area: "all", r: 2.4, op: .45 }] },
  karpfen: { r: .34, pos: .42, back: "#5b4a22", side: "#b89a4a", belly: "#ead9a0", fin: "#8a6a3a", barbels: 4, scales: true, mouth: "under", depth: .3,
      dorsal: [{ at: .4, w: .34, h: .55 }] },
  karausche: { r: .42, pos: .42, back: "#5a4a20", side: "#b8964a", belly: "#e6d49a", fin: "#8a6a3a", scales: true, hl: .2, depth: .12,
      dorsal: [{ at: .38, w: .36, h: .42, round: true }], anal: { at: .66, w: .1, h: .35 }, spots: [{ c: "#2a2418", n: 1, from: .93, to: .94, area: "mid", r: 3.2, op: .75 }] },
  schleie: { r: .28, back: "#3c4a22", side: "#6f7a3a", belly: "#c8c070", fin: "#3c4a22", iris: "#c8402c", barbels: 2, barbLen: .5, depth: .04,
      dorsal: [{ at: .44, w: .14, h: .6, round: true }], anal: { at: .68, w: .12, h: .45 } },
  barbe: { r: .2, pos: .35, back: "#6a5a3a", side: "#c0a878", belly: "#f0e6cc", fin: "#c87a4a", mouth: "under", barbels: 4, snout: .75, bellyF: .75, depth: .35 },
  nase: { r: .22, back: "#4a5258", side: "#c3c8ca", belly: "#f2f2ee", fin: "#d77a5a", mouth: "under", snout: .3, depth: .4 },
  aland: { r: .29, back: "#4a5560", side: "#d2ccb0", belly: "#f2eedf", fin: "#d77a6a", hl: .21, depth: .35 },
  rotauge: { r: .3, back: "#3f5a62", side: "#d2d6d4", belly: "#f6f6f2", fin: "#d77a6a", iris: "#d8402c", pelvic: .43, dorsal: [{ at: .43, w: .14, h: .6 }], depth: .35 },
  rotfeder: { r: .32, back: "#5a5a30", side: "#d2c68a", belly: "#f2ecd2", fin: "#e0403a", mouth: "up", pelvic: .4, dorsal: [{ at: .5, w: .13, h: .6 }], depth: .35 },
  brachse: { r: .42, pos: .42, back: "#4a4a3a", side: "#a49a7a", belly: "#e2dccc", fin: "#5a5a52", mouth: "under", hl: .18, smallMouth: true, depth: .4,
      dorsal: [{ at: .46, w: .12, h: .55 }], anal: { at: .55, w: .3, h: .32 } },
  doebel: { r: .23, hl: .28, snout: .2, back: "#3e4a46", side: "#c6c4ae", belly: "#f0eee2", fin: "#d8805a", scales: true, bigMouth: true, depth: .3 },
  edelkrebs_w: { kind: "krebs", c: "#5a3e2c", u: "#c8442c", scale: .95 },
  edelkrebs_m: { kind: "krebs", c: "#5a3e2c", u: "#c8442c" },
  lachs: { seed: "gj0", ...SILBER, r: .22, adipose: true, depth: .25, ped: .24, spots: [{ c: BLACK, n: 9, area: "top", r: 1.6, x: true }] },
  meerforelle: { seed: "gj1", ...SILBER, r: .23, adipose: true, depth: .12, spots: [{ c: BLACK, n: 22, area: "all", r: 1.6, x: true }] },
  neunaugen: { seed: "gj2", eel: true, r: .07, pos: .2, ped: .22, hl: .1, back: "#4e4a3a", side: "#8a8466", belly: "#e2dcc4", fin: "#7a7458", gills: true, dStart: .55, pect: 0 },
  stoer: { seed: "gj3", r: .17, snout: 1, mouth: "under", back: "#4a4e48", side: "#9a9a8a", belly: "#e6e4d8", fin: "#6a6c64", tail: "hetero", ped: .2, scutes: true, barbels: 4, barbLen: .6, dorsal: [{ at: .7, w: .1, h: .55 }] },
  wandermaraene: { seed: "gj4", ...SILBER, r: .2, snout: 1, mouth: "under", adipose: true, depth: .5 },
  maifisch: { seed: "gj5", ...SILBER, r: .3, depth: .5, spots: [{ c: "#2a2a2a", n: 1, area: "up", r: 3, from: .27, to: .28 }] },
  finte: { seed: "gj6", ...SILBER, r: .28, depth: .5, spots: [{ c: "#2a2a2a", n: 6, area: "up", r: 2.2, from: .27, to: .65 }] },
  frauennerfling: { seed: "gj7", r: .27, back: "#5a5a3a", side: "#d8c47a", belly: "#f2e8c4", fin: "#c8a058", mouth: "under", smallMouth: true, depth: .35 },
  stroemer: { seed: "gj8", r: .2, back: "#4a5248", side: "#c2c4b6", belly: "#f2f0e6", fin: "#d89a60", lateral: "#2e3430", latH: 4, depth: .35 },
  schneider: { seed: "gj9", r: .26, back: "#4a5a58", side: "#d4d8d4", belly: "#f6f6f2", fin: "#c8a888", lines: 0, lateral: "#3a4442", latH: 2, depth: .35 },
  zaehrte: { seed: "gj10", r: .24, back: "#3a4450", side: "#c6cacc", belly: "#f2f2ee", fin: "#9aa0a2", mouth: "under", snout: .4, depth: .4 },
  bitterling: { seed: "gj11", r: .34, back: "#5a6a6a", side: "#d0d6d2", belly: "#f4f2ea", fin: "#c89a88", depth: .3, spots: [{ c: "#2a9a8a", n: 14, area: "mid", r: 1.6, long: true, from: .55, to: .95 }] },
  schlammpeitzger: { seed: "gj12", eel: true, r: .1, pos: .25, ped: .3, hl: .12, back: "#4a3e2a", side: "#a08a5a", belly: "#e8d8a8", fin: "#7a6848", barbels: 6, barbLen: .5, lines: 3, dStart: .6, gillLine: true },
  steinbeisser: { seed: "gj13", r: .13, back: "#a89068", side: "#e0d4b4", belly: "#f6f0de", fin: "#d8ccaa", tail: "round", barbels: 4, barbLen: .4, mouth: "under", spots: [{ c: "#4a3a22", n: 14, area: "mid", r: 1.8 }, { c: "#4a3a22", n: 18, area: "top", r: 1 }] },
  schraetzer: { seed: "gj14", r: .2, back: "#7a7030", side: "#d8c860", belly: "#f2ecc4", fin: "#c8b860", lines: 3, snout: .7, dorsal: [{ at: .3, w: .44, h: .5, spiky: true }] },
  streber: { seed: "gj15", r: .14, ped: .15, back: "#6a5a3a", side: "#c8b48a", belly: "#efe6cc", fin: "#b8a47a", bands: 4, oblique: true, mouth: "under", dorsal: [{ at: .32, w: .16, h: .8, spiky: true }, { at: .6, w: .14, h: .7 }] },
  zingel: { seed: "gj16", r: .16, ped: .2, back: "#6a5a3a", side: "#c8b48a", belly: "#efe6cc", fin: "#b8a47a", bands: 4, oblique: true, mouth: "under", dorsal: [{ at: .3, w: .18, h: .75, spiky: true }, { at: .56, w: .2, h: .65 }] },
  groppe: { seed: "gj17", r: .24, pos: .18, hl: .3, snout: .1, ped: .22, back: "#5a5038", side: "#8a7a58", belly: "#d8d0b4", fin: "#7a6c4c", tail: "round", pect: 2.2, bigMouth: true, dorsal: [{ at: .32, w: .14, h: .4, round: true }, { at: .48, w: .34, h: .45, round: true }], anal: { at: .52, w: .3, h: .3 }, spots: [{ c: "#3a3222", n: 26, area: "all", r: 2.6, op: .55 }] },
  dohlenkrebs: { seed: "gj18", kind: "krebs", c: "#6a5a3a", u: "#d8ccb0", scale: .8 },
  steinkrebs: { seed: "gj19", kind: "krebs", c: "#7a6a4a", u: "#e0d6c0", scale: .7 },
  grossmuscheln: { seed: "gj20", kind: "muschel" },
};

export function bildFuer(id) {
  const b = BILD[id];
  if (!b) return "";
  if (b.kind === "krebs") return zeichneKrebs(b);
  if (b.kind === "muschel") return zeichneMuschel();
  return zeichneFisch(b, b.seed || id);
}
