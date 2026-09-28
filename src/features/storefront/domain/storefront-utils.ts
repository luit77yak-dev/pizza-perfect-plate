import type { Product, ProductPrice, SpecialHour, StoreHour } from "@/lib/domain/types";

function normalizeNeighborhood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getPrice(product: Product, sizeId: string | null, prices: ProductPrice[]) {
  if (!sizeId) return Number(product.base_price) || 0;
  const row = prices.find((price) => price.product_id === product.id && price.size_id === sizeId);
  return row ? Number(row.price) : Number(product.base_price) || 0;
}

function getStoreStatus(hours: StoreHour[], specialHours: SpecialHour[], now = new Date()) {
  const dateKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const special = specialHours.find((item) => item.date === dateKey);
  const weekday = now.getDay();
  const today = special ?? hours.find((hour) => hour.weekday === weekday);
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (!today || today.closed || !today.opens_at || !today.closes_at) {
    return { open: false, label: special?.note ? `Fechada hoje · ${special.note}` : "Fechada hoje" };
  }

  const [openHour = 0, openMinute = 0] = today.opens_at.slice(0, 5).split(":").map(Number);
  const [closeHour = 0, closeMinute = 0] = today.closes_at.slice(0, 5).split(":").map(Number);
  const opening = openHour * 60 + openMinute;
  const closing = closeHour * 60 + closeMinute;
  const overnight = closing <= opening;
  const open = overnight ? minutes >= opening || minutes < closing : minutes >= opening && minutes < closing;

  if (open) return { open: true, label: `Aberta até ${today.closes_at.slice(0, 5)}` };
  if (minutes < opening) return { open: false, label: `Abre às ${today.opens_at.slice(0, 5)}` };
  return { open: false, label: "Fechada agora" };
}

