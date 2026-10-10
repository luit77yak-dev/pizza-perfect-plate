import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isVisualDemoAllowed } from "@/features/visual-demo/access";
import { FornoPanelDemo } from "@/features/visual-demo/FornoPanelDemo";
import "@/features/visual-demo/forno-panel.css";

const checkAccess = createServerFn({ method: "GET" }).handler(() =>
  isVisualDemoAllowed(process.env),
);

export const Route = createFileRoute("/visual-demo/painel")({
  beforeLoad: async () => {
    if (!(await checkAccess())) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Painel Forno di Pietra — Demonstração Neroxa" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FornoPanelDemo,
});
