"use client";

import { useEffect, useRef, useState } from "react";
import { getAnimation, type ExerciseAnimation as Anim, type PropSpec } from "@/lib/training/animations";
import { computeJoints, sample, GROUND_Y, type Joints, type Vec } from "@/lib/training/rig";
import { getExercise } from "@/lib/training/exercises";
import { IconPause, IconPlay, IconReplay } from "./icons";
import { cx } from "./ui";
import { usePrefersReducedMotion } from "@/lib/hooks";

const S = "var(--figure)";
const SF = "var(--figure-far)";
const EQ = "var(--equip)";
const EQ2 = "var(--equip-2)";

const line = (a: Vec, b: Vec, w: number, color: string, key?: string) => (
  <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeLinecap="round" />
);
const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function Limb({ a, b, c, d, color, w }: { a: Vec; b: Vec; c: Vec; d?: Vec; color: string; w: number }) {
  return (
    <g>
      {line(a, b, w, color)}
      {line(b, c, w * 0.85, color)}
      {d && line(c, d, w * 0.6, color)}
    </g>
  );
}

function Plate({ at, r }: { at: Vec; r: number }) {
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={r} fill="none" stroke={EQ} strokeWidth={4} />
      <circle cx={at[0]} cy={at[1]} r={r * 0.55} fill="none" stroke={EQ2} strokeWidth={2} />
      <circle cx={at[0]} cy={at[1]} r={2.5} fill={EQ} />
    </g>
  );
}

function Dumbbell({ at, view, heavy }: { at: Vec; view: "side" | "front"; heavy?: boolean }) {
  const r = heavy ? 8 : 6.5;
  if (view === "front")
    return (
      <g>
        <rect x={at[0] - 3} y={at[1] - r} width={6} height={r * 2} rx={2} fill={EQ} />
      </g>
    );
  return <circle cx={at[0]} cy={at[1]} r={r} fill={EQ} stroke={EQ2} strokeWidth={1.5} />;
}

function Kettlebell({ at, dir = [0, 1] }: { at: Vec; dir?: Vec }) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const c: Vec = [at[0] + (dir[0] / len) * 10, at[1] + (dir[1] / len) * 10];
  return (
    <g>
      <circle cx={(at[0] + c[0]) / 2} cy={(at[1] + c[1]) / 2} r={4} fill="none" stroke={EQ} strokeWidth={2.5} />
      <circle cx={c[0]} cy={c[1]} r={8} fill={EQ} />
    </g>
  );
}

function renderProp(p: PropSpec, j: Joints, view: "side" | "front", phase: number, key: number) {
  switch (p.kind) {
    case "barbell":
      if (view === "front") return <g key={key}>{line([j.wristF[0] - 25, j.wristF[1]], [j.wristN[0] + 25, j.wristN[1]], 3, EQ)}</g>;
      return <Plate key={key} at={j.wristN} r={p.r ?? 18} />;
    case "trapbar":
      return (
        <g key={key}>
          <Plate at={j.wristN} r={21} />
          {line([j.wristN[0] - 12, j.wristN[1]], [j.wristN[0] + 12, j.wristN[1]], 3, EQ)}
        </g>
      );
    case "dumbbells":
      return (
        <g key={key}>
          {p.hands === "both" && <Dumbbell at={j.wristF} view={view} heavy={p.heavy} />}
          <Dumbbell at={j.wristN} view={view} heavy={p.heavy} />
        </g>
      );
    case "dumbbellVertical":
      return (
        <g key={key}>
          {line([j.wristN[0], j.wristN[1] - 9], [j.wristN[0], j.wristN[1] + 9], 3, EQ)}
          <rect x={j.wristN[0] - 7} y={j.wristN[1] - 13} width={14} height={6} rx={2} fill={EQ} />
          <rect x={j.wristN[0] - 7} y={j.wristN[1] + 7} width={14} height={6} rx={2} fill={EQ} />
        </g>
      );
    case "kettlebell": {
      if (p.hands === "goblet") return <Kettlebell key={key} at={mid(j.wristN, j.wristF)} />;
      if (p.hands === "swing") return <Kettlebell key={key} at={j.wristN} dir={[j.wristN[0] - j.elbowN[0], j.wristN[1] - j.elbowN[1]]} />;
      return <Kettlebell key={key} at={j.wristN} />;
    }
    case "bench":
      return (
        <g key={key}>
          <rect x={p.x} y={p.y} width={p.w} height={7} rx={3} fill={EQ2} />
          {line([p.x + 8, p.y + 7], [p.x + 8, GROUND_Y], 3, EQ2)}
          {line([p.x + p.w - 8, p.y + 7], [p.x + p.w - 8, GROUND_Y], 3, EQ2)}
        </g>
      );
    case "inclineBench": {
      const rad = (p.angle * Math.PI) / 180;
      const end: Vec = [p.pivot[0] + Math.sin(rad) * p.len, p.pivot[1] - Math.cos(rad) * p.len];
      return (
        <g key={key}>
          {line(p.pivot, end, 7, EQ2)}
          {line([p.seat[0] - 8, p.seat[1] + 8], [p.seat[0] + 26, p.seat[1] + 8], 7, EQ2)}
          {line([p.seat[0] + 8, p.seat[1] + 10], [p.seat[0] + 8, GROUND_Y], 3, EQ2)}
        </g>
      );
    }
    case "pullupBar":
      return (
        <g key={key}>
          {line([p.x1, p.y], [p.x2, p.y], 4, EQ)}
          {p.posts && line([p.x1 + 4, p.y], [p.x1 + 4, 200], 3, EQ2)}
          {p.posts && line([p.x2 - 4, p.y], [p.x2 - 4, 200], 3, EQ2)}
        </g>
      );
    case "dipBars":
      return (
        <g key={key}>
          {line([p.x1, p.y], [p.x2, p.y], 4, EQ)}
          {line([p.x1 + 5, p.y], [p.x1 + 5, GROUND_Y], 3, EQ2)}
          {line([p.x2 - 5, p.y], [p.x2 - 5, GROUND_Y], 3, EQ2)}
        </g>
      );
    case "box":
      return <rect key={key} x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="none" stroke={EQ2} strokeWidth={3} />;
    case "cable":
      return (
        <g key={key}>
          {p.tower !== undefined && line([p.tower, 0], [p.tower, GROUND_Y], 4, EQ2)}
          {p.tower !== undefined && p.from[0] !== p.tower && line([p.from[0], p.from[1]], [p.tower, p.from[1]], 3, EQ2)}
          <circle cx={p.from[0]} cy={p.from[1]} r={3.5} fill={EQ2} />
          {line(p.from, mid(j.wristN, j.wristF), 1.5, EQ)}
          {p.handle === "bar" && line([j.wristN[0] - 6, j.wristN[1]], [j.wristN[0] + 6, j.wristN[1]], 3, EQ)}
          {p.handle === "rope" && <circle cx={j.wristN[0]} cy={j.wristN[1]} r={3.5} fill={EQ} />}
          {p.handle === "single" && <rect x={j.wristN[0] - 3} y={j.wristN[1] - 5} width={6} height={10} rx={2} fill={EQ} />}
        </g>
      );
    case "band": {
      const from = p.from === "wristF" ? j.wristF : p.from;
      return (
        <g key={key}>
          {line(from, j.wristN, 2.5, "var(--warning)")}
          {p.from !== "wristF" && line(from, j.wristF, 2.5, "var(--warning)")}
        </g>
      );
    }
    case "medball": {
      const c: Vec = [mid(j.wristN, j.wristF)[0], mid(j.wristN, j.wristF)[1] + 6];
      return <circle key={key} cx={c[0]} cy={c[1]} r={10} fill={EQ} stroke={EQ2} strokeWidth={2} />;
    }
    case "abwheel":
      return (
        <g key={key}>
          <circle cx={j.wristN[0]} cy={j.wristN[1] + 1} r={9} fill="none" stroke={EQ} strokeWidth={4} />
          <circle cx={j.wristN[0]} cy={j.wristN[1] + 1} r={2} fill={EQ} />
        </g>
      );
    case "sled": {
      const w = j.wristN;
      return (
        <g key={key}>
          {line(w, [w[0] + 8, GROUND_Y - 30], 4, EQ2)}
          <rect x={w[0] + 2} y={GROUND_Y - 30} width={34} height={26} rx={3} fill="none" stroke={EQ} strokeWidth={3} />
          {line([w[0] - 2, GROUND_Y - 2], [w[0] + 40, GROUND_Y - 2], 3, EQ2)}
        </g>
      );
    }
    case "wall":
      return <rect key={key} x={p.x} y={0} width={6} height={GROUND_Y} fill={EQ2} opacity={0.6} />;
    case "mat":
      return <rect key={key} x={p.x1} y={GROUND_Y - 3} width={p.x2 - p.x1} height={4} rx={2} fill={EQ2} opacity={0.7} />;
    case "scroll": {
      const off = (j.extra.scroll ?? phase) * 40;
      return (
        <g key={key} opacity={0.6}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const x = ((i * 40 - off) % 240 + 240) % 240 - 20;
            return line([x, GROUND_Y + 6], [x + 14, GROUND_Y + 6], 2, EQ2, `s${i}`);
          })}
        </g>
      );
    }
    case "airbike":
      return (
        <g key={key}>
          <circle cx={150} cy={146} r={26} fill="none" stroke={EQ2} strokeWidth={3} />
          {[0, 1, 2, 3].map((i) => {
            const a = phase * Math.PI * 2 * 2 + (i * Math.PI) / 2;
            return line([150, 146], [150 + Math.cos(a) * 24, 146 + Math.sin(a) * 24], 1.5, EQ2, `f${i}`);
          })}
          {line([86, 112], [112, 160], 4, EQ2)}
          {line([112, 160], [150, 146], 4, EQ2)}
          {line([78, 110], [96, 110], 5, EQ)}
          {line([130, 140], [j.wristN[0], j.wristN[1]], 3, EQ)}
          {line([130, 140], [j.wristF[0], j.wristF[1]], 3, EQ2)}
          <circle cx={p.crank[0]} cy={p.crank[1]} r={p.r} fill="none" stroke={EQ2} strokeWidth={1.5} strokeDasharray="3 3" />
          {line([92, 160], [92, GROUND_Y], 3, EQ2)}
          {line([70, GROUND_Y], [178, GROUND_Y], 4, EQ2)}
        </g>
      );
    case "uprightBike":
      return (
        <g key={key}>
          {line([86, 112], [112, 160], 4, EQ2)}
          {line([112, 160], [p.bars[0], p.bars[1] + 6], 4, EQ2)}
          {line([78, 110], [96, 110], 5, EQ)}
          {line([p.bars[0] - 6, p.bars[1]], [p.bars[0] + 6, p.bars[1]], 4, EQ)}
          <circle cx={p.crank[0]} cy={p.crank[1]} r={p.r} fill="none" stroke={EQ2} strokeWidth={1.5} strokeDasharray="3 3" />
          <circle cx={140} cy={166} r={16} fill="none" stroke={EQ2} strokeWidth={3} />
          {line([70, GROUND_Y], [170, GROUND_Y], 4, EQ2)}
        </g>
      );
    case "rower":
      return (
        <g key={key}>
          {line([p.rail[0], p.rail[2]], [p.rail[1], p.rail[2]], 4, EQ2)}
          <rect x={j.hip[0] - 12} y={j.hip[1] + 4} width={24} height={5} rx={2} fill={EQ} />
          {line([p.foot[0] + 6, p.foot[1] - 14], [p.foot[0] + 10, p.foot[1] + 4], 4, EQ2)}
          <circle cx={p.fly[0]} cy={p.fly[1]} r={13} fill="none" stroke={EQ2} strokeWidth={3} />
          {line(j.wristN, p.fly, 1.5, EQ)}
          {line([j.wristN[0], j.wristN[1] - 5], [j.wristN[0], j.wristN[1] + 5], 3, EQ)}
        </g>
      );
    case "rackBar":
      return (
        <g key={key}>
          {line([p.x - 20, p.y], [p.x + 20, p.y], 4, EQ)}
          {line([p.x - 16, p.y - 10], [p.x - 16, GROUND_Y], 4, EQ2)}
        </g>
      );
  }
}

const BACKGROUND_PROPS = new Set(["bench", "inclineBench", "pullupBar", "dipBars", "box", "wall", "mat", "scroll", "airbike", "uprightBike", "rower", "rackBar"]);

/** Znacznik kierunku twarzy (widok z boku) — ułatwia odczytanie orientacji sylwetki. */
function Eye({ j }: { j: Joints }) {
  const v: Vec = [j.head[0] - j.neck[0], j.head[1] - j.neck[1]];
  const l = Math.hypot(v[0], v[1]) || 1;
  const front: Vec = [-v[1] / l, v[0] / l];
  return <circle cx={j.head[0] + front[0] * 4.5 + (v[0] / l) * 1.5} cy={j.head[1] + front[1] * 4.5 + (v[1] / l) * 1.5} r={1.8} fill="var(--bg)" />;
}

export function Figure({ j, view }: { j: Joints; view: "side" | "front" }) {
  const far = view === "side" ? SF : S;
  const W = 7.5;
  // tułów jako krzywa (wygięcie kręgosłupa)
  const tv: Vec = [j.shoulder[0] - j.hip[0], j.shoulder[1] - j.hip[1]];
  const len = Math.hypot(tv[0], tv[1]) || 1;
  const back: Vec = [tv[1] / len, -tv[0] / len]; // normalna w stronę grzbietu
  // punkt kontrolny krzywej Béziera: szczyt łuku leży w połowie odsunięcia
  const ctrl: Vec = [(j.hip[0] + j.shoulder[0]) / 2 + back[0] * j.curve * 2, (j.hip[1] + j.shoulder[1]) / 2 + back[1] * j.curve * 2];
  return (
    <g>
      <Limb a={j.hipF} b={j.kneeF} c={j.ankleF} d={j.toeF} color={far} w={W} />
      <Limb a={j.shoulderF} b={j.elbowF} c={j.wristF} color={far} w={W * 0.8} />
      {view === "front" && line(j.hipN, j.hipF, W, S)}
      {view === "front" && line(j.shoulderN, j.shoulderF, W, S)}
      <path d={`M${j.hip[0]},${j.hip[1]} Q${ctrl[0]},${ctrl[1]} ${j.shoulder[0]},${j.shoulder[1]}`} stroke={S} strokeWidth={W * 1.55} strokeLinecap="round" fill="none" />
      {line(j.shoulder, j.neck, W * 0.7, S)}
      <circle cx={j.head[0]} cy={j.head[1]} r={9} fill={S} />
      {view === "side" && <Eye j={j} />}
      <Limb a={j.hipN} b={j.kneeN} c={j.ankleN} d={j.toeN} color={S} w={W} />
    </g>
  );
}

export function AnimationScene({ anim, phase }: { anim: Anim; phase: number }) {
  const { pose, extra } = sample(anim.keyframes, phase, anim.smooth !== false);
  const j = computeJoints(pose, anim.view, extra);
  const vb = anim.viewBox ?? [0, 0, 200, 200];
  const bg = anim.props.filter((p) => BACKGROUND_PROPS.has(p.kind));
  const held = anim.props.filter((p) => !BACKGROUND_PROPS.has(p.kind));
  return (
    <svg viewBox={vb.join(" ")} className="h-full w-full" role="img">
      {anim.ground !== false && line([vb[0], GROUND_Y + 1], [vb[0] + vb[2], GROUND_Y + 1], 2, "var(--border)")}
      {bg.map((p, i) => renderProp(p, j, anim.view, phase, i))}
      <Figure j={j} view={anim.view} />
      {held.map((p, i) => renderProp(p, j, anim.view, phase, 100 + i))}
      {/* ramię bliższe na wierzchu (trzyma sprzęt) */}
      <Limb a={j.shoulderN} b={j.elbowN} c={j.wristN} color={S} w={7.5 * 0.8} />
    </svg>
  );
}

export function ExerciseAnimation({
  exerciseId,
  size = "md",
  autoPlay = true,
  initialPhase = 0,
  className,
}: {
  exerciseId: string;
  size?: "sm" | "md" | "lg";
  autoPlay?: boolean;
  initialPhase?: number;
  className?: string;
}) {
  const anim = getAnimation(exerciseId);
  const ex = getExercise(exerciseId);
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(autoPlay);
  const [phase, setPhase] = useState(initialPhase);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const userToggled = useRef(false);

  useEffect(() => {
    if (reduced && !userToggled.current) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    if (!playing || !anim) return;
    const step = (t: number) => {
      if (last.current !== null) setPhase((p) => (p + (t - last.current!) / anim.duration) % 1);
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, anim]);

  if (!anim) {
    return (
      <div className={cx("flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-line p-4 text-center", className)}>
        <p className="text-sm font-medium">Demonstracja niedostępna</p>
        <p className="mt-1 text-xs text-muted">Skorzystaj z opisu technicznego poniżej. Nie wyświetlamy zastępczej animacji, aby nie wprowadzać w błąd.</p>
      </div>
    );
  }

  const h = size === "sm" ? "h-28 w-28" : size === "lg" ? "aspect-square w-full sm:aspect-auto sm:h-80 sm:w-80" : "h-48 w-48";
  return (
    <figure className={cx("relative shrink-0 select-none", size === "lg" && "w-full max-w-[24rem] sm:w-auto", className)} aria-label={`Animowana demonstracja: ${ex?.name ?? exerciseId}`}>
      <div className={cx("overflow-hidden rounded-xl bg-surface-2", h)}>
        <AnimationScene anim={anim} phase={phase} />
      </div>
      {size !== "sm" && (
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg bg-surface/90 text-fg hover:bg-surface-3"
            onClick={() => {
              userToggled.current = true;
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pauza animacji" : "Odtwórz animację"}
          >
            {playing ? <IconPause width={18} height={18} /> : <IconPlay width={18} height={18} />}
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg bg-surface/90 text-fg hover:bg-surface-3"
            onClick={() => {
              userToggled.current = true;
              setPhase(0);
              setPlaying(true);
            }}
            aria-label="Uruchom animację od początku"
          >
            <IconReplay width={18} height={18} />
          </button>
        </div>
      )}
      {size !== "sm" && (
        <figcaption className="absolute left-2 top-2 rounded-md bg-surface/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {anim.view === "front" ? "widok z przodu" : "widok z boku"}
          {reduced && !playing ? " · ograniczony ruch" : ""}
        </figcaption>
      )}
    </figure>
  );
}
