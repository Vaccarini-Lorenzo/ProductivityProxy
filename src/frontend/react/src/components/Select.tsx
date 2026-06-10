import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./ui";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/** Themed dropdown so the open list matches the app UI. */
export function Select({ value, options, onChange, ariaLabel, disabled, className, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = optionEls();
    const idx = options.findIndex((o) => o.value === value);
    items[idx >= 0 ? idx : 0]?.focus();
  }, [open]);

  function optionEls(): HTMLLIElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLLIElement>(".select-option") ?? []);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const items = optionEls();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLLIElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(current + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(current - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (current >= 0) choose(options[current].value);
    }
  }

  return (
    <div
      ref={rootRef}
      className={className ? `select ${className}` : "select"}
      data-open={open}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "select-value" : "select-value is-placeholder"}>{selected?.label ?? placeholder ?? ""}</span>
        <Icon name="chevron" className="select-caret" />
      </button>
      {open && (
        <ul ref={menuRef} className="select-menu" role="listbox" aria-label={ariaLabel} onKeyDown={onMenuKeyDown}>
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={`select-option${isSelected ? " is-selected" : ""}`}
                onClick={() => choose(o.value)}
              >
                <span className="select-option-label">{o.label}</span>
                {isSelected && <Icon name="check" className="select-option-check" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
