import { createFileRoute } from "@tanstack/react-router";
import { NeroxaAccessGuard } from "@/components/neroxa/NeroxaAccessGuard";
import { Storefront } from "@/components/storefront/Storefront";

export const Route = createFileRoute("/loja/$slug")({
  component: LojaSlug,
});

function LojaSlug() {
  const { slug } = Route.useParams();

  return (
    <NeroxaAccessGuard>
      <Storefront slug={slug} />
    </NeroxaAccessGuard>
  );
}
