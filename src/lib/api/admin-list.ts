import { backendFetch } from "@/lib/api/server-fetch";
import type {
  AdminUserDto,
  CustomerRowDto,
  DeliveryPartnerDto,
  DeliveryZoneDto,
  DepositConfigDto,
  DepositTransactionDto,
  DeliveryPartnerReportDto,
  DispatchSettingsDto,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
  PurchaseEntryDto,
  BannerDto,
} from "@/lib/api/types";
import {
  dbGetDepositConfig,
  dbGetDeliveryPartnerReport,
  dbListDepositTransactions,
  dbListDepositWallets,
  dbListAdmins,
  dbListCustomers,
  dbListDeliveryPartners,
  dbListDeliveryZones,
  dbListOrders,
  dbListProducts,
  dbListPurchaseEntries,
  dbListBanners,
} from "@/lib/db/admin-reads";
import { pickCustomerDisplayName } from "@/lib/customers/display-name";
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

export async function loadDepositTransactions(opts?: {
  userId?: string;
}): Promise<DepositTransactionDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListDepositTransactions(opts);
    } catch (e) {
      console.error("dbListDepositTransactions failed, falling back to API", e);
    }
  }
  const q = new URLSearchParams();
  if (opts?.userId) q.set("userId", opts.userId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return fromApi(`/api/admin/deposits/transactions${suffix}`, []);
}

export async function loadDepositWallets(): Promise<CustomerRowDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return (await dbListDepositWallets()).map((c) => ({
        ...c,
        name: pickCustomerDisplayName(c),
      }));
    } catch (e) {
      console.error("dbListDepositWallets failed, falling back to API", e);
    }
  }
  return fromApi("/api/admin/deposits/wallets", []);
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

function normalizeCustomersPage(payload: PaginatedCustomersDto): PaginatedCustomersDto {
  return {
    ...payload,
    data: (payload.data ?? []).map((c) => ({
      ...c,
      name: pickCustomerDisplayName(c),
    })),
  };
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
      return normalizeCustomersPage(
        await dbListCustomers({
          page,
          limit,
          phone: opts?.phone,
          name: opts?.name,
        }),
      );
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
  return normalizeCustomersPage(await fromApi(`/api/admin/customers?${q}`, empty));
}

function emptyDeliveryPartnerReport(): DeliveryPartnerReportDto {
  return {
    dateFrom: null,
    dateTo: null,
    totals: {
      partnerCount: 0,
      availableCount: 0,
      orderCount: 0,
      deliveredCount: 0,
      inProgressCount: 0,
      cancelledCount: 0,
      assignedAmount: 0,
      deliveredAmount: 0,
      codAmount: 0,
      codCollected: 0,
      codOutstanding: 0,
      handlingTotal: 0,
      depositCharged: 0,
      cansDelivered: 0,
      emptyCansExpected: 0,
      emptyCansCollected: 0,
      unassignedCount: 0,
      unassignedAmount: 0,
    },
    partners: [],
    daily: [],
    orders: [],
  };
}

export async function loadDeliveryPartnerReport(opts?: {
  dateFrom?: string;
  dateTo?: string;
  partnerId?: string;
}): Promise<DeliveryPartnerReportDto> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbGetDeliveryPartnerReport(opts);
    } catch (e) {
      console.error("dbGetDeliveryPartnerReport failed, falling back to API", e);
    }
  }
  const q = new URLSearchParams();
  if (opts?.dateFrom) q.set("dateFrom", opts.dateFrom);
  if (opts?.dateTo) q.set("dateTo", opts.dateTo);
  if (opts?.partnerId) q.set("partnerId", opts.partnerId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return fromApi(
    `/api/admin/reports/delivery-partners${suffix}`,
    emptyDeliveryPartnerReport(),
  );
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

export async function loadDispatchSettings(): Promise<DispatchSettingsDto> {
  return fromApi("/api/admin/delivery-settings", {
    partnerSelfAssignEnabled: true,
  });
}

export async function loadBanners(): Promise<BannerDto[]> {
  if (isBusinessDbConfigured()) {
    try {
      return await dbListBanners();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("dbListBanners failed, falling back to API:", msg);
    }
  }
  return fromApi("/api/admin/banners", []);
}
