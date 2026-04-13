import { useState, useMemo } from "react";

const dropStyle = { maxHeight: 220, overflowY: "auto" };

/**
 * ComboSelect — reemplaza <select> con el mismo estilo visual que los combos
 * de búsqueda (Armazón, Paciente, etc.).
 *
 * Props:
 *   options   — array de { value, label }
 *   value     — valor seleccionado actualmente
 *   onChange  — fn(value) con el nuevo valor
 *   placeholder — texto cuando no hay selección
 *   className — clase extra para el <input>
 */
export default function ComboSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  className = "",
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 120);
  }

  function handleSelect(opt) {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  }

  const displayValue = open ? query : (selected?.label ?? "");

  return (
    <div style={{ position: "relative" }}>
      <input
        className={className}
        value={displayValue}
        placeholder={placeholder}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{ cursor: open ? "text" : "pointer" }}
        autoComplete="off"
      />
      {open && (
        <div className="comboDropdown" style={dropStyle}>
          {filtered.length === 0 ? (
            <div className="comboEmpty">Sin resultados</div>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className="comboItem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                style={
                  String(opt.value) === String(value)
                    ? { background: "var(--green-soft)", fontWeight: 700 }
                    : {}
                }
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
