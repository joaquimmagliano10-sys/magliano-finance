/**
 * Gerador paramétrico do manequim e da camiseta base.
 *
 * Por que paramétrico? Com uma única foto não dá para reconstruir o corpo de
 * verdade. O que conseguimos estimar são algumas proporções (ombros, peito,
 * cintura, quadril e altura). Este módulo descreve um manequim estilizado (tipo
 * manequim de loja) cujas seções transversais são superelipses ajustadas a
 * essas medidas, e uma camiseta que "veste" esse corpo com folga e caimento.
 *
 * O script `scripts/build-models.ts` usa este gerador para exportar os .glb
 * (com morph targets) que o visualizador 360° carrega. O código não depende do
 * Three.js: só arrays de números, para rodar em Node e no navegador.
 *
 * Convenções: metros; y para cima; o manequim olha para +z; +x é o lado
 * esquerdo da pessoa (direita de quem olha de frente).
 */
import {
  BASE_BODY,
  BASE_FOLGA,
  type BodyMeasurements,
  type Sexo,
  UV_ATLAS_METERS,
  UV_LAYOUT,
} from "./types";

export type V3 = [number, number, number];
type UV = [number, number];

// ───────────────────────────── vetores ─────────────────────────────
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a);
  return l < 1e-12 ? [0, 0, 0] : mul(a, 1 / l);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** max suave (evita "quinas" onde o tecido passa a encostar no corpo) */
const smax = (a: number, b: number, k = 0.01) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));

/** Interpolação cúbica monotônica (Fritsch–Carlson): suave e sem "overshoot". */
export function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

// ───────────────────────────── seções ─────────────────────────────
/** Seção transversal: superelipse com profundidade frontal (bf) e dorsal (bb) diferentes. */
export interface Section {
  a: number; // meia largura (x)
  bf: number; // profundidade à frente (z+)
  bb: number; // profundidade atrás (z-)
  n: number; // expoente (2 = elipse; maior = mais "quadrado")
  zc: number; // deslocamento do centro em z
}

function superPt(sec: Section, theta: number): [number, number] {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const e = 2 / sec.n;
  const x = sec.a * Math.sign(s) * Math.abs(s) ** e;
  const z = sec.zc + (c >= 0 ? sec.bf : sec.bb) * Math.sign(c) * Math.abs(c) ** e;
  return [x, z];
}

export function sectionPerimeter(sec: Section, samples = 256): number {
  let p = 0;
  let prev = superPt(sec, 0);
  for (let i = 1; i <= samples; i++) {
    const cur = superPt(sec, (i / samples) * Math.PI * 2);
    p += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    prev = cur;
  }
  return p;
}

/** Cria uma seção com a circunferência exata pedida, dada a proporção profundidade/largura. */
function sectionForCirc(circ: number, depthRatio: number, n: number, frontFrac: number, zc = 0): Section {
  const unit: Section = { a: 0.5, bf: depthRatio * frontFrac, bb: depthRatio * (1 - frontFrac), n, zc: 0 };
  const k = circ / sectionPerimeter(unit);
  return { a: unit.a * k, bf: unit.bf * k, bb: unit.bb * k, n, zc };
}

// ───────────────────────────── perfil do corpo ─────────────────────────────
interface Proportions {
  crotch: number;
  hip: number;
  waist: number;
  chest: number;
  armpit: number;
  upperChest: number;
  shoulderJoint: number;
  shoulder: number;
  trap: number;
  neckBase: number;
  neckTop: number;
  headC: number;
  pantsTop: number;
  hem: number;
  knee: number;
  ankle: number;
}

const PROPS: Record<Sexo, Proportions> = {
  masculino: {
    crotch: 0.465, hip: 0.515, waist: 0.61, chest: 0.72, armpit: 0.752, upperChest: 0.79,
    shoulderJoint: 0.81, shoulder: 0.812, trap: 0.834, neckBase: 0.846, neckTop: 0.9, headC: 0.935,
    pantsTop: 0.575, hem: 0.497, knee: 0.285, ankle: 0.048,
  },
  feminino: {
    crotch: 0.47, hip: 0.505, waist: 0.625, chest: 0.715, armpit: 0.752, upperChest: 0.79,
    shoulderJoint: 0.813, shoulder: 0.815, trap: 0.836, neckBase: 0.848, neckTop: 0.9, headC: 0.935,
    pantsTop: 0.585, hem: 0.51, knee: 0.285, ankle: 0.048,
  },
};

/** Proporção profundidade/largura e forma de cada seção-chave (aproximações antropométricas). */
const SHAPES = {
  masculino: {
    chest: { ratio: 0.7, n: 2.5, front: 0.55 },
    waist: { ratio: 0.78, n: 2.2, front: 0.56 },
    hip: { ratio: 0.74, n: 2.3, front: 0.44 },
    neckR: 0.059,
    deltoidR: 0.05,
    upperArm: 0.172,
    foreArm: 0.15,
    hand: 0.105,
    hipJointX: 0.084,
    armAngle: 24,
  },
  feminino: {
    chest: { ratio: 0.74, n: 2.3, front: 0.6 },
    waist: { ratio: 0.72, n: 2.2, front: 0.52 },
    hip: { ratio: 0.72, n: 2.3, front: 0.42 },
    neckR: 0.05,
    deltoidR: 0.043,
    upperArm: 0.168,
    foreArm: 0.145,
    hand: 0.1,
    hipJointX: 0.086,
    armAngle: 22,
  },
} as const;

/** Medidas usadas para gerar o modelo (o gerador sempre trabalha na altura base). */
export interface BodyProfile {
  m: BodyMeasurements;
  H: number;
  y: Record<keyof Proportions, number>;
  section: (y: number) => Section;
  chestSec: Section;
  /** Relevos (peitoral/busto, escápulas, glúteos) somados ao z da superfície. */
  bump: (x: number, y: number, front: boolean) => number;
  neckR: number;
  arm: (side: 1 | -1) => ArmRig;
  armScale: number;
  legScale: number;
  hipJointX: number;
}

export interface ArmRig {
  J: V3; // articulação do ombro
  E: V3; // cotovelo
  W: V3; // punho
  T: V3; // ponta da mão
  d1: V3; // direção do braço
  d2: V3; // direção do antebraço
  upperLen: number;
  foreLen: number;
  handLen: number;
  /** raio [lateral, frontal] a uma distância s (m) do ombro ao longo do braço */
  radius: (s: number) => [number, number];
}

export function buildProfile(m: BodyMeasurements): BodyProfile {
  const sx = m.sexo;
  const P = PROPS[sx];
  const S = SHAPES[sx];
  const H = m.altura;
  const base = BASE_BODY[sx];
  const y = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v * H])) as Record<keyof Proportions, number>;

  const chestSec = sectionForCirc(m.peito, S.chest.ratio, S.chest.n, S.chest.front);
  const waistSec = sectionForCirc(m.cintura, S.waist.ratio, S.waist.n, S.waist.front);
  const hipSec = sectionForCirc(m.quadril, S.hip.ratio, S.hip.n, S.hip.front, -0.005);
  const armScale = (m.peito / base.peito) ** 0.9;
  const legScale = (m.quadril / base.quadril) ** 0.8;
  const deltoidR = S.deltoidR * armScale;
  const jointX = m.ombros / 2 - deltoidR * 0.95;
  const neckR = S.neckR * (0.85 + 0.15 * armScale);

  // Seções-chave, de baixo para cima
  const keys: Array<[number, Section]> = [
    [y.crotch, { a: hipSec.a * 0.93, bf: hipSec.bf * 0.85, bb: hipSec.bb * 0.9, n: 2.2, zc: -0.005 }],
    [y.hip, hipSec],
    [y.waist, waistSec],
    [y.chest, chestSec],
    [y.armpit, { a: chestSec.a * 1.01, bf: chestSec.bf * 0.95, bb: chestSec.bb * 1.05, n: 2.6, zc: 0 }],
    [y.upperChest, { a: lerp(chestSec.a, jointX, 0.55), bf: chestSec.bf * 0.85, bb: chestSec.bb * 0.95, n: 2.8, zc: 0 }],
    [y.shoulder, { a: jointX - 0.004, bf: chestSec.bf * 0.5, bb: chestSec.bb * 0.64, n: 2.8, zc: 0 }],
    [y.trap, { a: neckR + (jointX - neckR) * 0.6, bf: chestSec.bf * 0.42, bb: chestSec.bb * 0.56, n: 2.5, zc: 0.004 }],
    [y.neckBase, { a: neckR * 1.2, bf: neckR * 1.15, bb: neckR * 1.3, n: 2.1, zc: 0.01 }],
    [y.neckTop, { a: neckR * 0.88, bf: neckR * 0.88, bb: neckR * 0.88, n: 2, zc: 0.018 }],
  ];
  const ys = keys.map((k) => k[0]);
  const fa = monotone(ys, keys.map((k) => k[1].a));
  const fbf = monotone(ys, keys.map((k) => k[1].bf));
  const fbb = monotone(ys, keys.map((k) => k[1].bb));
  const fn = monotone(ys, keys.map((k) => k[1].n));
  const fzc = monotone(ys, keys.map((k) => k[1].zc));
  const section = (yy: number): Section => ({ a: fa(yy), bf: fbf(yy), bb: fbb(yy), n: fn(yy), zc: fzc(yy) });

  const fem = sx === "feminino";
  const bustAmp = fem ? 0.024 * (m.peito / base.peito) ** 1.5 : 0.007 * armScale;
  const bustX = fem ? 0.085 : 0.075;
  const bustY = fem ? y.chest : y.chest + 0.012 * H;
  const glute = fem ? 0.02 : 0.012;
  const bump = (x: number, yy: number, front: boolean) => {
    const ax = Math.abs(x);
    if (front) {
      return bustAmp * gauss(ax - bustX, fem ? 0.045 : 0.05) * gauss(yy - bustY, fem ? 0.05 : 0.045);
    }
    const blades = 0.01 * gauss(ax - 0.085, 0.05) * gauss(yy - 0.765 * H, 0.06);
    const glutes = glute * gauss(ax - 0.07, 0.06) * gauss(yy - (y.hip - 0.02), 0.06);
    return -(blades + glutes);
  };

  const arm = (side: 1 | -1): ArmRig => {
    const alpha = (S.armAngle * Math.PI) / 180;
    const J: V3 = [side * jointX, y.shoulderJoint, -0.01];
    const d1 = norm([side * Math.sin(alpha), -Math.cos(alpha), 0.06]);
    const upperLen = S.upperArm * H;
    const foreLen = S.foreArm * H;
    const handLen = S.hand * H;
    const E = add(J, mul(d1, upperLen));
    const beta = alpha - (6 * Math.PI) / 180;
    const d2 = norm([side * Math.sin(beta), -Math.cos(beta), 0.2]);
    const W = add(E, mul(d2, foreLen));
    const T = add(W, mul(d2, handLen));
    const k = armScale * (fem ? 0.86 : 1);
    // [s, lateral, frontal]
    const table: Array<[number, number, number]> = [
      [0, 0.05, 0.05],
      [0.04, 0.048, 0.049],
      [0.1, 0.044, 0.046],
      [upperLen - 0.02, 0.036, 0.036],
      [upperLen + 0.03, 0.04, 0.038],
      [upperLen + foreLen * 0.6, 0.032, 0.03],
      [upperLen + foreLen, 0.021, 0.027],
      [upperLen + foreLen + 0.02, 0.0125, 0.03],
      [upperLen + foreLen + handLen * 0.45, 0.0135, 0.043],
      [upperLen + foreLen + handLen, 0.011, 0.03],
    ];
    const ts = table.map((r) => r[0]);
    const rs = monotone(ts, table.map((r) => r[1]));
    const rf = monotone(ts, table.map((r) => r[2]));
    const handK = fem ? 0.9 : 1;
    const radius = (s: number): [number, number] => {
      const inHand = s > upperLen + foreLen;
      const kk = inHand ? handK : k;
      return [rs(s) * kk, rf(s) * kk];
    };
    return { J, E, W, T, d1, d2, upperLen, foreLen, handLen, radius };
  };

  return { m, H, y, section, chestSec, bump, neckR, arm, armScale, legScale, hipJointX: S.hipJointX * legScale ** 0.5 };
}

// ───────────────────────────── malhas ─────────────────────────────
export interface PrimitiveData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

class Part {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /**
   * Emite uma grade (linhas × colunas) como triângulos. A orientação de cada
   * triângulo é escolhida para concordar com a normal do vértice, então a malha
   * sempre fica com as faces para fora.
   */
  grid(pts: V3[][], nrm: V3[][], uv: UV[][], r0 = 0, r1 = pts.length - 1, c0 = 0, c1 = pts[0].length - 1) {
    const base = this.positions.length / 3;
    const cols = c1 - c0 + 1;
    for (let i = r0; i <= r1; i++) {
      for (let j = c0; j <= c1; j++) {
        this.positions.push(...pts[i][j]);
        this.normals.push(...nrm[i][j]);
        this.uvs.push(uv[i][j][0], uv[i][j][1]);
      }
    }
    const idx = (i: number, j: number) => base + (i - r0) * cols + (j - c0);
    for (let i = r0; i < r1; i++) {
      for (let j = c0; j < c1; j++) {
        const a = idx(i, j);
        const b = idx(i, j + 1);
        const c = idx(i + 1, j);
        const d = idx(i + 1, j + 1);
        const pa = pts[i][j];
        const face = cross(sub(pts[i][j + 1], pa), sub(pts[i + 1][j], pa));
        const vn = add(add(nrm[i][j], nrm[i][j + 1]), add(nrm[i + 1][j], nrm[i + 1][j + 1]));
        if (dot(face, vn) >= 0) this.indices.push(a, b, c, b, d, c);
        else this.indices.push(a, c, b, b, c, d);
      }
    }
  }

  build(): PrimitiveData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      indices: new Uint32Array(this.indices),
    };
  }
}

/**
 * Normais por diferenças finitas na grade. `closed` indica que a última coluna
 * repete a primeira (superfície fechada em volta). `hint` dá uma direção "para
 * fora" usada para orientar a normal e como reserva em pontos degenerados.
 */
function gridNormals(pts: V3[][], closed: boolean, hint: (i: number, j: number) => V3): V3[][] {
  const R = pts.length;
  const C = pts[0].length;
  const out: V3[][] = [];
  for (let i = 0; i < R; i++) {
    const row: V3[] = [];
    for (let j = 0; j < C; j++) {
      let jl = j - 1;
      let jr = j + 1;
      if (closed) {
        if (jl < 0) jl = C - 2;
        if (jr > C - 1) jr = 1;
      } else {
        jl = Math.max(0, jl);
        jr = Math.min(C - 1, jr);
      }
      const il = Math.max(0, i - 1);
      const ir = Math.min(R - 1, i + 1);
      const du = sub(pts[i][jr], pts[i][jl]);
      const dv = sub(pts[ir][j], pts[il][j]);
      let n = cross(du, dv);
      const h = hint(i, j);
      if (len(n) < 1e-10) n = h;
      n = norm(n);
      if (dot(n, h) < 0) n = mul(n, -1);
      row.push(n);
    }
    out.push(row);
  }
  return out;
}

const emptyUV = (R: number, C: number): UV[][] =>
  Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => [j / Math.max(1, C - 1), i / Math.max(1, R - 1)] as UV));

/** Tubo ao longo de um caminho, com tampas elipsoidais opcionais. */
function tube(opts: {
  centers: V3[];
  radii: Array<[number, number]>;
  up: V3;
  segments: number;
  capStart?: number; // fração do raio usada como comprimento da tampa (0 = sem tampa)
  capEnd?: number;
  capRings?: number;
  /** φ = 0 na direção -up (costura embaixo) */
}): { pts: V3[][]; rings: Array<{ c: V3; t: V3; r: [number, number]; s: number }> } {
  const { centers, radii, up, segments } = opts;
  const capRings = opts.capRings ?? 6;
  const n = centers.length;
  const tangents: V3[] = centers.map((_, i) => norm(sub(centers[Math.min(n - 1, i + 1)], centers[Math.max(0, i - 1)])));
  const rings: Array<{ c: V3; t: V3; r: [number, number]; s: number }> = [];
  const pushCap = (i: number, dir: 1 | -1, frac: number, start: boolean) => {
    const c0 = centers[i];
    const t = tangents[i];
    const r = radii[i];
    const capLen = Math.max(r[0], r[1]) * frac;
    const list: Array<{ c: V3; t: V3; r: [number, number]; s: number }> = [];
    for (let k = capRings; k >= 1; k--) {
      const ang = (k / capRings) * (Math.PI / 2);
      const f = Math.max(0.002, Math.cos(ang));
      list.push({ c: add(c0, mul(t, dir * capLen * Math.sin(ang))), t, r: [r[0] * f, r[1] * f], s: 0 });
    }
    if (start) rings.push(...list);
    else rings.push(...list.reverse());
  };
  if (opts.capStart) pushCap(0, -1, opts.capStart, true);
  for (let i = 0; i < n; i++) rings.push({ c: centers[i], t: tangents[i], r: radii[i], s: i });
  if (opts.capEnd) pushCap(n - 1, 1, opts.capEnd, false);

  const pts = rings.map(({ c, t, r }) => {
    const f = norm(sub(up, mul(t, dot(up, t))));
    const s = norm(cross(t, f));
    const row: V3[] = [];
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI * 2;
      // φ=0 aponta para -f ("embaixo"), assim a costura fica escondida
      row.push(add(c, add(mul(f, -r[1] * Math.cos(phi)), mul(s, r[0] * Math.sin(phi)))));
    }
    return row;
  });
  return { pts, rings };
}

function tubeHint(rings: Array<{ c: V3; t: V3 }>, pts: V3[][], interior: V3) {
  return (i: number, j: number): V3 => {
    const v = sub(pts[i][j], rings[i].c);
    return len(v) > 1e-5 ? v : sub(pts[i][j], interior);
  };
}

function samplePath(points: V3[], count: number): { centers: V3[]; dist: number[] } {
  const segLens = points.slice(1).map((p, i) => len(sub(p, points[i])));
  const total = segLens.reduce((a, b) => a + b, 0);
  const centers: V3[] = [];
  const dist: number[] = [];
  for (let k = 0; k < count; k++) {
    let d = (k / (count - 1)) * total;
    dist.push(d);
    let i = 0;
    while (i < segLens.length - 1 && d > segLens[i]) {
      d -= segLens[i];
      i++;
    }
    const t = Math.min(1, d / segLens[i]);
    centers.push(add(points[i], mul(sub(points[i + 1], points[i]), t)));
  }
  return { centers, dist };
}

// ───────────────────────────── manequim ─────────────────────────────
export interface GeneratedModel {
  primitives: Record<string, PrimitiveData>;
}

const TORSO_COLS = 48;
const TORSO_ROWS = 44;

export function generateBody(m: BodyMeasurements): GeneratedModel {
  const p = buildProfile(m);
  const H = p.H;
  const pele = new Part();
  const calca = new Part();
  const tenis = new Part();

  // Tronco: da virilha ao pescoço, com tampa inferior
  const yBottom = p.y.crotch;
  const yTop = p.y.neckTop;
  const rowsY: Array<{ y: number; k: number }> = [];
  for (const k of [0.04, 0.35, 0.7]) rowsY.push({ y: yBottom - 0.012 * (1 - k), k });
  for (let i = 0; i < TORSO_ROWS; i++) rowsY.push({ y: lerp(yBottom, yTop, i / (TORSO_ROWS - 1)), k: 1 });
  const torso: V3[][] = rowsY.map(({ y, k }) => {
    const sec = p.section(y);
    const row: V3[] = [];
    for (let j = 0; j <= TORSO_COLS; j++) {
      const th = -Math.PI / 2 + (j / TORSO_COLS) * Math.PI * 2;
      const [x, z] = superPt(sec, th);
      const front = Math.cos(th) >= 0;
      const bz = p.bump(x, y, front) * k;
      row.push([x * k, y, (z - sec.zc) * k + sec.zc + bz]);
    }
    return row;
  });
  const torsoN = gridNormals(torso, true, (i, j) => {
    const pt = torso[i][j];
    const zc = p.section(rowsY[i].y).zc;
    const h: V3 = [pt[0], 0, pt[2] - zc];
    return rowsY[i].k < 1 ? add(h, [0, -0.05, 0]) : h;
  });
  const torsoUV = emptyUV(torso.length, TORSO_COLS + 1);
  let split = rowsY.findIndex((r) => r.y >= p.y.pantsTop);
  if (split < 1) split = 1;
  calca.grid(torso, torsoN, torsoUV, 0, split);
  pele.grid(torso, torsoN, torsoUV, split, torso.length - 1);

  // (o pescoço faz parte do tronco: as seções sobem até neckTop, dentro da cabeça)

  // Cabeça (manequim estilizado, sem rosto)
  {
    const sx = m.sexo === "feminino";
    const r: V3 = mul(sx ? [0.068, 0.1, 0.085] : [0.072, 0.105, 0.09], H / BASE_BODY[m.sexo].altura);
    const c: V3 = [0, p.y.headC, 0.02];
    const LAT = 22;
    const LON = 28;
    const pts: V3[][] = [];
    for (let i = 0; i <= LAT; i++) {
      const v = -Math.PI / 2 + (i / LAT) * Math.PI;
      const yn = Math.sin(v);
      const taper = yn < 0 ? 1 - 0.14 * (-yn) ** 1.6 : 1 - 0.04 * yn;
      const row: V3[] = [];
      for (let j = 0; j <= LON; j++) {
        const u = (j / LON) * Math.PI * 2;
        const cx = Math.cos(v) * Math.sin(u) * r[0] * taper;
        const cz = Math.cos(v) * Math.cos(u) * r[2] * taper + (yn < 0 ? 0.012 * -yn * Math.max(0, Math.cos(u)) : 0);
        row.push([c[0] + cx, c[1] + yn * r[1], c[2] + cz]);
      }
      pts.push(row);
    }
    pele.grid(pts, gridNormals(pts, true, (i, j) => sub(pts[i][j], c)), emptyUV(LAT + 1, LON + 1));
  }

  // Braços (um tubo contínuo: deltoide → braço → antebraço → mão)
  for (const side of [1, -1] as const) {
    const rig = p.arm(side);
    const { centers, dist } = samplePath([rig.J, rig.E, rig.W, rig.T], 36);
    const radii = dist.map((s) => rig.radius(s));
    const { pts, rings } = tube({ centers, radii, up: [0, 0, 1], segments: 18, capStart: 0.32, capEnd: 0.9, capRings: 6 });
    pele.grid(pts, gridNormals(pts, true, tubeHint(rings, pts, rig.E)), emptyUV(pts.length, 19));
  }

  // Pernas (já com a calça) e tênis
  const fem = m.sexo === "feminino";
  for (const side of [1, -1] as const) {
    const hx = p.hipJointX * side;
    const Hj: V3 = [hx, p.y.crotch + 0.07, -0.004];
    const K: V3 = [hx + side * 0.008, p.y.knee, 0.012];
    const A: V3 = [hx + side * 0.014, p.y.ankle + 0.01, -0.008];
    const { centers, dist } = samplePath([Hj, K, A], 32);
    const total = dist[dist.length - 1];
    const kneeD = len(sub(K, Hj));
    const ls = p.legScale;
    const prof = monotone(
      [0, 0.12, kneeD, kneeD + 0.12, total],
      fem ? [0.084 * ls, 0.08 * ls, 0.056, 0.055, 0.05] : [0.086 * ls, 0.083 * ls, 0.062, 0.062, 0.057],
    );
    const radii = dist.map((d) => [prof(d), prof(d) * 1.02] as [number, number]);
    const { pts, rings } = tube({ centers, radii, up: [0, 0, 1], segments: 16, capStart: 0.5, capEnd: 0.3, capRings: 4 });
    calca.grid(pts, gridNormals(pts, true, tubeHint(rings, pts, K)), emptyUV(pts.length, 17));

    const heel: V3 = [hx + side * 0.016, 0.042, -0.055];
    const toe: V3 = [hx + side * 0.03, 0.036, fem ? 0.17 : 0.19];
    const foot = samplePath([heel, toe], 12);
    const fprof = monotone([0, 0.5, 1], [0.046, 0.048, 0.036]);
    const vprof = monotone([0, 0.5, 1], [0.044, 0.038, 0.03]);
    const fr = foot.dist.map((d) => {
      const t = d / foot.dist[foot.dist.length - 1];
      return [fprof(t) * (fem ? 0.9 : 1), vprof(t)] as [number, number];
    });
    const shoe = tube({ centers: foot.centers, radii: fr, up: [0, 1, 0], segments: 14, capStart: 0.8, capEnd: 0.9, capRings: 5 });
    for (const row of shoe.pts) for (const v of row) v[1] = Math.max(0.004, v[1]);
    tenis.grid(shoe.pts, gridNormals(shoe.pts, true, tubeHint(shoe.rings, shoe.pts, foot.centers[6])), emptyUV(shoe.pts.length, 15));
  }

  return { primitives: { pele: pele.build(), calca: calca.build(), tenis: tenis.build() } };
}

// ───────────────────────────── camiseta ─────────────────────────────
const SHIRT_COLS = 72; // em volta (metade frente, metade costas)
const SHIRT_ROWS = 44;
const SLEEVE_SEG = 24;
const SLEEVE_RINGS = 20;

export const SHIRT_Y_REF: Record<Sexo, number> = { masculino: 0.78, feminino: 0.73 };

interface ShirtShape {
  hemY: number;
  top: (theta: number) => number;
  frontDip: number;
}

function shirtShape(p: BodyProfile, folga: number): ShirtShape {
  const fem = p.m.sexo === "feminino";
  const frontDip = fem ? 0.03 : 0.024;
  const backDip = 0.012;
  const hemY = p.y.hem - Math.max(0, folga - BASE_FOLGA[p.m.sexo]) * 0.1;
  const top = (th: number) => {
    const c = Math.cos(th);
    const dip = c >= 0 ? frontDip * c ** 2.2 : backDip * (-c) ** 2;
    return p.y.neckBase + 0.006 - dip;
  };
  return { hemY, top, frontDip };
}

export interface ShirtLayout {
  /** coordenadas no atlas (m) do centro do decote na frente e nas costas */
  frontNeck: { u: number; v: number };
  backNeck: { u: number; v: number };
  hemV: number;
}

/** Posição do decote no atlas de UV — usada para posicionar as estampas. */
export function getShirtLayout(sexo: Sexo): ShirtLayout {
  const p = buildProfile(BASE_BODY[sexo]);
  const sh = shirtShape(p, BASE_FOLGA[sexo]);
  const vRef = SHIRT_Y_REF[sexo];
  return {
    frontNeck: { u: UV_LAYOUT.front.centerU, v: UV_LAYOUT.panelV0 + (sh.top(0) - vRef) },
    backNeck: { u: UV_LAYOUT.back.centerU, v: UV_LAYOUT.panelV0 + (sh.top(Math.PI) - vRef) },
    hemV: UV_LAYOUT.panelV0 + (sh.hemY - vRef),
  };
}

/** UV em metros do atlas → UV normalizado no padrão glTF (origem no canto superior esquerdo). */
const atlasUV = (u: number, v: number): UV => [u / UV_ATLAS_METERS, 1 - v / UV_ATLAS_METERS];

export function generateShirt(m: BodyMeasurements, folga: number): GeneratedModel {
  const p = buildProfile(m);
  const fem = m.sexo === "feminino";
  const part = new Part();
  const sh = shirtShape(p, folga);
  const dC = Math.max(0, folga) / (2 * Math.PI) + 0.004; // folga radial no peito
  const dMin = 0.006;
  const taper = fem ? 0.075 : 0.02;
  const chestBody = p.chestSec;
  const yChest = p.y.chest;
  const hang = (y: number) => 1 - taper * clamp01((yChest - y) / (yChest - sh.hemY));
  const vRef = SHIRT_Y_REF[m.sexo];

  const shirtSection = (y: number): Section & { d: number } => {
    const b = p.section(y);
    if (y >= yChest) {
      const t = smoothstep(p.y.armpit - 0.01, p.y.shoulder, y);
      const dArm = lerp(dC, dC * 0.6, clamp01((y - yChest) / (p.y.armpit - yChest)));
      const d = lerp(dArm, 0.008, t);
      return { a: b.a + d, bf: b.bf + d, bb: b.bb + d, n: b.n, zc: b.zc, d };
    }
    const k = hang(y);
    return {
      a: smax(b.a + dMin, (chestBody.a + dC) * k),
      bf: smax(b.bf + dMin, (chestBody.bf + dC) * k * 0.985),
      bb: smax(b.bb + dMin, (chestBody.bb + dC) * k * 0.98),
      n: lerp(b.n, chestBody.n, 0.6),
      zc: b.zc,
      d: dC,
    };
  };

  const bumpShirt = (x: number, y: number, front: boolean) => {
    if (front) {
      const peakY = fem ? yChest : yChest + 0.012 * p.H;
      if (y >= peakY) return p.bump(x, y, true);
      // abaixo do busto/peitoral o tecido "tenda": mantém parte do relevo
      const t = clamp01((peakY - y) / (peakY - sh.hemY));
      return p.bump(x, peakY, true) * (1 - 0.6 * t) * (fem ? 1 : 0.6);
    }
    // nas costas o tecido cai reto a partir das escápulas, mas encosta nos glúteos
    const fromBlades = p.bump(x, Math.max(y, 0.765 * p.H), false);
    return Math.min(fromBlades, p.bump(x, y, false));
  };

  const folds = (th: number, y: number, v: number) => {
    const below = smoothstep(yChest, sh.hemY, y);
    const drape = 0.0075 * below * (0.5 + 0.5 * Math.sin(7 * th + 1.3 + 5 * y)) + 0.004 * below * (0.5 + 0.5 * Math.sin(13 * th + 0.4 - 7 * y));
    const side = Math.abs(Math.sin(th)) ** 3;
    const arm = 0.003 * gauss(y - (p.y.armpit - 0.05), 0.04) * side * (0.5 + 0.5 * Math.sin(22 * th + 40 * y));
    const hemWave = 0.003 * smoothstep(0.12, 0, v) * (0.5 + 0.5 * Math.sin(5 * th + 2));
    return drape + arm + hemWave;
  };

  // ── Tronco da camiseta
  const thetas = Array.from({ length: SHIRT_COLS + 1 }, (_, j) => -Math.PI / 2 + (j / SHIRT_COLS) * Math.PI * 2);
  const vs = Array.from({ length: SHIRT_ROWS }, (_, i) => i / (SHIRT_ROWS - 1));
  const rowY = (th: number, v: number) => {
    const L = sh.top(th) - sh.hemY;
    return sh.hemY + L * (1 - (1 - v) ** 1.25);
  };
  const torso: V3[][] = vs.map((v) =>
    thetas.map((th) => {
      const y = rowY(th, v);
      const sec = shirtSection(y);
      const [x, z] = superPt(sec, th);
      const front = Math.cos(th) >= 0;
      const zb = z + bumpShirt(x, y, front);
      const rad = norm([x, 0, zb - sec.zc]);
      const f = folds(th, y, v);
      return [x + rad[0] * f, y, zb + rad[2] * f] as V3;
    }),
  );
  const torsoHint = (i: number, j: number): V3 => {
    const pt = torso[i][j];
    return [pt[0], 0, pt[2] - p.section(pt[1]).zc];
  };
  const torsoN = gridNormals(torso, true, torsoHint);

  // UV por comprimento de arco (como o tecido plano que envolve o corpo)
  const half = SHIRT_COLS / 2;
  const jFront = SHIRT_COLS / 4; // θ = 0
  const jBack = (3 * SHIRT_COLS) / 4; // θ = π
  const torsoUV: UV[][] = torso.map((row) => {
    const arc = [0];
    for (let j = 1; j < row.length; j++) arc.push(arc[j - 1] + len(sub(row[j], row[j - 1])));
    return row.map((pt, j) => {
      const v = UV_LAYOUT.panelV0 + (pt[1] - vRef);
      const u = j <= half ? UV_LAYOUT.front.centerU + (arc[j] - arc[jFront]) : UV_LAYOUT.back.centerU + (arc[j] - arc[jBack]);
      return atlasUV(u, v);
    });
  });
  // Painel da frente e das costas (vértices duplicados na costura lateral)
  part.grid(torso, torsoN, torsoUV, 0, SHIRT_ROWS - 1, 0, half);
  // A coluna da costura (j = half, θ = π/2) foi mapeada como frente; no painel
  // das costas ela precisa do u medido a partir do centro das costas.
  const backUV = torsoUV.map((row) => row.slice());
  for (let i = 0; i < torso.length; i++) {
    const row = torso[i];
    let arc = 0;
    for (let j = half; j < jBack; j++) arc += len(sub(row[j + 1], row[j]));
    backUV[i][half] = atlasUV(UV_LAYOUT.back.centerU - arc, UV_LAYOUT.panelV0 + (row[half][1] - vRef));
  }
  part.grid(torso, torsoN, backUV, 0, SHIRT_ROWS - 1, half, SHIRT_COLS);

  // ── Ribana da gola (sobe 1,8 cm acompanhando o pescoço e dobra para dentro)
  {
    const H_RIB = 0.016;
    const steps = [0, 0.25, 0.5, 0.75, 1];
    const topRow = torso[SHIRT_ROWS - 1];
    const ribRows: V3[][] = steps.map((t) =>
      thetas.map((th, j) => {
        if (t === 0) return topRow[j];
        const y = sh.top(th) + H_RIB * t;
        const b = p.section(y);
        const d = 0.005;
        const [x, z] = superPt({ ...b, a: b.a + d, bf: b.bf + d, bb: b.bb + d }, th);
        const base0 = topRow[j];
        // na frente a ribana sobe rente à borda do decote (sem abrir vão)
        const w = smoothstep(0, 0.5, t) * (1 - 0.75 * Math.max(0, Math.cos(th)) ** 2);
        return [lerp(base0[0], x, w), y, lerp(base0[2], z, w)] as V3;
      }),
    );
    // dobra interna (dá espessura à borda)
    ribRows.push(
      ribRows[ribRows.length - 1].map((pt) => {
        const zc = p.section(pt[1]).zc;
        const r = norm([pt[0], 0, pt[2] - zc]);
        return [pt[0] - r[0] * 0.004, pt[1] - 0.003, pt[2] - r[2] * 0.004] as V3;
      }),
    );
    const ribN = gridNormals(ribRows, true, (i, j) => {
      const pt = ribRows[i][j];
      const h: V3 = [pt[0], 0, pt[2] - p.section(pt[1]).zc];
      return i === ribRows.length - 1 ? mul(h, -1) : h;
    });
    const arc = [0];
    for (let j = 1; j < thetas.length; j++) arc.push(arc[j - 1] + len(sub(ribRows[0][j], ribRows[0][j - 1])));
    const ribUV: UV[][] = ribRows.map((_, i) =>
      thetas.map((__, j) => atlasUV(UV_LAYOUT.rib.u0 + arc[j], UV_LAYOUT.rib.v0 + (i / (ribRows.length - 1)) * UV_LAYOUT.rib.height)),
    );
    part.grid(ribRows, ribN, ribUV);
  }

  // ── Barra (bainha dobrada para dentro)
  {
    const bottom = torso[0];
    const hemRows: V3[][] = [0, 1, 2].map((k) =>
      bottom.map((pt) => {
        const zc = p.section(pt[1]).zc;
        const r = norm([pt[0], 0, pt[2] - zc]);
        const inward = k === 0 ? 0 : 0.0035;
        const up = k === 2 ? 0.022 : k === 1 ? -0.001 : 0;
        return [pt[0] - r[0] * inward, pt[1] + up, pt[2] - r[2] * inward] as V3;
      }),
    );
    const hemN = gridNormals(hemRows, true, (i, j) => {
      const pt = hemRows[i][j];
      return [pt[0], -0.2, pt[2]];
    });
    const hemUV = hemRows.map(() => torsoUV[0]);
    part.grid(hemRows, hemN, hemUV);
  }

  // ── Mangas
  for (const side of [1, -1] as const) {
    const rig = p.arm(side);
    const sleeveLen = rig.upperLen * (fem ? 0.38 : 0.45) + Math.max(0, folga - BASE_FOLGA[m.sexo]) * 0.08;
    const { centers, dist } = samplePath([rig.J, add(rig.J, mul(rig.d1, sleeveLen))], SLEEVE_RINGS);
    const looser = Math.max(0, folga) * 0.06;
    const radii = dist.map((s) => {
      const [rs, rf] = rig.radius(s);
      const e = 0.008 + (0.018 + looser) * (s / sleeveLen) ** 1.1;
      const r = Math.max(rs, rf) + e;
      return [r, r * 1.03] as [number, number];
    });
    const { pts, rings } = tube({ centers, radii, up: [0, 1, 0], segments: SLEEVE_SEG, capStart: 0.5, capRings: 7 });
    // rugas perto da abertura
    const nr = pts.length;
    for (let i = 0; i < nr; i++) {
      const ring = rings[i];
      const tAlong = clamp01(dot(sub(ring.c, rig.J), rig.d1) / sleeveLen);
      for (let j = 0; j <= SLEEVE_SEG; j++) {
        const phi = (j / SLEEVE_SEG) * Math.PI * 2;
        const out = norm(sub(pts[i][j], ring.c));
        const w = 0.0022 * tAlong ** 1.5 * (0.5 + 0.5 * Math.sin(9 * phi + 40 * tAlong));
        pts[i][j] = add(pts[i][j], mul(out, w));
      }
    }
    // bainha da manga dobrada para dentro
    const last = pts[nr - 1];
    const lastRing = rings[nr - 1];
    const fold1 = last.map((pt) => add(pt, mul(norm(sub(lastRing.c, pt)), 0.0035)));
    const fold2 = fold1.map((pt) => add(pt, mul(rig.d1, -0.02)));
    const allPts = [...pts, fold1, fold2];
    const allRings = [...rings, lastRing, { ...lastRing, c: add(lastRing.c, mul(rig.d1, -0.02)) }];
    const n = gridNormals(allPts, true, (i, j) => {
      const v = sub(allPts[i][j], allRings[i].c);
      const h = len(v) > 1e-5 ? v : mul(rig.d1, -1);
      return i >= nr ? mul(h, -1) : h;
    });
    const cfg = side === 1 ? UV_LAYOUT.sleeveLeft : UV_LAYOUT.sleeveRight;
    const capLen = radii[0][0] * 0.5;
    const uvs: UV[][] = allPts.map((row, i) => {
      const ring = allRings[i];
      const along = dot(sub(ring.c, rig.J), rig.d1) + capLen;
      const rMean = (radii[0][0] + radii[radii.length - 1][0]) / 2;
      return row.map((_, j) => {
        const phi = (j / SLEEVE_SEG) * Math.PI * 2;
        return atlasUV(cfg.centerU + rMean * (phi - Math.PI) * side, cfg.v0 + Math.max(0, along));
      });
    });
    part.grid(allPts, n, uvs);
  }

  return { primitives: { camiseta: part.build() } };
}

export function countVertices(model: GeneratedModel): number {
  return Object.values(model.primitives).reduce((s, p) => s + p.positions.length / 3, 0);
}
