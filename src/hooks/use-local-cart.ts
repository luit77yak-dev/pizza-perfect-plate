import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/lib/domain/types";

const STORAGE_KEY = "pizza-perfect-plate:cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function useLocalCart() {
  const [items, setItems] = useState<CartItem[]>(readCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => [...current, item]);
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((current) =>
      current
        .map((item) => (item.lineId === lineId ? { ...item, quantity: Math.max(0, quantity) } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((item) => item.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, addItem, updateQuantity, removeItem, clear };
}
