import { useEffect, useSyncExternalStore } from "react";
import { createInitialState, recoverState, stateSchema, STORAGE_KEY } from "./model";
import type { DemoState } from "./model";

const initial = createInitialState();
type Snapshot = { data: DemoState; ready: boolean; warning: string };
const serverSnapshot: Snapshot = { data: initial, ready: false, warning: "" };
let snapshot = serverSnapshot;
let memoryOnly = false;
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}
function load() {
  if (memoryOnly && snapshot.ready) return;
  try {
    const r = recoverState(window.localStorage.getItem(STORAGE_KEY));
    r.state.notifications = r.state.notifications.filter((n) => Date.now() - n.created < 86400000);
    snapshot = {
      data: r.state,
      ready: true,
      warning: r.recovered
        ? "Dados locais inválidos ou versão incompatível: demonstração restaurada."
        : "",
    };
  } catch {
    snapshot = {
      data: createInitialState(),
      ready: true,
      warning: "Armazenamento indisponível: alterações somente nesta aba.",
    };
  }
  emit();
}
function storageChanged(event: StorageEvent) {
  if (
    event.storageArea !== window.localStorage ||
    (event.key !== STORAGE_KEY && event.key !== null)
  )
    return;
  memoryOnly = false;
  load();
}
export function updateDemo(updater: (s: DemoState) => DemoState): DemoState {
  if (typeof window === "undefined" || !snapshot.ready)
    throw Error("Demonstração ainda não está pronta.");
  let base = snapshot.data;
  try {
    const raw = memoryOnly ? null : window.localStorage.getItem(STORAGE_KEY);
    if (raw) base = recoverState(raw).state;
  } catch {
    /* memory fallback */
  }
  const next = stateSchema.parse({ ...updater(base), version: 2, revision: crypto.randomUUID() });
  const raw = JSON.stringify(next);
  if (raw.length > 2200000) throw Error("Limite local atingido. Remova imagens ou produtos.");
  let warning = "";
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    memoryOnly = true;
    warning = "Não foi possível salvar: alterações somente nesta aba.";
  }
  snapshot = { data: next, ready: true, warning };
  emit();
  return next;
}
export function resetDemo() {
  return updateDemo(() => ({ ...createInitialState(), generation: crypto.randomUUID() }));
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useDemoData() {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
  useEffect(() => {
    load();
    window.addEventListener("storage", storageChanged);
    const timer = window.setInterval(() => {
      const active = snapshot.data.notifications.filter((n) => Date.now() - n.created < 86400000);
      if (active.length !== snapshot.data.notifications.length) {
        snapshot = { ...snapshot, data: { ...snapshot.data, notifications: active } };
        emit();
      }
    }, 60000);
    return () => {
      window.removeEventListener("storage", storageChanged);
      window.clearInterval(timer);
    };
  }, []);
  return { ...current, update: updateDemo, reset: resetDemo };
}
