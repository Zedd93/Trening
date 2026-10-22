import { describe, expect, it } from "vitest";
import { ANIMATED_EXERCISE_IDS, getAnimation } from "@/lib/training/animations";
import { EXERCISES } from "@/lib/training/exercises";
import { computeJoints, sample, SEG, type Pose, type Limb } from "@/lib/training/rig";

function ikReach(pose: Pose, view: "side" | "front") {
  const j = computeJoints(pose, view);
  const issues: string[] = [];
  const check = (limb: Limb, root: [number, number], l1: number, l2: number, name: string) => {
    if (!("ik" in limb)) return;
    const t = Array.isArray(limb.ik) ? limb.ik : [ (j as any)[limb.ik.rel][0] + limb.ik.d[0], (j as any)[limb.ik.rel][1] + limb.ik.d[1] ];
    const d = Math.hypot(t[0] - root[0], t[1] - root[1]);
    if (d > l1 + l2 + 3) issues.push(`${name} za daleko: ${d.toFixed(1)} > ${l1 + l2}`);
    if (d < Math.abs(l1 - l2) - 1) issues.push(`${name} za blisko: ${d.toFixed(1)}`);
  };
  check(pose.legN, j.hipN, SEG.thigh, SEG.shin, "legN");
  check(pose.legF, j.hipF, SEG.thigh, SEG.shin, "legF");
  check(pose.armN, j.shoulderN, SEG.upperArm, SEG.forearm, "armN");
  check(pose.armF, j.shoulderF, SEG.upperArm, SEG.forearm, "armF");
  return { j, issues };
}

describe("animacje ćwiczeń", () => {
  it("każde ćwiczenie w katalogu ma dedykowaną animację", () => {
    const missing = EXERCISES.filter((e) => !ANIMATED_EXERCISE_IDS.includes(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  for (const id of ANIMATED_EXERCISE_IDS) {
    it(`${id}: cele IK osiągalne i sylwetka w kadrze`, () => {
      const a = getAnimation(id)!;
      const vb = a.viewBox ?? [0, 0, 200, 200];
      const problems: string[] = [];
      for (let k = 0; k <= 40; k++) {
        const { pose } = sample(a.keyframes, k / 40, a.smooth !== false);
        const { j, issues } = ikReach(pose, a.view);
        problems.push(...issues.map((s) => `t=${(k / 40).toFixed(2)} ${s}`));
        const pts = [j.head, j.hip, j.shoulder, j.kneeN, j.kneeF, j.ankleN, j.ankleF, j.wristN, j.wristF, j.elbowN, j.elbowF];
        for (const p of pts) {
          if (p[0] < vb[0] - 4 || p[0] > vb[0] + vb[2] + 4 || p[1] < vb[1] - 4 || p[1] > vb[1] + vb[3] + 4)
            problems.push(`t=${(k / 40).toFixed(2)} punkt poza kadrem ${p.map((x) => x.toFixed(0))}`);
        }
        if (a.ground !== false) {
          for (const p of [j.ankleN, j.ankleF, j.kneeN, j.kneeF, j.wristN, j.wristF, j.head])
            if (p[1] > 190) problems.push(`t=${(k / 40).toFixed(2)} punkt pod podłogą y=${p[1].toFixed(1)}`);
        }
      }
      expect([...new Set(problems)].slice(0, 6)).toEqual([]);
    });
  }

  it("różne ćwiczenia mają różne sekwencje ruchu", () => {
    const sigs = new Map<string, string>();
    for (const id of ANIMATED_EXERCISE_IDS) {
      const a = getAnimation(id)!;
      const sig = JSON.stringify(a.keyframes.map((k) => k.pose)) + JSON.stringify(a.props);
      expect(sigs.has(sig), `${id} duplikuje ${sigs.get(sig)}`).toBe(false);
      sigs.set(sig, id);
    }
  });
});
