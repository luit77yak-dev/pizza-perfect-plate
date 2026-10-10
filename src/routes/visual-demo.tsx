import "@/features/visual-demo/visual-demo.css";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isVisualDemoAllowed } from "@/features/visual-demo/access";
import { VisualDemo } from "@/features/visual-demo/VisualDemo";

const checkAccess = createServerFn({ method: "GET" }).handler(() =>
  isVisualDemoAllowed(process.env),
);

export const Route = createFileRoute("/visual-demo")({
  beforeLoad: async () => {
    if (!(await checkAccess())) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Forno di Pietra — Demonstração" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VisualDemo,
});
