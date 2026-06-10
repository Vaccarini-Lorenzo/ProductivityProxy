import { useEffect, type ReactNode } from "react";
import "./Modal.css";

interface Props {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}

/** Centered modal dialog. Closes on Escape, backdrop click, or the close button. */
export function Modal({ title, subtitle, onClose, children, footer, wide, actions }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-titles">
            <h2>{title}</h2>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <div className="modal-head-right">
            {actions && <div className="modal-head-actions">{actions}</div>}
            <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
