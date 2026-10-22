"use client";

import { useMemo, useState } from "react";
import type { FoodProduct } from "@/lib/domain/types";
import { useData, useProducts } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { ProductForm } from "@/components/nutrition/ProductForm";
import { ProductPicker } from "@/components/nutrition/ProductPicker";
import { Badge, Button, Card, Input, Modal, PageHeader, Segmented } from "@/components/ui";
import { IconPlus, IconTrash } from "@/components/icons";
import { deleteProduct } from "@/lib/actions/nutrition";
import { ALLERGEN_LABELS, CATEGORY_LABELS, searchProducts } from "@/lib/nutrition/foods";
import { fmt } from "@/lib/utils/format";

export default function ProductsPage() {
  const data = useData();
  const products = useProducts();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FoodProduct | null>(null);
  const [details, setDetails] = useState<FoodProduct | null>(null);
  const mine = Object.values(data.food_products);
  const list = useMemo(() => searchProducts(tab === "mine" ? mine : Object.values(products).filter((p) => !p.id.startsWith("recipe:")), q, 200), [tab, mine, products, q]);

  return (
    <>
      <PageHeader
        title="Baza produktów"
        subtitle="Produkty generyczne, pakowane (Open Food Facts) i własne — zawsze ze źródłem danych"
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <IconPlus width={18} height={18} /> Dodaj produkt
          </Button>
        }
      />
      <DietNav />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          ariaLabel="Zakres"
          value={tab}
          onChange={setTab}
          options={[
            { value: "mine", label: `Moje (${mine.length})` },
            { value: "all", label: "Wszystkie" },
          ]}
        />
        <Input aria-label="Szukaj" placeholder="Szukaj produktu lub kodu…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 pr-2 font-normal">Produkt</th>
                <th className="py-1.5 pr-2 font-normal">kcal</th>
                <th className="py-1.5 pr-2 font-normal">B</th>
                <th className="py-1.5 pr-2 font-normal">T</th>
                <th className="py-1.5 pr-2 font-normal">W</th>
                <th className="py-1.5 pr-2 font-normal">Źródło</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <button className="text-left hover:text-olive-strong" onClick={() => setDetails(p)}>
                      {p.name}
                      {p.brand && <span className="text-muted"> · {p.brand}</span>}
                    </button>
                    <div className="text-[11px] text-muted">na 100 {p.basis}</div>
                  </td>
                  <td className="pr-2 tabular-nums">{fmt(p.kcal)}</td>
                  <td className="pr-2 tabular-nums">{fmt(p.protein, 1)}</td>
                  <td className="pr-2 tabular-nums">{fmt(p.fat, 1)}</td>
                  <td className="pr-2 tabular-nums">{fmt(p.carbs, 1)}</td>
                  <td className="max-w-48 truncate pr-2 text-xs text-muted" title={p.source}>
                    {p.source}
                  </td>
                  <td className="whitespace-nowrap">
                    {!p.id.startsWith("gen_") && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                          Edytuj
                        </Button>
                        <button className="ml-1 rounded-lg p-1.5 text-muted hover:text-bad" onClick={() => deleteProduct(p.id)} aria-label={`Usuń ${p.name}`}>
                          <IconTrash width={16} height={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="p-4 text-sm text-muted">{tab === "mine" ? "Nie masz jeszcze własnych produktów. Dodaj z etykiety, z kodu kreskowego lub z Open Food Facts." : "Brak wyników."}</p>}
        </div>
        <p className="mt-3 text-xs text-muted">
          Wartości generyczne to zaokrąglone dane referencyjne (USDA FoodData Central, tabele IŻŻ) — dla konkretnych produktów markowych korzystaj z etykiety. Aplikacja nie wymyśla danych: brakujące wartości trzeba uzupełnić ręcznie.
        </p>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Dodaj produkt">
        <ProductPicker onPick={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edytuj: ${editing?.name ?? ""}`}>
        {editing && <ProductForm initial={editing} onSaved={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name ?? ""}>
        {details && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Kategoria</dt>
            <dd>{CATEGORY_LABELS[details.category]}</dd>
            <dt className="text-muted">Energia</dt>
            <dd>
              {fmt(details.kcal)} kcal / 100 {details.basis}
            </dd>
            <dt className="text-muted">Białko / tłuszcz / węglowodany</dt>
            <dd>
              {fmt(details.protein, 1)} / {fmt(details.fat, 1)} / {fmt(details.carbs, 1)} g
            </dd>
            <dt className="text-muted">Błonnik</dt>
            <dd>{fmt(details.fiber, 1)} g</dd>
            {details.piece_g && (
              <>
                <dt className="text-muted">1 {details.piece_name ?? "szt."}</dt>
                <dd>{fmt(details.piece_g)} g</dd>
              </>
            )}
            {details.serving_g && (
              <>
                <dt className="text-muted">Porcja</dt>
                <dd>{fmt(details.serving_g)} g</dd>
              </>
            )}
            {details.barcode && (
              <>
                <dt className="text-muted">Kod kreskowy</dt>
                <dd>{details.barcode}</dd>
              </>
            )}
            <dt className="text-muted">Alergeny</dt>
            <dd className="flex flex-wrap gap-1">{details.allergens.length ? details.allergens.map((a) => <Badge key={a}>{ALLERGEN_LABELS[a]}</Badge>) : "brak zadeklarowanych"}</dd>
            <dt className="text-muted">Źródło danych</dt>
            <dd>
              {details.source}
              {details.source_ref?.startsWith("http") && (
                <>
                  {" "}
                  <a href={details.source_ref} target="_blank" rel="noreferrer noopener" className="text-olive-strong underline">
                    link
                  </a>
                </>
              )}
            </dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
