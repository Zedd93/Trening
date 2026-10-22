"use client";

import type { FoodCategory, FoodProduct, PlanIngredient } from "@/lib/domain/types";

/**
 * Ilustracja talerza generowana ze składników posiłku (proporcje masy).
 * Zamiast przypadkowych zdjęć stockowych — obraz zawsze odpowiada
 * faktycznemu składowi i gramaturom danego posiłku.
 */
const COLORS: Record<FoodCategory, string> = {
  meat: "#c9876b",
  fish: "#e8a48a",
  eggs: "#f2d16b",
  dairy: "#efeee6",
  grains: "#e6d3a3",
  bread: "#c79a5b",
  legumes: "#b9a26a",
  vegetables: "#6fae5a",
  fruit: "#d9536f",
  nuts: "#a87a4f",
  fats: "#e8c84a",
  sweets: "#6b4a3a",
  drinks: "#8fc3e8",
  spices: "#8a6a4a",
  ready: "#b8a07a",
  other: "#9aa08f",
};

export function MealIllustration({ ingredients, products, size = 96, title }: { ingredients: PlanIngredient[]; products: Record<string, FoodProduct>; size?: number; title: string }) {
  const items = ingredients
    .map((i) => ({ p: products[i.product_id], g: i.grams }))
    .filter((x) => x.p && x.p.category !== "fats" && x.p.category !== "spices" && x.g > 0);
  const total = items.reduce((s, x) => s + Math.sqrt(x.g), 0) || 1;
  let angle = -Math.PI / 2;
  const r = 34;
  const segs = items.map((x, idx) => {
    const a = (Math.sqrt(x.g) / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + a;
    angle = a1;
    const large = a > Math.PI ? 1 : 0;
    const p0 = [50 + r * Math.cos(a0), 50 + r * Math.sin(a0)];
    const p1 = [50 + r * Math.cos(a1), 50 + r * Math.sin(a1)];
    const mid = (a0 + a1) / 2;
    // „tekstura”: kilka kropek w kolorze produktu
    const dots = Array.from({ length: Math.min(6, Math.max(2, Math.round(a * 3))) }, (_, k) => {
      const t = (k + 0.5) / Math.max(2, Math.round(a * 3));
      const ang = a0 + a * t;
      const rr = r * (0.45 + 0.35 * ((k * 37) % 10) / 10);
      return [50 + rr * Math.cos(ang), 50 + rr * Math.sin(ang)];
    });
    return {
      d: items.length === 1 ? undefined : `M50,50 L${p0[0]},${p0[1]} A${r},${r} 0 ${large} 1 ${p1[0]},${p1[1]} Z`,
      color: COLORS[x.p.category],
      dots,
      key: `${x.p.id}-${idx}`,
      mid,
    };
  });
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Ilustracja składu talerza: ${title}`} className="shrink-0">
      <circle cx="50" cy="50" r="47" fill="var(--surface-3)" />
      <circle cx="50" cy="50" r="40" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1" />
      {segs.map((s) =>
        s.d ? (
          <g key={s.key}>
            <path d={s.d} fill={s.color} opacity={0.88} stroke="var(--surface-2)" strokeWidth="1.5" />
            {s.dots.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={1.6} fill="#000" opacity={0.12} />
            ))}
          </g>
        ) : (
          <circle key={s.key} cx="50" cy="50" r={r} fill={s.color} opacity={0.88} />
        ),
      )}
    </svg>
  );
}

export const CATEGORY_COLORS = COLORS;
