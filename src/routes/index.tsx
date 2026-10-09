import { createFileRoute } from "@tanstack/react-router";
import { Storefront } from "@/components/storefront/Storefront";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardápio online | Faça seu pedido" },
      { name: "description", content: "Conheça o cardápio da loja, personalize seu pedido e compre online." },
      { property: "og:title", content: "Cardápio online | Faça seu pedido" },
      { property: "og:description", content: "Conheça o cardápio da loja, personalize seu pedido e compre online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Storefront />;
}
