"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import Link from "next/link";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------ przyciski ------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const VARIANT: Record<Variant, string> = {
  primary: "bg-olive text-[#10130b] hover:bg-olive-strong font-semibold",
  secondary: "bg-surface-3 text-fg hover:bg-line",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  outline: "border border-line text-fg hover:bg-surface-2",
  danger: "bg-bad/90 text-white hover:bg-bad",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-6 text-base",
        VARIANT[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl transition-colors select-none",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-6 text-base",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* -------------------------------- karty -------------------------------- */

export function Card({ title, action, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface p-4 sm:p-5 fade-in", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "olive" | "ok" | "warn" | "bad" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-3 text-muted",
        tone === "olive" && "bg-olive-dim text-olive-strong",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "bad" && "bg-bad/15 text-bad",
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ value, max, label, tone, showValues }: { value: number; max: number; label?: string; tone?: "olive" | "ok" | "warn"; showValues?: ReactNode }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  const color = over ? "bg-warn" : tone === "ok" || pct >= 95 ? "bg-ok" : "bg-olive";
  return (
    <div>
      {(label || showValues) && (
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">{label}</span>
          <span className="tabular-nums">{showValues}</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-label={label}>
        <div className={cx("bar-fill h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------- formularze ---------------------------- */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px] text-fg placeholder:text-muted/70 focus:border-olive outline-none";

export function Input({ label, hint, error, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  const el = <input id={id} {...p} className={cx(inputCls, className)} />;
  return label ? (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
  suffix,
  className,
  ariaLabel,
  placeholder,
}: {
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const id = useId();
  const el = (
    <div className={cx("relative", className)}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        aria-label={ariaLabel ?? label}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={cx(inputCls, suffix && "pr-12")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
    </div>
  );
  return label ? (
    <Field label={label} hint={hint} htmlFor={id}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function Select({ label, hint, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode }) {
  const id = useId();
  const el = (
    <select id={id} {...p} className={cx(inputCls, "appearance-none pr-8", className)}>
      {children}
    </select>
  );
  return label ? (
    <Field label={label} hint={hint} htmlFor={id}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function Textarea({ label, className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const id = useId();
  const el = <textarea id={id} {...p} className={cx("min-h-24 w-full rounded-xl border border-line bg-surface-2 p-3 text-[15px] outline-none focus:border-olive", className)} />;
  return label ? (
    <Field label={label} htmlFor={id}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-[15px]">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors peer-checked:bg-olive peer-focus-visible:outline-2 peer-focus-visible:outline-olive-strong after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Chips<T extends string>({ options, value, onChange, multiple, ariaLabel }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; multiple?: boolean; ariaLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(multiple ? (active ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cx("min-h-10 rounded-full border px-3.5 text-sm transition-colors", active ? "border-olive bg-olive-dim text-olive-strong" : "border-line bg-surface-2 text-fg hover:border-muted")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("h-9 rounded-lg px-3 text-sm transition-colors", value === o.value ? "bg-surface-3 font-semibold text-fg" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- modal ------------------------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cx("m-auto w-[calc(100%-1.5rem)] rounded-2xl border border-line bg-surface p-0 text-fg", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Zamknij">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "ok" | "bad"; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === "bad" || tone === "warn" ? "alert" : "status"}
      className={cx(
        "rounded-xl border p-3 text-sm",
        tone === "info" && "border-line bg-surface-2",
        tone === "warn" && "border-warn/40 bg-warn/10",
        tone === "ok" && "border-ok/40 bg-ok/10",
        tone === "bad" && "border-bad/40 bg-bad/10",
      )}
    >
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="text-fg/90">{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Szybka zmiana wartości przyciskami −/+ (duże cele dotykowe). */
export function Stepper({ value, onChange, step, min = 0, ariaLabel, suffix, decimals = 0 }: { value: number | null; onChange: (v: number | null) => void; step: number; min?: number; ariaLabel: string; suffix?: string; decimals?: number }) {
  const v = value ?? 0;
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface-2">
      <button type="button" className="w-10 shrink-0 text-lg text-muted hover:bg-surface-3 active:bg-line" onClick={() => onChange(Math.max(min, round(v - step)))} aria-label={`${ariaLabel}: zmniejsz o ${step}`}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="h-11 w-full min-w-0 bg-transparent text-center text-[15px] tabular-nums outline-none"
      />
      {suffix && <span className="self-center pr-1 text-xs text-muted">{suffix}</span>}
      <button type="button" className="w-10 shrink-0 text-lg text-muted hover:bg-surface-3 active:bg-line" onClick={() => onChange(round(v + step))} aria-label={`${ariaLabel}: zwiększ o ${step}`}>
        +
      </button>
    </div>
  );
}
