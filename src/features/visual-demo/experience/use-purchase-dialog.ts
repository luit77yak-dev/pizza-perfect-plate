import { useEffect } from "react";
import { useCustomerDialog } from "@/features/storefront/hooks/use-customer-dialog";

export function usePurchaseDialog(onClose: () => void) {
  const ref = useCustomerDialog(onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return ref;
}
