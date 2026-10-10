import { createFileRoute } from "@tanstack/react-router";
import { VisualDemo } from "@/features/visual-demo/VisualDemo";

export const Route = createFileRoute("/visual-demo/")({ component: VisualDemo });
