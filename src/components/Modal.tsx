import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
export function Modal({
  title,
  eyebrow = "Review before recording",
  children,
  busy,
  error,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  submitLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    (
      dialog.querySelector("input, select, textarea") as HTMLElement | null
    )?.focus();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const focusable = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="modal-top">
          <p className="eyebrow">{eyebrow}</p>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="dialog-title">{title}</h2>
        <div className="modal-body">{children}</div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </dialog>
  );
}
