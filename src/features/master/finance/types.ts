export const INVOICE_STATUS_LABELS={PENDING:"Pendente",PAID:"Paga",OVERDUE:"Vencida",CANCELLED:"Cancelada",REFUNDED:"Reembolsada",NEGOTIATION:"Negociação"} as const;
export const PAYMENT_STATUS_LABELS={PENDING:"Pendente",CONFIRMED:"Confirmado",FAILED:"Falhou",REFUNDED:"Reembolsado",CANCELLED:"Cancelado"} as const;
export type InvoiceStatus=keyof typeof INVOICE_STATUS_LABELS;
export type PaymentStatus=keyof typeof PAYMENT_STATUS_LABELS;
export type Invoice={id:string;client_id:string;subscription_id:string|null;invoice_number:string;status:InvoiceStatus;issue_date:string;due_date:string;paid_at:string|null;subtotal:number;discount_amount:number;total_amount:number;notes:string|null;updated_at:string};
export type Payment={id:string;invoice_id:string;client_id:string;status:PaymentStatus;method:string;amount:number;paid_at:string|null;external_reference:string|null;notes:string|null;created_at:string};
export type FinanceClient={id:string;legal_name:string|null;trade_name:string|null};
export type FinanceOverview={invoices:Invoice[];payments:Payment[];clients:FinanceClient[]};