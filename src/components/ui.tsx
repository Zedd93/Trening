"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import Link from "next/link";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------ przyciski ------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-olive text-[#0e1207] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_24px_-12px_var(--olive)] hover:bg-olive-strong active:translate-y-px",
  secondary: "bg-surface-3 text-fg hover:bg-line-strong border border-line",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  outline: "border border-line-strong text-fg hover:border-olive hover:text-olive-strong",
  danger: "bg-bad/90 text-white hover:bg-bad",
};
const SIZE = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-14 px-6 text-base rounded-xl font-display uppercase tracking-wider text-lg",
} as const;

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
      className={cx("inline-flex select-none items-center justify-center gap-2 transition-all disabled:pointer-events-none disabled:opacity-40", SIZE[size], VARIANT[variant], className)}
    />
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx("inline-flex select-none items-center justify-center gap-2 transition-all", SIZE[size], VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

/* -------------------------------- karty -------------------------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

export function Card({
  title,
  action,
  children,
  className,
  subtitle,
  eyebrow,
  accent,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: string;
  accent?: boolean;
}) {
  return (
    <section className={cx("hud rounded-2xl p-4 sm:p-5", accent && "hud-accent", className)}>
      {(title || action || eyebrow) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
            {title && <h2 className="font-display text-xl font-bold uppercase leading-none tracking-wide">{title}</h2>}
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5 text-olive-strong">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-wide sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Odczyt instrumentu: etykieta mono + duża wartość. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="hud rounded-xl p-3">
      <div className="eyebrow">{label}</div>
      <div className={cx("font-data mt-1.5 text-2xl font-semibold leading-none", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "olive" | "ok" | "warn" | "bad" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "border-line bg-surface-2 text-muted",
        tone === "olive" && "border-olive/40 bg-olive-dim text-olive-strong",
        tone === "ok" && "border-ok/40 bg-ok/10 text-ok",
        tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
        tone === "bad" && "border-bad/40 bg-bad/10 text-bad",
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
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted">{label}</span>
          <span className="font-data text-[13px]">{showValues}</span>
        </div>
      )}
      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-surface-3" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-label={label}>
        <div className={cx("bar-fill h-full", color)} style={{ width: `${pct}%` }} />
        {/* podziałka co 25% */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_calc(25%-1px),var(--bg)_calc(25%-1px)_25%,transparent_25%_calc(50%-1px),var(--bg)_calc(50%-1px)_50%,transparent_50%_calc(75%-1px),var(--bg)_calc(75%-1px)_75%,transparent_75%)]" />
      </div>
    </div>
  );
}

/** Tarcza wskaźnika (np. kalorie, białko). */
export function Gauge({ value, max, label, unit, size = 132, sublabel }: { value: number; max: number; label: string; unit: string; size?: number; sublabel?: ReactNode }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.05;
  const color = over ? "var(--warning)" : pct >= 0.95 ? "var(--success)" : "var(--olive)";
  return (
    <div className="flex flex-col items-center" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size} className="absolute inset-0 rotate-[135deg]" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
          <circle
            className="dial-arc"
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${c * arc} ${c}`}
            strokeDashoffset={c * arc * (1 - pct)}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-data text-[26px] font-semibold leading-none">{Math.round(value).toLocaleString("pl-PL")}</span>
          <span className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            / {Math.round(max).toLocaleString("pl-PL")} {unit}
          </span>
        </div>
      </div>
      <div className="-mt-3 text-center">
        <div className="eyebrow">{label}</div>
        {sublabel && <div className="mt-0.5 text-xs text-muted">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ------------------------------- formularze ---------------------------- */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-fg/90">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs leading-snug text-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "h-11 w-full min-w-0 rounded-xl border border-line bg-bg/60 px-3 text-[15px] text-fg placeholder:text-muted/60 outline-none transition-colors focus:border-olive focus:bg-surface-2";

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
        className={cx(inputCls, "font-data", suffix && "pr-14")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs uppercase text-muted">{suffix}</span>}
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
    <select
      id={id}
      {...p}
      className={cx(
        inputCls,
        "appearance-none bg-[length:12px] bg-[right_0.8rem_center] bg-no-repeat pr-9 [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%239aa294' stroke-width='1.6'/%3E%3C/svg%3E\")]",
        className,
      )}
    >
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
  const el = <textarea id={id} {...p} className={cx("min-h-24 w-full rounded-xl border border-line bg-bg/60 p-3 text-[15px] outline-none focus:border-olive", className)} />;
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
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-md border border-line-strong bg-surface-3 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-[4px] after:bg-fg/80 after:transition-transform peer-checked:border-olive peer-checked:bg-olive peer-checked:after:translate-x-5 peer-checked:after:bg-[#0e1207] peer-focus-visible:outline-2 peer-focus-visible:outline-olive-strong"
      />
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
            className={cx(
              "min-h-10 rounded-lg border px-3.5 text-sm transition-all",
              active ? "border-olive bg-olive-dim font-semibold text-olive-strong shadow-[0_0_0_3px_var(--olive-glow)]" : "border-line bg-surface-2 text-fg hover:border-line-strong",
            )}
          >
            {active && <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-olive-strong" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-xl border border-line bg-bg/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 rounded-lg px-3.5 font-mono text-[12px] font-semibold uppercase tracking-wider transition-colors",
            value === o.value ? "bg-olive text-[#0e1207]" : "text-muted hover:text-fg",
          )}
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
      className={cx("hud m-auto w-[calc(100%-1.5rem)] rounded-2xl bg-surface p-0 text-fg", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
            <h2 className="font-display text-2xl font-bold uppercase leading-none tracking-wide">{title}</h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:text-fg" aria-label="Zamknij">
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
        "relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 text-sm before:absolute before:inset-y-0 before:left-0 before:w-1",
        tone === "info" && "border-line bg-surface/80 before:bg-olive",
        tone === "warn" && "border-warn/30 bg-warn/[0.07] before:bg-warn",
        tone === "ok" && "border-ok/30 bg-ok/[0.07] before:bg-ok",
        tone === "bad" && "border-bad/30 bg-bad/[0.07] before:bg-bad",
      )}
    >
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="leading-relaxed text-fg/85">{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface/40 p-8 text-center">
      <div aria-hidden className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-dashed border-olive/60" />
      <p className="font-display text-xl font-bold uppercase tracking-wide">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Szybka zmiana wartości przyciskami −/+ (duże cele dotykowe). */
export function Stepper({ value, onChange, step, min = 0, ariaLabel, suffix, decimals = 0 }: { value: number | null; onChange: (v: number | null) => void; step: number; min?: number; ariaLabel: string; suffix?: string; decimals?: number }) {
  const v = value ?? 0;
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  return (
    <div className="flex h-12 min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-bg/60 focus-within:border-olive">
      <button type="button" className="w-9 shrink-0 text-lg text-muted hover:bg-surface-3 hover:text-fg active:bg-line" onClick={() => onChange(Math.max(min, round(v - step)))} aria-label={`${ariaLabel}: zmniejsz o ${step}`}>
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
        className="font-data w-0 min-w-[2.5rem] flex-1 bg-transparent text-center text-[17px] font-semibold outline-none placeholder:text-muted/50"
      />
      {suffix && <span className="self-center pr-1 font-mono text-[10px] uppercase text-muted">{suffix}</span>}
      <button type="button" className="w-9 shrink-0 text-lg text-muted hover:bg-surface-3 hover:text-fg active:bg-line" onClick={() => onChange(round(v + step))} aria-label={`${ariaLabel}: zwiększ o ${step}`}>
        +
      </button>
    </div>
  );
}
