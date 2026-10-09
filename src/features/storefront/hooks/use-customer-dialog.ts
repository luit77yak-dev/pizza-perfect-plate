import { useEffect, useRef } from "react";

/** Keyboard behavior for existing customer overlays; no portal/theme changes. */
export function useCustomerDialog(onClose: () => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!enabled || !dialog) return;
    const previous = document.activeElement;
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const topmost = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>("[data-customer-dialog]"));
      return (
        overlays
          .sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex))
          .at(-1) === dialog
      );
    };
    const frame = requestAnimationFrame(() => {
      if (topmost()) (controls()[0] ?? dialog).focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (!topmost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      } else if (event.key === "Tab") {
        const elements = controls();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (
          !dialog.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [enabled]);
  return ref;
}
