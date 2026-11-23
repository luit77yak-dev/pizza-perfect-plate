// Private LAB build overlay only. Not an authenticated public route.
import { createFileRoute } from '@tanstack/react-router';
import { LabBuyerTrackingScreen } from '@/components/LabBuyerTrackingScreen';
export const Route = createFileRoute('/loja/pedido-lab')({ component: LabBuyerTrackingScreen });
