import type { SupplierModule } from "./modules";

export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MANAGER", "OPERATOR"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export interface DeliveryTenantAccess {
  organizationId: string;
  instanceId: string;
  planId: string | null;
  role: OrganizationRole;
  modules: readonly SupplierModule[];
}

export function canAccessModule(access: DeliveryTenantAccess, module: SupplierModule) {
  return access.modules.includes(module);
}

export function canManageCatalog(role: OrganizationRole) {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export function canOperateOrders(role: OrganizationRole) {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER" || role === "OPERATOR";
}
