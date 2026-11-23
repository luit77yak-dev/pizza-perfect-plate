// Private LAB build overlay only. NEVER replace the commercial route in main.
import { createFileRoute } from '@tanstack/react-router';
import { LabOrdersDashboard } from '@/components/LabOrdersDashboard';
export const Route = createFileRoute('/admin/pedidos')({ component: LabOrdersDashboard });
