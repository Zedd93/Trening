/**
 * Animowane demonstracje ćwiczeń — klatki kluczowe dla szkieletu z rig.ts.
 * Każde ćwiczenie ma własną, dedykowaną sekwencję ruchu (bez wspólnej
 * "ogólnej" animacji). Współrzędne opisane w rig.ts.
 */
import type { Keyframe, Limb, Pose, Target, Vec, Bend } from "./rig";

export type PropSpec =
  | { kind: "barbell"; r?: number }
  | { kind: "trapbar" }
  | { kind: "dumbbells"; hands: "both" | "near"; heavy?: boolean }
  | { kind: "dumbbellVertical" }
  | { kind: "kettlebell"; hands: "both" | "near" | "goblet" | "swing" }
  | { kind: "bench"; x: number; y: number; w: number }
  | { kind: "inclineBench"; pivot: Vec; angle: number; len: number; seat: [number, number] }
  | { kind: "pullupBar"; y: number; x1: number; x2: number; posts?: boolean }
  | { kind: "dipBars"; y: number; x1: number; x2: number }
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "cable"; from: Vec; handle?: "bar" | "rope" | "single"; tower?: number }
  | { kind: "band"; from: Vec | "wristF" }
  | { kind: "medball" }
  | { kind: "abwheel" }
  | { kind: "sled" }
  | { kind: "wall"; x: number }
  | { kind: "mat"; x1: number; x2: number }
  | { kind: "scroll" }
  | { kind: "airbike"; crank: Vec; r: number }
  | { kind: "uprightBike"; crank: Vec; r: number; bars: Vec }
  | { kind: "rower"; foot: Vec; fly: Vec; rail: [number, number, number] }
  | { kind: "rackBar"; x: number; y: number };

export interface ExerciseAnimation {
  view: "side" | "front";
  duration: number;
  viewBox?: [number, number, number, number];
  ground?: boolean;
  smooth?: boolean;
  props: PropSpec[];
  keyframes: Keyframe[];
}

/* ------------------------------ helpery ------------------------------ */

const A = (u: number, l: number, foot?: number, s?: Vec): Limb => ({ a: [u, l], foot, s });
const IK = (x: number, y: number, bend: Bend, foot?: number): Limb => ({ ik: [x, y], bend, foot });
const IKr = (rel: "shoulder" | "hip" | "shoulderN" | "shoulderF", dx: number, dy: number, bend: Bend): Limb => ({
  ik: { rel, d: [dx, dy] } as Target,
  bend,
});
const P = (hip: Vec, torso: number, legN: Limb, legF: Limb, armN: Limb, armF: Limb, extra: Partial<Pose> = {}): Pose => ({
  hip,
  torso,
  legN,
  legF,
  armN,
  armF,
  ...extra,
});
const kf = (t: number, pose: Pose, extra?: Record<string, number>): Keyframe => ({ t, pose, extra });
const both = (l: Limb): [Limb, Limb] => [l, l];

/** Stopy na podłożu (widok z boku) */
const feet = (x = 98): [Limb, Limb] => [IK(x, 182, "right"), IK(x, 182, "right")];

/** Pętla: pierwsza klatka powtórzona na końcu */
const loop = (frames: [number, Pose, Record<string, number>?][]): Keyframe[] => frames.map(([t, p, e]) => kf(t, p, e));

/* ----------------------------- kucanie ------------------------------- */

const backSquat = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const top = P([99, 100], 8, lN, lF, IKr("shoulder", -6, 1, "down"), IKr("shoulder", -6, 1, "down"));
  const bottom = P([76, 146], 36, lN, lF, IKr("shoulder", -5, -2, "down"), IKr("shoulder", -5, -2, "down"));
  return {
    view: "side",
    duration: 3400,
    props: [{ kind: "barbell", r: 17 }],
    keyframes: loop([
      [0, top],
      [0.5, bottom],
      [0.58, bottom],
      [1, top],
    ]),
  };
};

const frontSquat = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const arm = IKr("shoulder", 5, -6, "right");
  const top = P([99, 100], 4, lN, lF, arm, arm);
  const bottom = P([82, 148], 18, lN, lF, arm, arm);
  return {
    view: "side",
    duration: 3400,
    props: [{ kind: "barbell", r: 17 }],
    keyframes: loop([
      [0, top],
      [0.5, bottom],
      [0.58, bottom],
      [1, top],
    ]),
  };
};

const gobletSquat = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const arm = IKr("shoulder", 11, 14, "down");
  const top = P([99, 100], 5, lN, lF, arm, arm);
  const bottom = P([82, 147], 22, lN, lF, arm, arm);
  return {
    view: "side",
    duration: 3400,
    props: [{ kind: "kettlebell", hands: "goblet" }],
    keyframes: loop([
      [0, top],
      [0.5, bottom],
      [0.58, bottom],
      [1, top],
    ]),
  };
};

const bodyweightSquat = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const top = P([99, 100], 3, lN, lF, A(8, 8), A(8, 8));
  const bottom = P([80, 146], 30, lN, lF, A(84, 86), A(84, 86));
  return {
    view: "side",
    duration: 2600,
    props: [],
    keyframes: loop([
      [0, top],
      [0.5, bottom],
      [1, top],
    ]),
  };
};

/* ---------------------------- zawias biodrowy ------------------------ */

const rdl = (kind: "barbell" | "dumbbells"): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const top = P([99, 100], -2, lN, lF, ...both(A(4, 4)));
  const bottom = P([72, 108], 65, lN, lF, ...both(kind === "barbell" ? A(-13, -13) : A(-10, -10)));
  return {
    view: "side",
    duration: 3600,
    props: [kind === "barbell" ? { kind: "barbell", r: 18 } : { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, top],
      [0.5, bottom],
      [0.56, bottom],
      [1, top],
    ]),
  };
};

const trapBarDeadlift = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([78, 140], 55, lN, lF, ...both(A(-14, -14)));
  const top = P([99, 100], 0, lN, lF, ...both(A(1, 1)));
  return {
    view: "side",
    duration: 3400,
    props: [{ kind: "trapbar" }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.55, top],
      [1, bottom],
    ]),
  };
};

const kettlebellSwing = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([74, 108], 68, lN, lF, ...both(A(-34, -34)));
  const mid = P([90, 103], 30, lN, lF, ...both(A(32, 32)));
  const top = P([99, 100], -3, lN, lF, ...both(A(88, 88)));
  return {
    view: "side",
    duration: 1800,
    props: [{ kind: "kettlebell", hands: "swing" }],
    keyframes: loop([
      [0, bottom],
      [0.32, mid],
      [0.5, top],
      [0.68, mid],
      [1, bottom],
    ]),
  };
};

const hipThrust = (): ExerciseAnimation => {
  const legs = IK(140, 182, "up", 90);
  const arm = IKr("hip", 0, -10, "up");
  const bottom = P([104, 174], -48.2, legs, legs, arm, arm, { head: -23 });
  const top = P([116, 137], -93.4, legs, legs, arm, arm, { head: -68 });
  return {
    view: "side",
    duration: 3000,
    props: [{ kind: "bench", x: 16, y: 146, w: 54 }, { kind: "barbell", r: 18 }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.56, top],
      [1, bottom],
    ]),
  };
};

const gluteBridge = (): ExerciseAnimation => {
  const legs = IK(140, 182, "up", 90);
  const arms = A(92, 92);
  const bottom = P([110, 178], -90, legs, legs, arms, arms, { head: -90 });
  const top = P([103.3, 153], -120, legs, legs, arms, arms, { head: -90 });
  return {
    view: "side",
    duration: 2800,
    props: [{ kind: "mat", x1: 30, x2: 170 }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.56, top],
      [1, bottom],
    ]),
  };
};

/* ------------------------------ wyciskanie --------------------------- */

const benchLike = (kind: "barbell" | "dumbbells"): ExerciseAnimation => {
  const legs = IK(150, 182, "up", 90);
  const top = P([116, 139], -90, legs, legs, ...both(IK(68, 87, "down")), { head: -90 });
  const bottom = P([116, 139], -90, legs, legs, ...both(IK(kind === "barbell" ? 72 : 70, kind === "barbell" ? 124 : 128, "down")), {
    head: -90,
  });
  return {
    view: "side",
    duration: 3200,
    props: [{ kind: "bench", x: 36, y: 146, w: 92 }, kind === "barbell" ? { kind: "barbell", r: 20 } : { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, top],
      [0.45, bottom],
      [0.52, bottom],
      [1, top],
    ]),
  };
};

const inclineDbPress = (): ExerciseAnimation => {
  const legs = IK(150, 182, "up", 90);
  const top = P([112, 140], -60, legs, legs, ...both(IK(70, 63, "down")));
  const bottom = P([112, 140], -60, legs, legs, ...both(IK(78, 104, "down")));
  return {
    view: "side",
    duration: 3200,
    props: [{ kind: "inclineBench", pivot: [114, 148], angle: -60, len: 74, seat: [100, 140] }, { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, top],
      [0.45, bottom],
      [0.52, bottom],
      [1, top],
    ]),
  };
};

const pushUp = (): ExerciseAnimation => {
  const legs = IK(20, 176, "down", 15);
  const arm = IK(138, 181, "up");
  const top = P([96.4, 146.2], 68.7, legs, legs, arm, arm);
  const bottom = P([101.4, 166.1], 83, legs, legs, arm, arm);
  return {
    view: "side",
    duration: 2600,
    props: [],
    keyframes: loop([
      [0, top],
      [0.45, bottom],
      [0.52, bottom],
      [1, top],
    ]),
  };
};

const overheadPress = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([99, 100], -4, lN, lF, ...both(IKr("shoulder", 7, -3, "down")));
  const top = P([99, 100], 0, lN, lF, ...both(IKr("shoulder", 1, -52, "down")));
  return {
    view: "side",
    duration: 3000,
    viewBox: [0, -24, 200, 224],
    props: [{ kind: "barbell", r: 17 }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.5, top],
      [1, bottom],
    ]),
  };
};

const dbShoulderPress = (): ExerciseAnimation => {
  const legs = IK(128, 182, "up", 90);
  const bottom = P([100, 140], 0, legs, legs, ...both(IKr("shoulder", 5, -8, "down")));
  const top = P([100, 140], 0, legs, legs, ...both(IKr("shoulder", 1, -52, "down")));
  return {
    view: "side",
    duration: 3000,
    props: [{ kind: "box", x: 80, y: 146, w: 40, h: 40 }, { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.5, top],
      [1, bottom],
    ]),
  };
};

const dips = (): ExerciseAnimation => {
  const legs = A(15, -70);
  const arm = IK(110, 87, "left");
  const top = P([102.8, 82.7], 6, legs, legs, arm, arm);
  const bottom = P([80.9, 112], 20, legs, legs, arm, arm);
  return {
    view: "side",
    duration: 2800,
    ground: true,
    viewBox: [0, -10, 200, 210],
    props: [{ kind: "dipBars", y: 89, x1: 70, x2: 150 }],
    keyframes: loop([
      [0, top],
      [0.45, bottom],
      [0.52, bottom],
      [1, top],
    ]),
  };
};

/* ------------------------------- przyciąganie ------------------------ */

const barbellRow = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([78, 108], 72, lN, lF, ...both(IK(121, 143, "left")));
  const top = P([78, 108], 72, lN, lF, ...both(IK(104, 110, "left")));
  return {
    view: "side",
    duration: 2800,
    props: [{ kind: "barbell", r: 20 }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.5, top],
      [1, bottom],
    ]),
  };
};

const oneArmRow = (): ExerciseAnimation => {
  const support = IK(160, 146, "right");
  const bottom = P([85, 112], 80, IK(70, 182, "right"), IK(112, 182, "right"), IK(130, 155, "left"), support);
  const top = P([85, 112], 80, IK(70, 182, "right"), IK(112, 182, "right"), IK(112, 118, "left"), support);
  return {
    view: "side",
    duration: 2800,
    props: [{ kind: "bench", x: 132, y: 146, w: 62 }, { kind: "dumbbells", hands: "near" }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.5, top],
      [1, bottom],
    ]),
  };
};

const pullUp = (chin = false): ExerciseAnimation => {
  const legs = A(15, -60);
  const arm = IK(104, 26, "down");
  const bottom = P([103.6, 127.9], -3, legs, legs, arm, arm);
  const top = chin ? P([95.5, 87.5], -5, legs, legs, arm, arm) : P([92.7, 87.2], -10, legs, legs, arm, arm);
  return {
    view: "side",
    duration: 3000,
    ground: false,
    props: [{ kind: "pullupBar", y: 24, x1: 60, x2: 150, posts: true }],
    keyframes: loop([
      [0, bottom],
      [0.45, top],
      [0.55, top],
      [1, bottom],
    ]),
  };
};

const deadHang = (): ExerciseAnimation => {
  const legs = A(4, -6);
  const arm = IK(104, 12, "down");
  const relaxed = P([102.7, 116], -2, legs, legs, arm, arm);
  const active = P([102.7, 112], -2, legs, legs, arm, arm);
  return {
    view: "side",
    duration: 3000,
    ground: false,
    props: [{ kind: "pullupBar", y: 10, x1: 60, x2: 150, posts: true }],
    keyframes: loop([
      [0, relaxed],
      [0.5, active],
      [1, relaxed],
    ]),
  };
};

const latPulldown = (): ExerciseAnimation => {
  const legs = IK(128, 182, "up", 90);
  const top = P([100, 140], -8, legs, legs, ...both(IK(100, 38, "down")));
  const bottom = P([100, 140], -15, legs, legs, ...both(IK(100, 84, "down")));
  return {
    view: "side",
    duration: 3000,
    props: [{ kind: "box", x: 80, y: 146, w: 40, h: 40 }, { kind: "cable", from: [100, 2], handle: "bar", tower: 150 }],
    keyframes: loop([
      [0, top],
      [0.42, bottom],
      [0.52, bottom],
      [1, top],
    ]),
  };
};

const invertedRow = (): ExerciseAnimation => {
  const legs = IK(182, 178, "down", 180);
  const arm = IK(50, 110, "down");
  const bottom = P([100.6, 168], -83, legs, legs, arm, arm);
  const top = P([106.6, 145.7], -66.8, legs, legs, arm, arm);
  return {
    view: "side",
    duration: 2800,
    props: [{ kind: "rackBar", x: 50, y: 108 }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.52, top],
      [1, bottom],
    ]),
  };
};

const bandRow = (): ExerciseAnimation => {
  const lN = IK(104, 182, "right");
  const lF = IK(84, 182, "right");
  const start = P([92, 100], 4, lN, lF, ...both(IK(146, 72, "left")));
  const end = P([92, 100], 0, lN, lF, ...both(IK(104, 90, "left")));
  return {
    view: "side",
    duration: 2600,
    props: [{ kind: "band", from: [192, 96] }, { kind: "wall", x: 194 }],
    keyframes: loop([
      [0, start],
      [0.42, end],
      [0.52, end],
      [1, start],
    ]),
  };
};

const seatedCableRow = (): ExerciseAnimation => {
  const legs = IK(128, 168, "up", 160);
  const start = P([60, 160], 18, legs, legs, ...both(IK(128, 124, "left")));
  const end = P([60, 160], -6, legs, legs, ...both(IK(80, 132, "left")));
  return {
    view: "side",
    duration: 2800,
    props: [{ kind: "box", x: 40, y: 166, w: 40, h: 20 }, { kind: "cable", from: [196, 128], handle: "single", tower: 196 }],
    keyframes: loop([
      [0, start],
      [0.42, end],
      [0.52, end],
      [1, start],
    ]),
  };
};

const facePull = (): ExerciseAnimation => {
  const lN = IK(104, 182, "right");
  const lF = IK(84, 182, "right");
  const start = P([92, 100], -4, lN, lF, ...both(IK(140, 50, "up")));
  const end = P([92, 100], -4, lN, lF, ...both(IK(100, 38, "up")));
  return {
    view: "side",
    duration: 2600,
    props: [{ kind: "cable", from: [192, 46], handle: "rope", tower: 192 }],
    keyframes: loop([
      [0, start],
      [0.42, end],
      [0.52, end],
      [1, start],
    ]),
  };
};

/* ------------------------------ ramiona/barki ------------------------- */

const dbCurl = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([99, 100], 0, lN, lF, A(2, 4), A(4, 6));
  const top = P([99, 100], 0, lN, lF, A(-6, 150), A(-4, 152));
  return {
    view: "side",
    duration: 2600,
    props: [{ kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, bottom],
      [0.4, top],
      [0.48, top],
      [1, bottom],
    ]),
  };
};

const tricepsPushdown = (): ExerciseAnimation => {
  const [lN, lF] = feet(96);
  const top = P([96, 100], 8, lN, lF, A(8, 130), A(8, 130));
  const bottom = P([96, 100], 8, lN, lF, A(6, 8), A(6, 8));
  return {
    view: "side",
    duration: 2400,
    props: [{ kind: "cable", from: [150, 2], handle: "rope", tower: 156 }],
    keyframes: loop([
      [0, top],
      [0.42, bottom],
      [0.5, bottom],
      [1, top],
    ]),
  };
};

const overheadTriceps = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const bottom = P([99, 100], 0, lN, lF, A(165, -20), A(165, -20));
  const top = P([99, 100], 0, lN, lF, A(170, -188), A(170, -188));
  return {
    view: "side",
    duration: 2800,
    viewBox: [0, -24, 200, 224],
    props: [{ kind: "dumbbellVertical" }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.5, top],
      [1, bottom],
    ]),
  };
};

const lateralRaise = (): ExerciseAnimation => {
  const lN = IK(110, 182, "right");
  const lF = IK(90, 182, "left");
  const bottom = P([100, 100], 0, lN, lF, A(12, 14), A(-12, -14));
  const top = P([100, 100], 0, lN, lF, A(86, 92), A(-86, -92));
  return {
    view: "front",
    duration: 3000,
    props: [{ kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.52, top],
      [1, bottom],
    ]),
  };
};

const bandPullApart = (): ExerciseAnimation => {
  const lN = IK(110, 182, "right");
  const lF = IK(90, 182, "left");
  const start = P([100, 100], 0, lN, lF, IK(106, 56, "down"), IK(94, 56, "down"));
  const end = P([100, 100], 0, lN, lF, IK(166, 54, "down"), IK(34, 54, "down"));
  return {
    view: "front",
    duration: 2400,
    props: [{ kind: "band", from: "wristF" }],
    keyframes: loop([
      [0, start],
      [0.42, end],
      [0.52, end],
      [1, start],
    ]),
  };
};

/* ------------------------------- jednonóż ---------------------------- */

const reverseLunge = (reach = false): ExerciseAnimation => {
  const front = IK(112, 182, "right");
  const armsTop: Limb = reach ? A(5, 5) : A(0, 0);
  const armsBottom: Limb = reach ? A(170, 175) : A(0, 0);
  const top = P([108, 100], 4, front, IK(104, 182, "down", 90), armsTop, armsTop);
  const mid = P([102, 116], 6, front, IK(80, 170, "down", 70), reach ? A(80, 85) : armsTop, reach ? A(80, 85) : armsTop);
  const bottom = P([92, 136], reach ? 2 : 8, front, IK(54, 176, "down", 50), armsBottom, armsBottom);
  return {
    view: "side",
    duration: reach ? 3600 : 3200,
    viewBox: reach ? [0, -20, 200, 220] : undefined,
    props: reach ? [] : [{ kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, top],
      [0.22, mid],
      [0.45, bottom],
      [0.55, bottom],
      [0.78, mid],
      [1, top],
    ]),
  };
};

const bulgarianSplitSquat = (): ExerciseAnimation => {
  const front = IK(122, 182, "right");
  const rear = IK(50, 140, "down", -100);
  const top = P([102, 104], 6, front, rear, A(0, 0), A(0, 0));
  const bottom = P([96, 142], 14, front, rear, A(0, 0), A(0, 0));
  return {
    view: "side",
    duration: 3200,
    props: [{ kind: "bench", x: 10, y: 146, w: 46 }, { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, top],
      [0.48, bottom],
      [0.56, bottom],
      [1, top],
    ]),
  };
};

const stepUp = (): ExerciseAnimation => {
  const lead = IK(120, 136, "right");
  const bottom = P([96, 100], 12, lead, IK(82, 182, "right"), A(0, 0), A(0, 0));
  const mid = P([106, 80], 6, lead, IK(100, 152, "right", 70), A(0, 0), A(0, 0));
  const top = P([116, 54], 0, lead, IK(114, 136, "right"), A(0, 0), A(0, 0));
  return {
    view: "side",
    duration: 3400,
    viewBox: [0, -30, 200, 230],
    props: [{ kind: "box", x: 100, y: 140, w: 50, h: 46 }, { kind: "dumbbells", hands: "both" }],
    keyframes: loop([
      [0, bottom],
      [0.3, mid],
      [0.48, top],
      [0.58, top],
      [0.8, mid],
      [1, bottom],
    ]),
  };
};

/* --------------------------------- core ------------------------------ */

const plank = (): ExerciseAnimation => {
  const legs = IK(15, 178, "down", 20);
  const a = P([95.6, 163.1], 79.5, legs, legs, A(0, 90), A(0, 90));
  const b = P([95.6, 162.3], 79.2, legs, legs, A(0, 90), A(0, 90));
  return {
    view: "side",
    duration: 3200,
    props: [{ kind: "mat", x1: 6, x2: 190 }],
    keyframes: loop([
      [0, a],
      [0.5, b],
      [1, a],
    ]),
  };
};

const sidePlank = (): ExerciseAnimation => {
  const legs = A(-74, -74);
  const a = P([96, 155.4], 74, legs, legs, A(0, 90, undefined, [1, 0.5]), A(175, 178));
  const b = P([96, 152.4], 73, legs, legs, A(0, 90, undefined, [1, 0.5]), A(178, 180));
  return {
    view: "front",
    duration: 3200,
    props: [{ kind: "mat", x1: 6, x2: 190 }],
    keyframes: loop([
      [0, a],
      [0.5, b],
      [1, a],
    ]),
  };
};

const deadBug = (): ExerciseAnimation => {
  const table = A(180, 90, 180);
  const ext = A(96, 93, 180);
  const up = A(180, 180);
  const over = A(268, 268);
  const base = P([112, 176], -90, table, table, up, up, { head: -90 });
  const s1 = P([112, 176], -90, table, ext, over, up, { head: -90 });
  const s2 = P([112, 176], -90, ext, table, up, over, { head: -90 });
  return {
    view: "side",
    duration: 4800,
    props: [{ kind: "mat", x1: 26, x2: 180 }],
    keyframes: loop([
      [0, base],
      [0.2, s1],
      [0.3, s1],
      [0.5, base],
      [0.7, s2],
      [0.8, s2],
      [1, base],
    ]),
  };
};

const birdDog = (): ExerciseAnimation => {
  const kneel = A(0, -90, -90);
  const legExt = A(-86, -88, -90);
  const armDown = A(0, 0);
  const armExt = A(86, 86);
  const base = P([84, 140], 79, kneel, kneel, armDown, armDown);
  const s1 = P([84, 140], 79, kneel, legExt, armExt, armDown);
  const s2 = P([84, 140], 79, legExt, kneel, armDown, armExt);
  return {
    view: "side",
    duration: 4800,
    props: [{ kind: "mat", x1: 10, x2: 190 }],
    keyframes: loop([
      [0, base],
      [0.2, s1],
      [0.3, s1],
      [0.5, base],
      [0.7, s2],
      [0.8, s2],
      [1, base],
    ]),
  };
};

const hangingKneeRaise = (): ExerciseAnimation => {
  const arm = IK(104, 12, "down");
  const bottom = P([102.7, 114], -2, A(2, 0), A(4, 2), arm, arm);
  const top = P([105, 112], -8, A(100, 10), A(102, 12), arm, arm);
  return {
    view: "side",
    duration: 2800,
    ground: false,
    props: [{ kind: "pullupBar", y: 10, x1: 60, x2: 150, posts: true }],
    keyframes: loop([
      [0, bottom],
      [0.42, top],
      [0.52, top],
      [1, bottom],
    ]),
  };
};

const abWheel = (): ExerciseAnimation => {
  const start = P([56.9, 138.4], 72, A(-8, -90, -90), A(-8, -90, -90), ...both(IK(109, 176, "left")));
  const end = P([89.1, 162.3], 86, A(-65, -90, -90), A(-65, -90, -90), ...both(IK(189, 176, "left")));
  return {
    view: "side",
    duration: 3400,
    props: [{ kind: "mat", x1: 4, x2: 196 }, { kind: "abwheel" }],
    keyframes: loop([
      [0, start],
      [0.48, end],
      [0.56, end],
      [1, start],
    ]),
  };
};

/* ------------------------- funkcjonalne / noszenie -------------------- */

const walkCycle = (arms: { n: [Limb, Limb, Limb, Limb]; f: [Limb, Limb, Limb, Limb] }, torso = 0): Keyframe[] => {
  const front = A(22, 8);
  const back = A(-18, -30);
  const stance = A(0, 0);
  const swing = A(12, -40);
  const frames: [number, Pose, Record<string, number>][] = [
    [0, P([100, 100], torso, front, back, arms.n[0], arms.f[0]), { scroll: 0 }],
    [0.25, P([100, 98], torso, stance, swing, arms.n[1], arms.f[1]), { scroll: 0.25 }],
    [0.5, P([100, 100], torso, back, front, arms.n[2], arms.f[2]), { scroll: 0.5 }],
    [0.75, P([100, 98], torso, swing, stance, arms.n[3], arms.f[3]), { scroll: 0.75 }],
    [1, P([100, 100], torso, front, back, arms.n[0], arms.f[0]), { scroll: 1 }],
  ];
  return frames.map(([t, p, e]) => kf(t, p, e));
};

const farmersWalk = (): ExerciseAnimation => {
  const h = A(0, 0);
  const s1 = A(3, 3);
  const s2 = A(-3, -3);
  return {
    view: "side",
    duration: 1400,
    smooth: false,
    props: [{ kind: "scroll" }, { kind: "dumbbells", hands: "both", heavy: true }],
    keyframes: walkCycle({ n: [s2, h, s1, h], f: [s1, h, s2, h] }),
  };
};

const suitcaseCarry = (): ExerciseAnimation => {
  const h = A(0, 0);
  return {
    view: "side",
    duration: 1400,
    smooth: false,
    props: [{ kind: "scroll" }, { kind: "kettlebell", hands: "near" }],
    keyframes: walkCycle({ n: [h, h, h, h], f: [A(14, 22), A(0, 4), A(-12, -10), A(0, 4)] }),
  };
};

const sledPush = (): ExerciseAnimation => {
  const arm = IK(152, 100, "down");
  const drive = A(55, -5);
  const push = A(-28, -45);
  return {
    view: "side",
    duration: 1100,
    props: [{ kind: "scroll" }, { kind: "sled" }],
    keyframes: loop([
      [0, P([96, 112], 52, drive, push, arm, arm), { scroll: 0 }],
      [0.5, P([96, 110], 52, push, drive, arm, arm), { scroll: 0.5 }],
      [1, P([96, 112], 52, drive, push, arm, arm), { scroll: 1 }],
    ]),
  };
};

const medBallSlam = (): ExerciseAnimation => {
  const [lN, lF] = feet(98);
  const top = P([99, 100], -6, lN, lF, ...both(A(177, 177)));
  const slam = P([84, 124], 45, lN, lF, ...both(A(22, 22)));
  const floor = P([80, 136], 60, lN, lF, ...both(A(7, 7)));
  const rise = P([90, 112], 25, lN, lF, ...both(A(-10, 110)));
  return {
    view: "side",
    duration: 2200,
    viewBox: [0, -30, 200, 230],
    props: [{ kind: "medball" }],
    keyframes: loop([
      [0, top],
      [0.28, slam],
      [0.42, floor],
      [0.55, floor],
      [0.78, rise],
      [1, top],
    ]),
  };
};

const mountainClimber = (): ExerciseAnimation => {
  const straight = A(-68.7, -68.7, 15);
  const drive = A(70, -60, 40);
  const arm = IK(138, 181, "up");
  return {
    view: "side",
    duration: 900,
    props: [],
    keyframes: loop([
      [0, P([96.4, 146.2], 68.7, drive, straight, arm, arm)],
      [0.25, P([99, 132], 85.4, A(5, -100, 20), A(35, -95, 40), arm, arm)],
      [0.5, P([96.4, 146.2], 68.7, straight, drive, arm, arm)],
      [0.75, P([99, 132], 85.4, A(35, -95, 40), A(5, -100, 20), arm, arm)],
      [1, P([96.4, 146.2], 68.7, drive, straight, arm, arm)],
    ]),
  };
};

/* ------------------------------- kondycja ---------------------------- */

const pedalFrames = (
  crank: Vec,
  r: number,
  hip: Vec,
  torso: number,
  arms: (phi: number) => [Limb, Limb],
  n = 12,
): Keyframe[] => {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * Math.PI * 2;
    const pN: Vec = [crank[0] + r * Math.cos(phi), crank[1] + r * Math.sin(phi)];
    const pF: Vec = [crank[0] - r * Math.cos(phi), crank[1] - r * Math.sin(phi)];
    const [aN, aF] = arms(phi);
    frames.push(kf(i / n, P(hip, torso, IK(pN[0], pN[1], "right", 100), IK(pF[0], pF[1], "right", 100), aN, aF), { phi: i / n }));
  }
  return frames;
};

const airBike = (): ExerciseAnimation => ({
  view: "side",
  duration: 1600,
  smooth: false,
  props: [{ kind: "airbike", crank: [112, 160], r: 15 }],
  keyframes: pedalFrames([112, 160], 15, [88, 104], 18, (phi) => [
    IK(126 + 10 * Math.cos(phi), 84, "down"),
    IK(126 - 10 * Math.cos(phi), 84, "down"),
  ]),
});

const uprightBike = (): ExerciseAnimation => ({
  view: "side",
  duration: 1500,
  smooth: false,
  props: [{ kind: "uprightBike", crank: [112, 160], r: 15, bars: [140, 88] }],
  keyframes: pedalFrames([112, 160], 15, [88, 104], 24, () => [IK(140, 88, "down"), IK(140, 88, "down")]),
});

const rower = (): ExerciseAnimation => {
  const legs = IK(150, 168, "up", 150);
  const catchP = P([102, 166], 25, legs, legs, ...both(IK(168, 140, "down")));
  const drive = P([80, 166], 20, legs, legs, ...both(IK(146, 138, "down")));
  const finish = P([72, 166], -25, legs, legs, ...both(IK(80, 140, "down")));
  const armsAway = P([72, 166], 15, legs, legs, ...both(IK(124, 140, "down")));
  const slide = P([95, 166], 25, legs, legs, ...both(IK(160, 140, "down")));
  return {
    view: "side",
    duration: 2600,
    props: [{ kind: "rower", foot: [150, 168], fly: [184, 146], rail: [30, 184, 174] }],
    keyframes: loop([
      [0, catchP],
      [0.18, drive],
      [0.32, finish],
      [0.45, finish],
      [0.62, armsAway],
      [0.85, slide],
      [1, catchP],
    ]),
  };
};

const jumpingJack = (): ExerciseAnimation => {
  const closed = P([100, 100], 0, A(3, 2), A(-3, -2), A(8, 6), A(-8, -6));
  const open = P([100, 96], 0, A(16, 14), A(-16, -14), A(160, 170), A(-160, -170));
  return {
    view: "front",
    duration: 1200,
    viewBox: [0, -20, 200, 220],
    props: [],
    keyframes: loop([
      [0, closed],
      [0.5, open],
      [1, closed],
    ]),
  };
};

/* --------------------------- rozgrzewka/mobilność --------------------- */

const legSwings = (): ExerciseAnimation => {
  const stance = IK(98, 182, "right");
  const wallHand = IK(150, 72, "down");
  const back = P([100, 100], 2, A(-35, -30), stance, A(0, 0), wallHand);
  const front = P([100, 100], -2, A(55, 45), stance, A(0, 0), wallHand);
  return {
    view: "side",
    duration: 1800,
    props: [{ kind: "wall", x: 152 }],
    keyframes: loop([
      [0, back],
      [0.5, front],
      [1, back],
    ]),
  };
};

const catCow = (): ExerciseAnimation => {
  const kneel = A(0, -90, -90);
  const arm = A(0, 0);
  const cow = P([70, 140], 79, kneel, kneel, arm, arm, { curve: -6, head: 55 });
  const cat = P([70, 138], 79, kneel, kneel, arm, arm, { curve: 9, head: 125 });
  return {
    view: "side",
    duration: 4000,
    props: [{ kind: "mat", x1: 10, x2: 190 }],
    keyframes: loop([
      [0, cow],
      [0.5, cat],
      [1, cow],
    ]),
  };
};

const hipFlexorStretch = (): ExerciseAnimation => {
  const front = IK(132, 182, "right");
  const back = IK(32, 180, "down", -90);
  const a = P([88, 138], 0, front, back, A(30, 60), A(175, 180));
  const b = P([96, 140], -6, front, back, A(30, 60), A(182, 186));
  return {
    view: "side",
    duration: 5000,
    viewBox: [0, -20, 200, 220],
    props: [{ kind: "mat", x1: 10, x2: 190 }],
    keyframes: loop([
      [0, a],
      [0.5, b],
      [1, a],
    ]),
  };
};

const hamstringStretch = (): ExerciseAnimation => {
  const legs = A(90, 90, 180);
  const a = P([60, 176], 0, legs, legs, A(100, 100), A(100, 100));
  const b = P([60, 176], 55, legs, legs, A(115, 105), A(115, 105));
  return {
    view: "side",
    duration: 5000,
    props: [{ kind: "mat", x1: 20, x2: 190 }],
    keyframes: loop([
      [0, a],
      [0.5, b],
      [0.7, b],
      [1, a],
    ]),
  };
};

const childsPose = (): ExerciseAnimation => {
  const legs = IK(60, 179, "down", -90);
  const tall = P([100, 140], 0, legs, legs, A(0, 0), A(0, 0));
  const pose = P([62, 166], 96, legs, legs, A(85, 88), A(85, 88));
  return {
    view: "side",
    duration: 5600,
    props: [{ kind: "mat", x1: 30, x2: 196 }],
    keyframes: loop([
      [0, tall],
      [0.22, P([70.3, 152.3], 50, legs, legs, A(45, 45), A(45, 45))],
      [0.45, pose],
      [0.75, pose],
      [0.88, P([70.3, 152.3], 50, legs, legs, A(45, 45), A(45, 45))],
      [1, tall],
    ]),
  };
};

const breathing = (): ExerciseAnimation => {
  const legs = IK(150, 182, "up", 90);
  const arms = A(92, 92);
  const exhale = P([112, 176], -90, legs, legs, arms, arms, { head: -90, curve: 0 });
  const inhale = P([112, 176], -90, legs, legs, arms, arms, { head: -90, curve: -6 });
  return {
    view: "side",
    duration: 8000,
    props: [{ kind: "mat", x1: 26, x2: 180 }],
    keyframes: loop([
      [0, exhale],
      [0.5, inhale],
      [1, exhale],
    ]),
  };
};

/* ------------------------------- rejestr ------------------------------ */

const REGISTRY: Record<string, () => ExerciseAnimation> = {
  back_squat: backSquat,
  front_squat: frontSquat,
  goblet_squat: gobletSquat,
  bodyweight_squat: bodyweightSquat,
  romanian_deadlift: () => rdl("barbell"),
  db_rdl: () => rdl("dumbbells"),
  trap_bar_deadlift: trapBarDeadlift,
  kettlebell_swing: kettlebellSwing,
  hip_thrust: hipThrust,
  glute_bridge: gluteBridge,
  bench_press: () => benchLike("barbell"),
  db_bench_press: () => benchLike("dumbbells"),
  incline_db_press: inclineDbPress,
  push_up: pushUp,
  overhead_press: overheadPress,
  db_shoulder_press: dbShoulderPress,
  dips: dips,
  barbell_row: barbellRow,
  one_arm_db_row: oneArmRow,
  pull_up: () => pullUp(false),
  chin_up: () => pullUp(true),
  dead_hang: deadHang,
  lat_pulldown: latPulldown,
  inverted_row: invertedRow,
  band_row: bandRow,
  seated_cable_row: seatedCableRow,
  face_pull: facePull,
  db_curl: dbCurl,
  triceps_pushdown: tricepsPushdown,
  overhead_triceps_extension: overheadTriceps,
  lateral_raise: lateralRaise,
  band_pull_apart: bandPullApart,
  reverse_lunge: () => reverseLunge(false),
  lunge_reach: () => reverseLunge(true),
  bulgarian_split_squat: bulgarianSplitSquat,
  step_up: stepUp,
  plank: plank,
  side_plank: sidePlank,
  dead_bug: deadBug,
  bird_dog: birdDog,
  hanging_knee_raise: hangingKneeRaise,
  ab_wheel_rollout: abWheel,
  farmers_walk: farmersWalk,
  suitcase_carry: suitcaseCarry,
  sled_push: sledPush,
  med_ball_slam: medBallSlam,
  mountain_climber: mountainClimber,
  air_bike: airBike,
  stationary_bike: uprightBike,
  rower: rower,
  jumping_jack: jumpingJack,
  leg_swings: legSwings,
  cat_cow: catCow,
  hip_flexor_stretch: hipFlexorStretch,
  hamstring_stretch: hamstringStretch,
  childs_pose: childsPose,
  diaphragmatic_breathing: breathing,
};

const cache = new Map<string, ExerciseAnimation>();

/** Zwraca animację lub null, jeśli dla ćwiczenia nie przygotowano demonstracji. */
export function getAnimation(exerciseId: string): ExerciseAnimation | null {
  if (cache.has(exerciseId)) return cache.get(exerciseId)!;
  const f = REGISTRY[exerciseId];
  if (!f) return null;
  const a = f();
  cache.set(exerciseId, a);
  return a;
}

export function hasAnimation(exerciseId: string): boolean {
  return exerciseId in REGISTRY;
}

export const ANIMATED_EXERCISE_IDS = Object.keys(REGISTRY);
