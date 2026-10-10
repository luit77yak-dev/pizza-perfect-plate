import { useEffect, useRef, useState } from "react";
import type { DemoOrder } from "../data/model";
export const AUDIO_PREFERENCE_KEY = "neroxa:visual-demo:audio:v1";
/** Audio is browser-local and opt-in; never asks for push or real permissions. */
export function useDemoAudio(orders: DemoOrder[], generation: string, ready: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("Som desligado. Ative e teste neste navegador.");
  const enabledRef = useRef(false);
  const context = useRef<AudioContext | null>(null);
  const seen = useRef<{ generation: string; ids: Set<number> } | null>(null);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(AUDIO_PREFERENCE_KEY) ?? "null");
      if (value?.version === 1 && value.enabled === true) {
        enabledRef.current = true;
        setEnabled(true);
        setMessage("Preferência ativa. Toque em Testar som para liberar o áudio nesta aba.");
      }
    } catch {
      /* Preference failure never prevents the panel from loading. */
    }
    return () => {
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, []);
  async function arm() {
    if (!window.AudioContext) throw Error("Áudio não disponível neste navegador.");
    if (!context.current || context.current.state === "closed")
      context.current = new window.AudioContext();
    await context.current.resume();
    if (context.current.state !== "running")
      throw Error("O navegador bloqueou o áudio. Toque em Testar som novamente.");
  }
  function play() {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running")
      throw Error("Áudio suspenso ou não liberado. Toque em Testar som nesta aba.");
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.23);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.24);
    setMessage("Som liberado nesta aba. Novos pedidos demonstrativos podem emitir um aviso.");
  }
  async function test() {
    try {
      await arm();
      play();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível reproduzir o áudio.");
    }
  }
  async function toggle() {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    let persisted = true;
    try {
      localStorage.setItem(AUDIO_PREFERENCE_KEY, JSON.stringify({ version: 1, enabled: next }));
    } catch {
      persisted = false;
    }
    if (!next) setMessage("Som desligado.");
    else {
      try {
        await arm();
        setMessage("Som ativo nesta aba. Use Testar som para conferir.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Áudio bloqueado.");
      }
    }
    if (!persisted)
      setMessage(
        "Preferência não salva: armazenamento indisponível. Use Testar som para conferir nesta aba.",
      );
  }
  useEffect(() => {
    if (!ready) return;
    if (!seen.current || seen.current.generation !== generation) {
      seen.current = { generation, ids: new Set(orders.map((o) => o.id)) };
      return;
    }
    const fresh = orders.filter((o) => !seen.current!.ids.has(o.id));
    for (const o of fresh) seen.current.ids.add(o.id);
    if (fresh.length && enabledRef.current) {
      try {
        play();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Áudio bloqueado.");
      }
    }
  }, [orders, generation, ready]);
  return { enabled, message, toggle, test };
}
