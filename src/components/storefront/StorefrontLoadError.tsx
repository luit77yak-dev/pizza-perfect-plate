import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

type StorefrontLoadErrorProps = {
  error: unknown;
  onRetry: () => void;
};

export function StorefrontLoadError({ error, onRetry }: StorefrontLoadErrorProps) {
  return (
    <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-muted">
            <Store className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl">A loja ainda não está pronta</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error instanceof Error ? error.message : "Não foi possível carregar o cardápio."}
          </p>
          <Button className="mt-6" onClick={() => onRetry()}>
            Tentar novamente
          </Button>
        </section>
  );
}
