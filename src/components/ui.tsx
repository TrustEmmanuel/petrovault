import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const fieldClass =
  "h-8 w-full rounded-sm border border-zinc-300 bg-white px-2 text-xs text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export const areaClass =
  "min-h-[4.5rem] w-full resize-y rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

type Tone = "good" | "warn" | "bad" | "info" | "neutral";

const badgeTone: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  warn: "bg-amber-50 text-amber-950 ring-amber-600/20",
  bad: "bg-red-50 text-red-800 ring-red-600/15",
  info: "bg-sky-50 text-sky-900 ring-sky-600/15",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
};

const dotTone: Record<Tone, string> = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  info: "bg-sky-600",
  neutral: "bg-zinc-400",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        badgeTone[tone],
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dotTone[tone])} aria-hidden />
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

const buttonVariant = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  ghost: "text-zinc-700 hover:bg-zinc-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center rounded-sm text-xs font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
        size === "sm" ? "h-7 px-2" : "h-8 px-3",
        buttonVariant[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        {label}
      </label>
      <FieldScope id={id} invalid={Boolean(error)}>
        {children}
      </FieldScope>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldScope({
  id,
  invalid,
  children,
}: {
  id: string;
  invalid: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const control = ref.current?.querySelector("input, select, textarea");
    if (!(control instanceof HTMLElement)) return;
    control.id = id;
    control.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (invalid) control.setAttribute("aria-describedby", `${id}-error`);
    else control.removeAttribute("aria-describedby");
  }, [id, invalid]);
  return <div ref={ref}>{children}</div>;
}

export function Modal({
  title,
  lede,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  lede?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable =
      panelRef.current?.querySelector<HTMLElement>("input, select, textarea") ??
      panelRef.current?.querySelector<HTMLElement>("button");
    focusable?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previous.current?.focus();
    };
  }, []);

  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/40 p-3 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "panel relative max-h-[88vh] w-full overflow-y-auto border border-zinc-200 bg-white shadow-xl",
          wide ? "max-w-xl" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
            {lede ? <p className="mt-0.5 text-xs leading-5 text-zinc-500">{lede}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-900">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; tone: "good" | "bad" | "info" }[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="pointer-events-auto border border-zinc-200 bg-white px-3 py-2 text-left text-xs leading-5 text-zinc-800 shadow-md"
        >
          <span
            className={cx(
              "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
              toast.tone === "good" && "bg-emerald-600",
              toast.tone === "bad" && "bg-red-600",
              toast.tone === "info" && "bg-zinc-400",
            )}
            aria-hidden
          />
          {toast.message}
        </button>
      ))}
    </div>
  );
}
