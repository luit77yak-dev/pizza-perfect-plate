/**
 * Capabilities exposed by the supplier/company panel.
 * Plans enable these modules; tenant customization may change their presentation,
 * but must not bypass the plan entitlement.
 */
export const SUPPLIER_MODULES = [
  "dashboard",
  "catalog",
  "orders",
  "customers",
  "delivery",
  "store",
  "appearance",
  "inventory",
  "reports",
  "promotions",
  "loyalty",
  "scheduling",
  "team",
  "integrations",
  "automations",
  "customization",
] as const;

export type SupplierModule = (typeof SUPPLIER_MODULES)[number];

export type SupplierModuleAccess = Record<SupplierModule, boolean>;

export const ESSENTIAL_MODULES: SupplierModule[] = [
  "dashboard",
  "catalog",
  "orders",
  "customers",
  "delivery",
  "store",
  "appearance",
];

export const PROFESSIONAL_MODULES: SupplierModule[] = [
  ...ESSENTIAL_MODULES,
  "inventory",
  "reports",
  "promotions",
  "loyalty",
  "scheduling",
  "team",
];

export const PREMIUM_MODULES: SupplierModule[] = [
  ...PROFESSIONAL_MODULES,
  "integrations",
  "automations",
  "customization",
];

export function moduleAccess(enabled: readonly SupplierModule[]): SupplierModuleAccess {
  return SUPPLIER_MODULES.reduce((access, module) => {
    access[module] = enabled.includes(module);
    return access;
  }, {} as SupplierModuleAccess);
}
