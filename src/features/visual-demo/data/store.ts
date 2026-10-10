import { useEffect, useSyncExternalStore } from "react";
import {
  createInitialState,
  recoverState,
  stateSchema,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
} from "./model";
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
    const current = window.localStorage.getItem(STORAGE_KEY);
    const previous = current === null ? window.localStorage.getItem(PREVIOUS_STORAGE_KEY) : null;
    const r = recoverState(current ?? previous ?? window.localStorage.getItem(LEGACY_STORAGE_KEY));
    let migrationWarning = "";
    if (r.migrated) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r.state));
      } catch {
        memoryOnly = true;
        migrationWarning = " Migração mantida somente nesta aba: armazenamento indisponível.";
      }
    }
    r.state.notifications = r.state.notifications.filter((n) => Date.now() - n.created < 86400000);
    snapshot = {
      data: r.state,
      ready: true,
      warning: r.recovered
        ? "Dados locais inválidos ou versão incompatível: demonstração restaurada."
        : r.migrated
          ? `Dados demonstrativos ${previous ? "V2.1" : "V2"} importados; a cópia original foi preservada.` +
            migrationWarning
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
  if (!snapshot.warning) {
    snapshot = {
      ...snapshot,
      warning:
        "Atualização recebida de outra aba. Evite edições simultâneas: o armazenamento local não é transacional.",
    };
    emit();
  }
}
function mutateDemo(updater: (s: DemoState) => DemoState, restoring = false): DemoState {
  if (typeof window === "undefined" || !snapshot.ready)
    throw Error("Demonstração ainda não está pronta.");
  let base = snapshot.data;
  let raw: string | null = null;
  try {
    raw = memoryOnly ? null : window.localStorage.getItem(STORAGE_KEY);
  } catch {
    memoryOnly = true;
  }
  if (raw) {
    const recovered = recoverState(raw);
    if (
      !restoring &&
      (recovered.recovered || recovered.state.generation !== snapshot.data.generation)
    ) {
      load();
      throw Error(
        "Dados locais inválidos ou demonstração restaurada em outra aba. Revise antes de salvar.",
      );
    }
    base = recovered.state;
  }
  const next = stateSchema.parse({ ...updater(base), version: 4, revision: crypto.randomUUID() });
  const serialized = JSON.stringify(next);
  if (serialized.length > 2200000)
    throw Error("Limite local atingido. Remova imagens ou produtos.");
  let warning = "";
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    memoryOnly = true;
    warning = "Não foi possível salvar: alterações somente nesta aba.";
  }
  snapshot = { data: next, ready: true, warning };
  emit();
  return next;
}
export function updateDemo(updater: (s: DemoState) => DemoState): DemoState {
  return mutateDemo(updater);
}
export function resetDemo() {
  return mutateDemo(() => ({ ...createInitialState(), generation: crypto.randomUUID() }), true);
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
