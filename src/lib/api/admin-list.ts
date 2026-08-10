import { backendFetch } from "@/lib/api/server-fetch";
import type {
  AdminUserDto,
  DeliveryPartnerDto,
  DeliveryZoneDto,
  DepositConfigDto,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
  PurchaseEntryDto,
} from "@/lib/api/types";
import {
  dbGetDepositConfig,
  dbListAdmins,
  dbListCustomers,
  dbListDeliveryPartners,
  dbListDeliveryZones,
  dbListOrders,
  dbListProducts,
  dbListPurchaseEntries,
} from "@/lib/db/admin-reads";
import { isBusinessDbConfigured } from "@/lib/db/business-pool";

async function fromApi<T>(
  path: string,
  fallback: T
): Promise<T> {
  const res = await backendFetch(path);
  if (!res.ok) return fallback;
  return (await res.json()) as T;
}

/** Prefer direct Postgres reads; fall back to Workers API. */
export async function loadProducts(): Promise<ProductDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListProducts();
    } catch (e) {
      console.error("dbListProducts failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/products", []);
}

export async function loadDepositConfig(): Promise<DepositConfigDto | null> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbGetDepositConfig();
    } catch (e) {
      console.error("dbGetDepositConfig failed, falling back to API", e);
    }
  }
  return fromApi("/api/deposits/config", null);
}

export async function loadOrders(): Promise<OrderDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListOrders();
    } catch (e) {
      console.error("dbListOrders failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/orders", []);
}

export async function loadCustomers(opts?: {
  page?: number;
  limit?: number;
  phone?: string;
  name?: string;
}): Promise<PaginatedCustomersDto> {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const empty: PaginatedCustomersDto = { data: [], total: 0, page, limit };
  if (isBusinessDbConfigured()) {
    try {
      return await dbListCustomers({
        page,
        limit,
        phone: opts?.phone,
        name: opts?.name,
      });
    } catch (e) {
      console.error("dbListCustomers failed, falling back to API", e);
    }
  }
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (opts?.phone) q.set("phone", opts.phone);
  if (opts?.name) q.set("name", opts.name);
  return fromApi(`/api/admin/customers?${q}`, empty);
}

export async function loadDeliveryPartners(): Promise<DeliveryPartnerDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListDeliveryPartners();
    } catch (e) {
      console.error("dbListDeliveryPartners failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/delivery-partners", []);
}

export async function loadDeliveryZones(): Promise<DeliveryZoneDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListDeliveryZones();
    } catch (e) {
      console.error("dbListDeliveryZones failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/delivery-zones", []);
}

export async function loadPurchaseEntries(): Promise<PurchaseEntryDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListPurchaseEntries();
    } catch (e) {
      console.error("dbListPurchaseEntries failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/purchase-entries", []);
}

export async function loadAdmins(): Promise<AdminUserDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListAdmins();
    } catch (e) {
      console.error("dbListAdmins failed, falling back to API", e);
    }
  }
  return fromApi("/api/owner/admins", []);
}
