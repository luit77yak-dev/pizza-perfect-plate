import { createFileRoute } from "@tanstack/react-router";
import { Storefront } from "@/components/storefront/Storefront";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardápio online | Faça seu pedido" },
      { name: "description", content: "Conheça o cardápio da loja, personalize seu pedido e compre online." },
      { property: "og:title", content: "Forno di Pietra | Pizzas artesanais" },
      { property: "og:description", content: "Escolha pizzas artesanais, personalize seu pedido e peça online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Storefront />;
}
