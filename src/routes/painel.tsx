import { createFileRoute } from "@tanstack/react-router";
import SupplierPanel from "@/features/supplier/components/SupplierPanel";

export const Route = createFileRoute("/painel")({
  component: SupplierPanel,
});
