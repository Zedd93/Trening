"use client";

import { useMemo, useRef, useState } from "react";
import type { FoodProduct, FoodUnit } from "@/lib/domain/types";
import { searchProducts } from "@/lib/nutrition/foods";
import { availableUnits, macrosFor, toGrams, UNIT_LABELS, unitHint } from "@/lib/nutrition/units";
import { offByBarcode, offSearch, offToProduct, type OffProduct } from "@/lib/nutrition/openfoodfacts";
import { saveProduct } from "@/lib/actions/nutrition";
import { useProducts } from "@/lib/hooks";
import { Badge, Button, Input, Notice, NumberInput, Segmented, Select, cx } from "../ui";
import { fmt } from "@/lib/utils/format";
import { BarcodeScanner } from "./BarcodeScanner";
import { ProductForm } from "./ProductForm";

export function MacroLine({ kcal, p, f, c, className }: { kcal: number; p: number; f: number; c: number; className?: string }) {
  return (
    <span className={cx("tabular-nums", className)}>
      <strong>{fmt(kcal)}</strong> kcal · B {fmt(p, 1)} · T {fmt(f, 1)} · W {fmt(c, 1)}
    </span>
  );
}

/** Ilość + jednostka z podglądem przeliczenia. */
export function AmountEditor({ product, amount, unit, onChange }: { product: FoodProduct; amount: number | null; unit: FoodUnit; onChange: (a: number | null, u: FoodUnit) => void }) {
  const units = availableUnits(product);
  const grams = amount ? toGrams(product, amount, unit) : 0;
  const m = macrosFor(product, grams);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Ilość" value={amount} step={unit === "g" || unit === "ml" ? 5 : 0.5} onChange={(v) => onChange(v, unit)} />
        <Select label="Jednostka" value={unit} onChange={(e) => onChange(amount, e.target.value as FoodUnit)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u === "szt" && product.piece_name ? `szt. (${product.piece_name})` : UNIT_LABELS[u]}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-muted">
        {unitHint(product, unit) && <>{unitHint(product, unit)} · </>}
        Masa porcji: <strong className="text-fg">{fmt(grams, 1)} g</strong>
      </p>
      <div className="rounded-xl bg-surface-2 p-3 text-sm">
        <MacroLine kcal={m.kcal} p={m.protein_g} f={m.fat_g} c={m.carbs_g} />
        <div className="mt-1 text-xs text-muted">Źródło: {product.source}</div>
      </div>
    </div>
  );
}

export function ProductPicker({ onPick, initialQuery = "" }: { onPick: (p: FoodProduct) => void; initialQuery?: string }) {
  const products = useProducts();
  const [tab, setTab] = useState<"local" | "off" | "barcode" | "custom">("local");
  const [q, setQ] = useState(initialQuery);
  const list = useMemo(() => searchProducts(Object.values(products), q, 40), [products, q]);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        ariaLabel="Źródło produktów"
        value={tab}
        onChange={setTab}
        options={[
          { value: "local", label: "Baza" },
          { value: "off", label: "Open Food Facts" },
          { value: "barcode", label: "Kod kreskowy" },
          { value: "custom", label: "Z etykiety" },
        ]}
      />
      {tab === "local" && (
        <>
          <Input aria-label="Szukaj produktu" placeholder="np. ryż, skyr, kurczak…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(p)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {p.brand && `${p.brand} · `}na 100 {p.basis}: {fmt(p.kcal)} kcal · B {fmt(p.protein, 1)} · T {fmt(p.fat, 1)} · W {fmt(p.carbs, 1)}
                    </span>
                  </span>
                  {p.id.startsWith("recipe:") ? <Badge tone="olive">przepis</Badge> : !p.id.startsWith("gen_") ? <Badge>własny</Badge> : null}
                </button>
              </li>
            ))}
            {!list.length && <li className="p-3 text-sm text-muted">Brak wyników. Spróbuj Open Food Facts lub dodaj produkt z etykiety.</li>}
          </ul>
        </>
      )}
      {tab === "off" && <OffSearch onPick={onPick} initial={q} />}
      {tab === "barcode" && <BarcodeLookup onPick={onPick} />}
      {tab === "custom" && (
        <ProductForm
          onSaved={(p) => {
            onPick(p);
          }}
        />
      )}
    </div>
  );
}

function OffResult({ r, onPick }: { r: OffProduct; onPick: (p: FoodProduct) => void }) {
  const [completing, setCompleting] = useState(false);
  if (completing)
    return (
      <div className="rounded-xl border border-line p-3">
        <p className="mb-2 text-sm">Uzupełnij brakujące wartości z etykiety produktu „{r.name}”.</p>
        <ProductForm
          initial={{ name: r.name, brand: r.brand, barcode: r.barcode, kcal: r.kcal ?? undefined, protein: r.protein ?? undefined, fat: r.fat ?? undefined, carbs: r.carbs ?? undefined, fiber: r.fiber ?? undefined, serving_g: r.serving_g, allergens: r.allergens, source: "Open Food Facts (ODbL) + uzupełnienie z etykiety", source_ref: r.url }}
          onSaved={onPick}
        />
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
      <div className="min-w-0">
        <div className="truncate text-[15px]">{r.name}</div>
        <div className="text-xs text-muted">
          {r.brand && `${r.brand} · `}
          {r.complete ? `100 g: ${fmt(r.kcal ?? 0)} kcal · B ${fmt(r.protein ?? 0, 1)} · T ${fmt(r.fat ?? 0, 1)} · W ${fmt(r.carbs ?? 0, 1)}` : "niepełne dane odżywcze"} · EAN {r.barcode}
        </div>
      </div>
      {r.complete ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const saved = saveProduct(offToProduct(r));
            onPick(saved);
          }}
        >
          Wybierz
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setCompleting(true)}>
          Uzupełnij
        </Button>
      )}
    </div>
  );
}

function OffSearch({ onPick, initial }: { onPick: (p: FoodProduct) => void; initial: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<OffProduct[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  async function run() {
    if (q.trim().length < 2) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setBusy(true);
    setErr(null);
    try {
      setRes(await offSearch(q, ctrl.current.signal));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr("Nie udało się połączyć z Open Food Facts. Sprawdź połączenie lub dodaj produkt z etykiety.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input aria-label="Szukaj w Open Food Facts" placeholder="nazwa lub marka produktu" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "…" : "Szukaj"}
        </Button>
      </form>
      <p className="text-xs text-muted">Open Food Facts to otwarta, społecznościowa baza produktów (licencja ODbL). Dane mogą zawierać błędy — porównaj z etykietą. Zapytanie wysyła tylko wpisaną frazę.</p>
      {err && <Notice tone="warn">{err}</Notice>}
      <div className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
        {res?.map((r) => <OffResult key={r.barcode} r={r} onPick={onPick} />)}
        {res && !res.length && <p className="p-3 text-sm text-muted">Brak wyników.</p>}
      </div>
    </div>
  );
}

function BarcodeLookup({ onPick }: { onPick: (p: FoodProduct) => void }) {
  const products = useProducts();
  const [code, setCode] = useState("");
  const [res, setRes] = useState<OffProduct | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);

  async function lookup(c: string) {
    setErr(null);
    setRes(undefined);
    const local = Object.values(products).find((p) => p.barcode === c);
    if (local) return onPick(local);
    setBusy(true);
    try {
      setRes(await offByBarcode(c));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <Input aria-label="Kod kreskowy (EAN)" inputMode="numeric" placeholder="np. 5900820000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Button type="submit" variant="primary" disabled={busy || code.length < 8}>
          Sprawdź
        </Button>
      </form>
      <Button variant="outline" onClick={() => setScan((s) => !s)}>
        {scan ? "Zamknij aparat" : "Skanuj aparatem"}
      </Button>
      {scan && (
        <BarcodeScanner
          onDetected={(c) => {
            setScan(false);
            setCode(c);
            void lookup(c);
          }}
        />
      )}
      {err && <Notice tone="warn">{err}</Notice>}
      {res === null && (
        <Notice>
          Nie znaleziono produktu o tym kodzie. Dodaj go ręcznie z etykiety (zakładka „Z etykiety”) — kod zostanie zapamiętany.
          <div className="mt-3">
            <ProductForm initial={{ barcode: code }} onSaved={onPick} />
          </div>
        </Notice>
      )}
      {res && <OffResult r={res} onPick={onPick} />}
    </div>
  );
}
