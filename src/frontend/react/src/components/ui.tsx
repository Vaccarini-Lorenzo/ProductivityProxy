import type { ButtonHTMLAttributes, ReactNode } from "react";

export { Modal } from "./Modal";

type IconName = "edit" | "save";

function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      {name === "edit" ? (
        <>
          <path d="M4 15.5l3.6-.8 7.8-7.8a1.8 1.8 0 0 0-2.5-2.5L5.1 12.2 4 15.5z" />
          <path d="M11.7 5.6l2.7 2.7" />
        </>
      ) : (
        <>
          <path d="M4 3.5h9.2L16 6.3v10.2H4z" />
          <path d="M7 3.5v5h6v-5" />
          <path d="M7 16.5v-5h6v5" />
        </>
      )}
    </svg>
  );
}

/** Icon-only action button with accessible label and the same terminal styling. */
export function IconButton({ icon, label, className, title, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button {...props} type={type} className={className ? `icon-button ${className}` : "icon-button"} aria-label={label} title={title ?? label}>
      <Icon name={icon} />
    </button>
  );
}

/** Page header: small uppercase eyebrow, title, optional subtitle. Reused on every page. */
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="page-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </header>
  );
}

/** Standard card: optional title row with right-aligned actions, then a consistently spaced body. */
export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {(title || actions) && (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

/** Labelled form field. Hint is optional secondary text shown under the label. */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={className ? `field ${className}` : "field"}>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  );
}

/** Full-width settings row: label + description on the left, a checkbox control on the right. */
export function CheckRow({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={disabled ? "check-row disabled" : "check-row"}>
      <span className="check-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Compact inline checkbox, for toolbars. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** "1 step" / "3 steps". Pass an explicit plural for irregular words. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
