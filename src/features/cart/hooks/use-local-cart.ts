import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/lib/domain/types";

type CartSnapshot = { key: string | null; items: CartItem[] };

// Never reuse the old global "pizza-perfect-plate:cart" key: it cannot
// distinguish two storefronts sharing the same origin.
function readCart(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function useLocalCart(instanceId: string | undefined) {
  const key = instanceId ? `pizza-perfect-plate:cart:${instanceId}` : null;
  const [snapshot, setSnapshot] = useState<CartSnapshot>({ key: null, items: [] });

  useEffect(() => {
    setSnapshot({ key, items: key ? readCart(key) : [] });
  }, [key]);

  const items = snapshot.key === key ? snapshot.items : [];

  useEffect(() => {
    if (!key || snapshot.key !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(snapshot.items));
    } catch {
      // Browser storage may be disabled. The cart stays usable in memory.
    }
  }, [key, snapshot]);

  const addItem = useCallback(
    (item: CartItem) => {
      if (!key) return;
      setSnapshot((current) => ({
        key,
        items: [...(current.key === key ? current.items : []), item],
      }));
    },
    [key],
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (!key) return;
      setSnapshot((current) => ({
        key,
        items: (current.key === key ? current.items : [])
          .map((item) =>
            item.lineId === lineId
              ? { ...item, quantity: Math.max(0, quantity) }
              : item,
          )
          .filter((item) => item.quantity > 0),
      }));
    },
    [key],
  );

  const removeItem = useCallback(
    (lineId: string) => {
      if (!key) return;
      setSnapshot((current) => ({
        key,
        items: (current.key === key ? current.items : []).filter(
          (item) => item.lineId !== lineId,
        ),
      }));
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    setSnapshot({ key, items: [] });
  }, [key]);

  return { items, addItem, updateQuantity, removeItem, clear };
}
