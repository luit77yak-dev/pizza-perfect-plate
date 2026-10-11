import { createFileRoute } from "@tanstack/react-router";
import { Storefront } from "@/components/storefront/Storefront";

export const Route = createFileRoute("/loja/$slug")({
  component: LojaSlug,
});

function LojaSlug() {
  return <Storefront />;
}
