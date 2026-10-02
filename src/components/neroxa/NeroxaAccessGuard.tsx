import { useEffect, useState, type ReactNode } from "react";

type AccessState = "checking" | "allowed" | "blocked";

export type NeroxaSystemContext = {
  instanceId: string;
  instanceName: string;
  instanceSlug: string;
  systemType: string;
  systemSlug?: string;
  systemName?: string;
  organizationId?: string;
};

type ResolveResponse = {
  access: "allowed";
  instanceId: string;
  instanceName: string;
  instanceSlug: string;
  systemType: string;
  systemSlug?: string;
  systemName?: string;
  organizationId?: string;
};

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];

function shouldEnforceAccess() {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();

  return (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    !hostname.endsWith(".vercel.app") &&
    hostname !== "vercel.app"
  );
}

export function NeroxaAccessGuard({
  children,
  onResolved,
}: {
  children: ReactNode;
  onResolved?: (context: NeroxaSystemContext) => void;
}) {
  const [state, setState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!shouldEnforceAccess()) {
        if (!cancelled) setState("allowed");
        return;
      }

      if (!SUPABASE_URL) {
        if (!cancelled) setState("blocked");
        return;
      }

      try {
        const domain = window.location.hostname;
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/neroxa-resolve-access?domain=${encodeURIComponent(domain)}`,
          { headers: { Accept: "application/json" } },
        );

        if (!response.ok) {
          if (!cancelled) setState("blocked");
          return;
        }

        const payload = (await response.json()) as ResolveResponse;

        if (
          payload.access !== "allowed" ||
          !payload.instanceId ||
          !payload.instanceName ||
          !payload.instanceSlug ||
          !payload.systemType
        ) {
          if (!cancelled) setState("blocked");
          return;
        }

        if (!cancelled) {
          onResolved?.({
            instanceId: payload.instanceId,
            instanceName: payload.instanceName,
            instanceSlug: payload.instanceSlug,
            systemType: payload.systemType,
            systemSlug: payload.systemSlug,
            systemName: payload.systemName,
            organizationId: payload.organizationId,
          });
          setState("allowed");
        }
      } catch {
        if (!cancelled) setState("blocked");
      }
    }

    void validate();

    return () => {
      cancelled = true;
    };
  }, [onResolved]);

  if (state === "allowed") return <>{children}</>;

  if (state === "blocked") {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
          <section className="w-full rounded-3xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
              🔒
            </div>
            <h1 className="text-2xl font-semibold">Sistema temporariamente indisponível</h1>
            <p className="mt-3 text-muted-foreground">
              Este endereço não está autorizado para acesso no momento. Se você
              é o responsável pelo sistema, entre em contato com a Neroxa.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <h1 className="text-xl font-semibold">Verificando acesso…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Validando o status deste sistema.
          </p>
        </section>
      </div>
    </main>
  );
}
