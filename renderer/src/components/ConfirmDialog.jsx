/**
 * ConfirmDialog.jsx
 * Modal de confirmación reutilizable.
 *
 * <ConfirmDialog
 *   open={bool}
 *   title="¿Eliminar cuenta?"
 *   message="Esta acción no se puede deshacer."
 *   confirmLabel="Eliminar"
 *   danger         // botón rojo
 *   onConfirm={fn}
 *   onCancel={fn}
 * />
 */
export function ConfirmDialog({
  open,
  title = "¿Confirmar acción?",
  message,
  confirmLabel = "Confirmar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={loading ? undefined : onCancel}>
      <div
        className="modalCard"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button
            className="modalClose"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {message && (
          <p style={{ margin: "4px 0 20px", fontSize: 14, opacity: 0.75, lineHeight: 1.5 }}>
            {message}
          </p>
        )}

        <div className="modalActions">
          <button
            className="btn"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className={`btn ${danger ? "danger" : "primary"}`}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
