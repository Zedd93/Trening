"use client";

import { useMemo, useState } from "react";
import { useData, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { Button, Card, Empty, Input, Notice, NumberInput, PageHeader, Select, cx } from "@/components/ui";
import { IconTrash } from "@/components/icons";
import { addShoppingItem, createShoppingList, deleteShoppingItem, deleteShoppingList, updateShoppingItem } from "@/lib/actions/nutrition";
import { formatQuantity, shoppingListText } from "@/lib/nutrition/shopping";
import { addDays, formatDateFull } from "@/lib/utils/dates";
import { downloadText, toCSV } from "@/lib/utils/csv";

export default function ShoppingPage() {
  const data = useData();
  const todayDate = useToday();
  const lists = useMemo(() => Object.values(data.shopping_lists).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.shopping_lists]);
  const [listId, setListId] = useState<string | null>(null);
  const current = lists.find((l) => l.id === listId) ?? lists[0];
  const items = useMemo(() => Object.values(data.shopping_list_items).filter((i) => i.list_id === current?.id), [data.shopping_list_items, current]);
  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(addDays(todayDate, 6));
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number | null>(1);
  const [unit, setUnit] = useState("szt.");
  const [msg, setMsg] = useState<string | null>(null);
  const hasPlan = Object.values(data.meal_plan_entries).some((e) => e.date >= from && e.date <= to);

  const groups = useMemo(() => {
    const g = new Map<string, typeof items>();
    for (const i of items.filter((x) => !x.in_pantry)) g.set(i.category, [...(g.get(i.category) ?? []), i]);
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"));
  }, [items]);
  const pantry = items.filter((i) => i.in_pantry);
  const done = items.filter((i) => i.checked && !i.in_pantry).length;
  const toBuy = items.filter((i) => !i.in_pantry).length;

  async function share() {
    if (!current) return;
    const text = shoppingListText(current.name, items);
    try {
      if (navigator.share) {
        await navigator.share({ title: current.name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg("Skopiowano listę do schowka.");
    } catch {
      setMsg("Nie udało się udostępnić — użyj eksportu do pliku.");
    }
  }

  return (
    <>
      <PageHeader title="Lista zakupów" subtitle="Tworzona automatycznie z jadłospisu — te same składniki są sumowane" />
      <DietNav />

      <Card title="Nowa lista z jadłospisu">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Od" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <Input label="Do" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          <Button
            variant="primary"
            disabled={!hasPlan}
            onClick={() => {
              const l = createShoppingList(from, to);
              setListId(l.id);
              setMsg(null);
            }}
          >
            Utwórz listę
          </Button>
        </div>
        {!hasPlan && <p className="mt-2 text-sm text-muted">W wybranym zakresie nie ma jadłospisu — najpierw go wygeneruj.</p>}
      </Card>

      {lists.length > 1 && (
        <div className="mt-4">
          <Select aria-label="Wybierz listę" value={current?.id} onChange={(e) => setListId(e.target.value)} className="w-auto">
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!current ? (
        <div className="mt-4">
          <Empty title="Brak list zakupów">Utwórz listę z jadłospisu tygodniowego.</Empty>
        </div>
      ) : (
        <Card
          className="mt-4"
          title={current.name}
          subtitle={`${formatDateFull(current.date_from)} – ${formatDateFull(current.date_to)} · kupione ${done}/${toBuy}`}
          action={
            <Button size="sm" variant="ghost" onClick={() => deleteShoppingList(current.id)} aria-label="Usuń listę">
              <IconTrash width={16} height={16} />
            </Button>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={share}>
              Udostępnij / kopiuj
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadText(`lista-zakupow-${current.date_from}.txt`, shoppingListText(current.name, items))}>
              Eksport TXT
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadText(
                  `lista-zakupow-${current.date_from}.csv`,
                  toCSV(items.map((i) => ({ kategoria: i.category, produkt: i.name, ilosc: i.quantity, jednostka: i.unit, kupione: i.checked ? "tak" : "nie", w_domu: i.in_pantry ? "tak" : "nie" }))),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Eksport CSV
            </Button>
          </div>
          {msg && <Notice tone="ok">{msg}</Notice>}

          {groups.map(([cat, list]) => (
            <div key={cat} className="mb-4">
              <h3 className="mb-1 text-sm font-semibold text-olive-strong">{cat}</h3>
              <ul className="flex flex-col divide-y divide-line">
                {list.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2">
                    <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={i.checked} onChange={(e) => updateShoppingItem(i.id, { checked: e.target.checked })} aria-label={`Kupione: ${i.name}`} />
                    <span className={cx("min-w-0 flex-1", i.checked && "text-muted line-through")}>{i.name}</span>
                    <span className="text-sm tabular-nums text-muted">{formatQuantity(i.quantity, i.unit)}</span>
                    <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2" onClick={() => updateShoppingItem(i.id, { in_pantry: true })}>
                      Mam w domu
                    </button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-bad" onClick={() => deleteShoppingItem(i.id)} aria-label={`Usuń: ${i.name}`}>
                      <IconTrash width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <form
            className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              addShoppingItem(current.id, name.trim(), qty ?? 1, unit);
              setName("");
            }}
          >
            <Input label="Dodaj pozycję" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. przyprawy, płyn do naczyń" className="min-w-48" />
            <NumberInput ariaLabel="Ilość" value={qty} onChange={setQty} className="w-24" />
            <Select aria-label="Jednostka" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-24">
              {["szt.", "g", "kg", "ml", "l", "op."].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Dodaj
            </Button>
          </form>

          {pantry.length > 0 && (
            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <h3 className="mb-1 text-sm font-semibold">Już w domu (pominięte w zakupach)</h3>
              <ul className="flex flex-wrap gap-1.5 text-sm">
                {pantry.map((i) => (
                  <li key={i.id}>
                    <button className="rounded-full bg-surface px-2.5 py-1 text-muted hover:text-fg" onClick={() => updateShoppingItem(i.id, { in_pantry: false })}>
                      {i.name} ↩
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
