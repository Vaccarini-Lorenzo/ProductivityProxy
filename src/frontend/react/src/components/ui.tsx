import type { ButtonHTMLAttributes, ReactNode } from "react";

export { Modal } from "./Modal";

export type IconName =
  | "edit" | "save" | "play" | "stop" | "trash" | "plus" | "refresh"
  | "branch" | "switch" | "hexagon"
  | "gear" | "layers" | "shield"
  | "info" | "terminal" | "link" | "lock" | "eye" | "eyeOff" | "search" | "inbox";

const ICON_PATHS: Record<IconName, ReactNode> = {
  edit: <><path d="M4 15.5l3.6-.8 7.8-7.8a1.8 1.8 0 0 0-2.5-2.5L5.1 12.2 4 15.5z" /><path d="M11.7 5.6l2.7 2.7" /></>,
  save: <><path d="M4 3.5h9.2L16 6.3v10.2H4z" /><path d="M7 3.5v5h6v-5" /><path d="M7 16.5v-5h6v5" /></>,
  play: <path d="M7 4.8l9.2 5.2-9.2 5.2z" />,
  stop: <path d="M6.3 6.3h7.4v7.4h-7.4z" />,
  trash: <><path d="M3.8 6h12.4" /><path d="M6 6l.7 9.6a1.3 1.3 0 0 0 1.3 1.2h4a1.3 1.3 0 0 0 1.3-1.2L14 6" /><path d="M8 6V4.4a1.2 1.2 0 0 1 1.2-1.2h1.6A1.2 1.2 0 0 1 12 4.4V6" /></>,
  plus: <path d="M10 4.4v11.2M4.4 10h11.2" />,
  refresh: <><path d="M15.6 10a5.6 5.6 0 1 1-1.7-4" /><path d="M14.2 3.4V7h-3.6" /></>,
  branch: <><circle cx="5" cy="10" r="1.9" /><circle cx="15" cy="5.4" r="1.9" /><circle cx="15" cy="14.6" r="1.9" /><path d="M6.7 9.1l6.4-2.8" /><path d="M6.7 10.9l6.4 2.8" /></>,
  switch: <><path d="M5.9 10H10M10 10L14 5.4M10 10H14M10 10L14 14.6" /><circle cx="4.4" cy="10" r="1.5" /><circle cx="15.6" cy="4.8" r="1.5" /><circle cx="15.6" cy="10" r="1.5" /><circle cx="15.6" cy="15.2" r="1.5" /></>,
  hexagon: <path d="M10 2.8l6.2 3.6v7.2L10 17.2 3.8 13.6V6.4z" />,
  gear: <><path d="M8.2 4.4 L8.4 2.3 L11.6 2.3 L11.8 4.4 L12.7 4.8 L14.3 3.4 L16.6 5.7 L15.2 7.3 L15.6 8.2 L17.7 8.4 L17.7 11.6 L15.6 11.8 L15.2 12.7 L16.6 14.3 L14.3 16.6 L12.7 15.2 L11.8 15.6 L11.6 17.7 L8.4 17.7 L8.2 15.6 L7.3 15.2 L5.7 16.6 L3.4 14.3 L4.8 12.7 L4.4 11.8 L2.3 11.6 L2.3 8.4 L4.4 8.2 L4.8 7.3 L3.4 5.7 L5.7 3.4 L7.3 4.8 Z" /><circle cx="10" cy="10" r="2.6" /></>,
  layers: <><path d="M10 2.8l7.2 3.6-7.2 3.6-7.2-3.6z" /><path d="M2.8 10l7.2 3.6 7.2-3.6" /><path d="M2.8 13.4l7.2 3.6 7.2-3.6" /></>,
  shield: <path d="M10 2.6l6 2.1v4.4c0 3.7-2.5 6.6-6 7.9-3.5-1.3-6-4.2-6-7.9V4.7z" />,
  info: <><circle cx="10" cy="10" r="7.3" /><path d="M10 13.6V9.4" /><path d="M10 6.7h.01" /></>,
  terminal: <><path d="M4.6 6.4l3.1 3.6-3.1 3.6" /><path d="M10.2 13.6h5.2" /></>,
  link: <><path d="M8.3 11.7a3 3 0 0 1 0-4.2l1.9-1.9a3 3 0 0 1 4.2 4.2l-1 1" /><path d="M11.7 8.3a3 3 0 0 1 0 4.2l-1.9 1.9a3 3 0 0 1-4.2-4.2l1-1" /></>,
  lock: <><rect x="4.6" y="8.9" width="10.8" height="7.3" rx="1.4" /><path d="M6.9 8.9V6.7a3.1 3.1 0 0 1 6.2 0v2.2" /></>,
  eye: <><path d="M2.4 10S5.4 4.7 10 4.7 17.6 10 17.6 10 14.6 15.3 10 15.3 2.4 10 2.4 10z" /><circle cx="10" cy="10" r="2.5" /></>,
  eyeOff: <><path d="M8.3 5.1A6.8 6.8 0 0 1 10 4.7c4.6 0 7.6 5.3 7.6 5.3a13.4 13.4 0 0 1-2.3 2.8M5.2 6.1A13.4 13.4 0 0 0 2.4 10S5.4 15.3 10 15.3a6.8 6.8 0 0 0 3-.7" /><path d="M8.3 8.3a2.5 2.5 0 0 0 3.5 3.5" /><path d="M3 3l14 14" /></>,
  search: <><circle cx="8.5" cy="8.5" r="4.9" /><path d="M12.1 12.1l3.9 3.9" /></>,
  inbox: <><path d="M3.2 10.6l2.3-5.3a1.4 1.4 0 0 1 1.3-.8h6.4a1.4 1.4 0 0 1 1.3.8l2.3 5.3v4.1a1.3 1.3 0 0 1-1.3 1.3H4.5a1.3 1.3 0 0 1-1.3-1.3z" /><path d="M3.2 10.6h3.6l1 2h4.4l1-2h3.6" /></>,
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

/** Standard card: optional icon + title row with right-aligned actions, then a consistently spaced body. */
export function Card({ title, icon, actions, children, className }: { title?: string; icon?: IconName; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {(title || actions) && (
        <div className="card-head">
          {title ? (
            <div className="card-title">
              {icon && <span className="card-icon"><Icon name={icon} /></span>}
              <h2>{title}</h2>
            </div>
          ) : <span />}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

/** Search field with a leading magnifying-glass icon. Reused by the node library and the Nodes page. */
export function SearchInput({ value, onChange, placeholder = "Search\u2026", ariaLabel, className }: { value: string; onChange: (value: string) => void; placeholder?: string; ariaLabel?: string; className?: string }) {
  return (
    <div className={className ? `search-input ${className}` : "search-input"}>
      <Icon name="search" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel ?? placeholder} />
    </div>
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

/** Labelled non-label field for complex controls that contain buttons/editors. */
export function FieldGroup({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `field ${className}` : "field"}>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </div>
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
      <input type="checkbox" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Compact inline checkbox, for toolbars. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** "1 step" / "3 steps". Pass an explicit plural for irregular words. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
