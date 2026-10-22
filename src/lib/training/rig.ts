/**
 * Szkielet 2D do animowanych demonstracji ćwiczeń.
 *
 * Konwencje (współrzędne SVG, oś Y w dół, podłoże domyślnie y = 186):
 *  - Kąt tułowia T: 0 = pionowo (bark nad biodrem), 90 = pochylenie w przód
 *    (bark na prawo od biodra, sylwetka zwrócona w prawo), -90 = leżenie
 *    na plecach z głową po lewej.
 *  - Kąty kończyn są bezwzględne: 0 = w dół, 90 = w prawo (+x), 180 = w górę,
 *    -90 = w lewo.
 *  - Kończyna może być zadana kątami (FK) albo punktem docelowym (IK
 *    dwuczłonowe — np. stopy przyklejone do podłoża, dłonie na drążku).
 *  - Widok "front" rozsuwa biodra i barki na boki; "side" to profil.
 */

export type Vec = [number, number];

export const SEG = {
  torso: 50,
  neck: 10,
  head: 9,
  upperArm: 28,
  forearm: 26,
  thigh: 42,
  shin: 40,
  foot: 13,
  hipHalf: 9,
  shoulderHalf: 15,
};

export const GROUND_Y = 186;

export type JointRef = "shoulderN" | "shoulderF" | "shoulder" | "hip" | "hipN" | "hipF" | "neck";
export type Target = Vec | { rel: JointRef; d: Vec };
export type Bend = "right" | "left" | "up" | "down";

export type Limb =
  | { a: Vec; foot?: number; s?: Vec } // FK: [kąt segmentu bliższego, dalszego], s = skala długości (skrót perspektywiczny)
  | { ik: Target; bend: Bend; foot?: number };

export interface Pose {
  hip: Vec;
  torso: number;
  /** Bezwzględny kąt szyi/głowy (domyślnie = tułów) */
  head?: number;
  /** Wygięcie kręgosłupa (px): + w stronę grzbietu, - w stronę brzucha */
  curve?: number;
  /** Skala długości tułowia (skrót perspektywiczny) */
  torsoScale?: number;
  legN: Limb;
  legF: Limb;
  armN: Limb;
  armF: Limb;
}

export interface Keyframe {
  t: number; // 0..1
  pose: Pose;
  /** Dodatkowe parametry sprzętu interpolowane razem z pozą (np. pozycja sanek) */
  extra?: Record<string, number>;
}

export interface Joints {
  hip: Vec;
  hipN: Vec;
  hipF: Vec;
  shoulder: Vec;
  shoulderN: Vec;
  shoulderF: Vec;
  neck: Vec;
  head: Vec;
  kneeN: Vec;
  kneeF: Vec;
  ankleN: Vec;
  ankleF: Vec;
  toeN: Vec;
  toeF: Vec;
  elbowN: Vec;
  elbowF: Vec;
  wristN: Vec;
  wristF: Vec;
  curve: number;
  extra: Record<string, number>;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const dirOf = (deg: number): Vec => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Dwuczłonowe IK: zwraca pozycję stawu środkowego i końcowego. */
export function solveIK(root: Vec, target: Vec, l1: number, l2: number, bend: Bend): [Vec, Vec] {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  const minD = Math.abs(l1 - l2) + 0.01;
  const maxD = l1 + l2 - 0.01;
  const base = Math.atan2(dy, dx);
  if (d < 1e-6) d = minD;
  const dc = Math.min(maxD, Math.max(minD, d));
  const cosA = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const off = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const c1: Vec = [root[0] + l1 * Math.cos(base + off), root[1] + l1 * Math.sin(base + off)];
  const c2: Vec = [root[0] + l1 * Math.cos(base - off), root[1] + l1 * Math.sin(base - off)];
  let mid: Vec;
  switch (bend) {
    case "right":
      mid = c1[0] >= c2[0] ? c1 : c2;
      break;
    case "left":
      mid = c1[0] <= c2[0] ? c1 : c2;
      break;
    case "up":
      mid = c1[1] <= c2[1] ? c1 : c2;
      break;
    default:
      mid = c1[1] >= c2[1] ? c1 : c2;
  }
  // Koniec kończyny leży w kierunku celu w odległości l2 od stawu środkowego
  // (gdy cel jest osiągalny, trafia dokładnie w cel).
  const tv: Vec = [target[0] - mid[0], target[1] - mid[1]];
  const tl = Math.hypot(tv[0], tv[1]) || 1;
  return [mid, add(mid, mul(tv, l2 / tl))];
}

function resolveTarget(t: Target, refs: Record<JointRef, Vec>): Vec {
  if (Array.isArray(t)) return t;
  return add(refs[t.rel], t.d);
}

function solveLimb(root: Vec, limb: Limb, l1: number, l2: number, refs: Record<JointRef, Vec>): [Vec, Vec] {
  if ("a" in limb) {
    const s = limb.s ?? [1, 1];
    const mid = add(root, mul(dirOf(limb.a[0]), l1 * s[0]));
    const end = add(mid, mul(dirOf(limb.a[1]), l2 * s[1]));
    return [mid, end];
  }
  return solveIK(root, resolveTarget(limb.ik, refs), l1, l2, limb.bend);
}

export function computeJoints(pose: Pose, view: "side" | "front", extra: Record<string, number> = {}): Joints {
  const ts = pose.torsoScale ?? 1;
  const tDir: Vec = [Math.sin(rad(pose.torso)), -Math.cos(rad(pose.torso))];
  const hip = pose.hip;
  const shoulder = add(hip, mul(tDir, SEG.torso * ts));
  const headDeg = pose.head ?? pose.torso;
  const hDir: Vec = [Math.sin(rad(headDeg)), -Math.cos(rad(headDeg))];
  const neck = add(shoulder, mul(hDir, SEG.neck));
  const head = add(neck, mul(hDir, SEG.head));

  // Kierunek poprzeczny (prostopadły do tułowia) — rozstaw bioder/barków w widoku z przodu.
  const perp: Vec = [Math.cos(rad(pose.torso)), Math.sin(rad(pose.torso))];
  const hipN = view === "front" ? add(hip, mul(perp, SEG.hipHalf)) : hip;
  const hipF = view === "front" ? add(hip, mul(perp, -SEG.hipHalf)) : hip;
  const shoulderN = view === "front" ? add(shoulder, mul(perp, SEG.shoulderHalf)) : shoulder;
  const shoulderF = view === "front" ? add(shoulder, mul(perp, -SEG.shoulderHalf)) : shoulder;

  const refs: Record<JointRef, Vec> = { shoulder, shoulderN, shoulderF, hip, hipN, hipF, neck };

  const [kneeN, ankleN] = solveLimb(hipN, pose.legN, SEG.thigh, SEG.shin, refs);
  const [kneeF, ankleF] = solveLimb(hipF, pose.legF, SEG.thigh, SEG.shin, refs);
  const [elbowN, wristN] = solveLimb(shoulderN, pose.armN, SEG.upperArm, SEG.forearm, refs);
  const [elbowF, wristF] = solveLimb(shoulderF, pose.armF, SEG.upperArm, SEG.forearm, refs);

  const defFoot = view === "front" ? undefined : 90;
  const footN = pose.legN.foot ?? defFoot;
  const footF = pose.legF.foot ?? defFoot;
  const toeN: Vec = footN === undefined ? add(ankleN, [4, 2]) : add(ankleN, mul(dirOf(footN), SEG.foot));
  const toeF: Vec = footF === undefined ? add(ankleF, [-4, 2]) : add(ankleF, mul(dirOf(footF), SEG.foot));

  return {
    hip,
    hipN,
    hipF,
    shoulder,
    shoulderN,
    shoulderF,
    neck,
    head,
    kneeN,
    kneeF,
    ankleN,
    ankleF,
    toeN,
    toeF,
    elbowN,
    elbowF,
    wristN,
    wristF,
    curve: pose.curve ?? 0,
    extra,
  };
}

/* ------------------------------------------------------------------ */
/* Interpolacja                                                        */
/* ------------------------------------------------------------------ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function lerpTarget(a: Target, b: Target, t: number): Target {
  if (Array.isArray(a) && Array.isArray(b)) return lerpV(a, b, t);
  if (!Array.isArray(a) && !Array.isArray(b) && a.rel === b.rel) return { rel: a.rel, d: lerpV(a.d, b.d, t) };
  return t < 0.5 ? a : b;
}

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  const foot = a.foot !== undefined && b.foot !== undefined ? lerp(a.foot, b.foot, t) : (a.foot ?? b.foot);
  if ("a" in a && "a" in b) {
    const sa = a.s ?? [1, 1];
    const sb = b.s ?? [1, 1];
    return { a: lerpV(a.a, b.a, t), foot, s: lerpV(sa, sb, t) };
  }
  if ("ik" in a && "ik" in b) return { ik: lerpTarget(a.ik, b.ik, t), bend: a.bend, foot };
  return t < 0.5 ? a : b;
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: a.head !== undefined || b.head !== undefined ? lerp(a.head ?? a.torso, b.head ?? b.torso, t) : undefined,
    curve: lerp(a.curve ?? 0, b.curve ?? 0, t),
    torsoScale: lerp(a.torsoScale ?? 1, b.torsoScale ?? 1, t),
    legN: lerpLimb(a.legN, b.legN, t),
    legF: lerpLimb(a.legF, b.legF, t),
    armN: lerpLimb(a.armN, b.armN, t),
    armF: lerpLimb(a.armF, b.armF, t),
  };
}

/** Poza w chwili phase ∈ [0,1) z wygładzeniem między klatkami kluczowymi. */
export function sample(keyframes: Keyframe[], phase: number, smooth = true): { pose: Pose; extra: Record<string, number> } {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].t <= p) i++;
  const a = keyframes[i];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
  const span = b.t - a.t;
  const raw = span > 0 ? (p - a.t) / span : 0;
  const t = smooth ? ease(raw) : raw;
  const extra: Record<string, number> = {};
  const keys = new Set([...Object.keys(a.extra ?? {}), ...Object.keys(b.extra ?? {})]);
  for (const k of keys) extra[k] = lerp(a.extra?.[k] ?? 0, b.extra?.[k] ?? 0, t);
  return { pose: lerpPose(a.pose, b.pose, t), extra };
}

export const _internal = { dist, dirOf };
