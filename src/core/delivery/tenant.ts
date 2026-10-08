/**
 * Tenant/store data belongs to the delivery backend, not to a visual theme.
 * Keep this contract small: the storefront can render it in any layout.
 */

export interface DeliveryTenantIdentity {
  id: string;
  slug: string | null;
  name: string;
}

export interface DeliveryTenantSettings {
  logo_url: string | null;
  favicon_url?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  description?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
  hero_image_url?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
}

export interface DeliveryTenant {
  organization: DeliveryTenantIdentity;
  settings: DeliveryTenantSettings;
}
