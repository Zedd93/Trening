"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ANIMATED_EXERCISE_IDS, getAnimation } from "@/lib/training/animations";
import { getExercise } from "@/lib/training/exercises";
import { AnimationScene, ExerciseAnimation } from "@/components/ExerciseAnimation";

/** Publiczny podgląd wszystkich demonstracji (kontrola jakości animacji). */
function Gallery() {
  const params = useSearchParams();
  const frames = params.get("klatki") === "1";
  const only = params.get("id");
  const ids = only ? [only] : ANIMATED_EXERCISE_IDS;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/o-aplikacji" className="text-sm text-muted">
        ← O aplikacji
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Demonstracje ćwiczeń ({ids.length})</h1>
      <p className="mb-4 text-sm text-muted">Każde ćwiczenie ma własną sekwencję ruchu. {frames ? "Widok klatek: 0%, 25%, 50%, 75% cyklu." : ""}</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => (
          <li key={id} className="rounded-2xl border border-line bg-surface p-3" data-exercise={id}>
            <div className="mb-2 text-sm font-medium">{getExercise(id)?.name ?? id}</div>
            {frames ? (
              <div className="grid grid-cols-4 gap-1">
                {[0, 0.25, 0.5, 0.75].map((p) => (
                  <div key={p} className="aspect-square rounded-lg bg-surface-2">
                    <AnimationScene anim={getAnimation(id)!} phase={p} />
                  </div>
                ))}
              </div>
            ) : (
              <ExerciseAnimation exerciseId={id} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnimationsPage() {
  return (
    <Suspense>
      <Gallery />
    </Suspense>
  );
}
