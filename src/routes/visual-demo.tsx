import "@/features/visual-demo/demo-v2.css";
import "@/features/visual-demo/visual-demo.css";
import "@/features/visual-demo/experience/forno-purchase.css";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isVisualDemoAllowed } from "@/features/visual-demo/access";

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
  component: Outlet,
});
