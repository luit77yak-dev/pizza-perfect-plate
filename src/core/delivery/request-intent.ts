/** Memory-only retry guard. Never re-key an uncertain write automatically. */
export function bindRequestIntent(previous: string | null, payload: unknown): string {
  const current = JSON.stringify(payload);
  if (previous !== null && previous !== current) {
    throw new Error(
      "A tentativa anterior ainda precisa ser confirmada. Restaure os mesmos itens e dados para tentar novamente; não crie outro pedido sem verificar o acompanhamento.",
    );
  }
  return current;
}
