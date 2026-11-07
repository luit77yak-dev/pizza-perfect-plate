/** Explicitly disabled until private backend is approved and implemented. */
export function rejectPilotCheckout(): Response {
  return Response.json(
    { error: "Checkout seguro indisponível. Solicite atendimento da loja." },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
