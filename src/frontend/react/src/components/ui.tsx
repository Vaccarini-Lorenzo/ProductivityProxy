import type { ButtonHTMLAttributes, ReactNode } from "react";

export { Modal } from "./Modal";

export type IconName = "edit" | "save" | "play" | "stop" | "trash" | "plus" | "refresh" | "flow" | "branch" | "node";

const ICON_PATHS: Record<IconName, ReactNode> = {
  edit: <><path d="M4 15.5l3.6-.8 7.8-7.8a1.8 1.8 0 0 0-2.5-2.5L5.1 12.2 4 15.5z" /><path d="M11.7 5.6l2.7 2.7" /></>,
  save: <><path d="M4 3.5h9.2L16 6.3v10.2H4z" /><path d="M7 3.5v5h6v-5" /><path d="M7 16.5v-5h6v5" /></>,
  play: <path d="M7 4.8l9.2 5.2-9.2 5.2z" />,
  stop: <path d="M6.3 6.3h7.4v7.4h-7.4z" />,
  trash: <><path d="M3.8 6h12.4" /><path d="M6 6l.7 9.6a1.3 1.3 0 0 0 1.3 1.2h4a1.3 1.3 0 0 0 1.3-1.2L14 6" /><path d="M8 6V4.4a1.2 1.2 0 0 1 1.2-1.2h1.6A1.2 1.2 0 0 1 12 4.4V6" /></>,
  plus: <path d="M10 4.4v11.2M4.4 10h11.2" />,
  refresh: <><path d="M15.6 10a5.6 5.6 0 1 1-1.7-4" /><path d="M14.2 3.4V7h-3.6" /></>,
  flow: <><path d="M5.6 3.4v13.2" /><path d="M5.6 4.4h8.5l-2.3 2.9 2.3 2.9H5.6z" /></>,
  branch: <><circle cx="5" cy="10" r="1.9" /><circle cx="15" cy="5.4" r="1.9" /><circle cx="15" cy="14.6" r="1.9" /><path d="M6.7 9.1l6.4-2.8" /><path d="M6.7 10.9l6.4 2.8" /></>,
  node: <><path d="M7.7 6.3L4.1 10l3.6 3.7" /><path d="M12.3 6.3L15.9 10l-3.6 3.7" /><path d="M11 5.4l-2 9.2" /></>,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      {ICON_PATHS[name]}
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

/** Standard text button with an optional leading icon. Variant/size come from className (e.g. "primary hero"). */
export function Button({ icon, children, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return (
    <button {...props} type={type} className={className}>
      {icon && <Icon name={icon} />}
      {children}
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
