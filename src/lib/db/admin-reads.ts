import type {
  AdminUserDto,
  CustomerDetailDto,
  CustomerRowDto,
  DeliveryPartnerDto,
  DeliveryZoneDto,
  DepositConfigDto,
  FeatureKey,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
  PurchaseEntryDto,
  BannerDto,
} from "@/lib/api/types";

import { getBusinessPool } from "./business-pool";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return String(v ?? "");
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export async function dbListProducts(): Promise<ProductDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT id, name, price, mrp, "handlingFee", stock, "hasDeposit",
           "photoUrl", "photoUrls", category, "isActive", "createdAt", "updatedAt"
    FROM "Product"
    ORDER BY name ASC
  `);
  return rows.map((r) => {
    const price = num(r.price);
    return {
      id: r.id as string,
      name: r.name as string,
      price,
      salePrice: price,
      mrp: numOrNull(r.mrp),
      handlingFee: num(r.handlingFee),
      stock: Number(r.stock) || 0,
      hasDeposit: Boolean(r.hasDeposit),
      photoUrl: (r.photoUrl as string | null) ?? null,
      photoUrls: (r.photoUrls as string[] | null) ?? null,
      category: (r.category as string | null) ?? null,
      isActive: Boolean(r.isActive),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    } satisfies ProductDto;
  });
}

export async function dbGetDepositConfig(): Promise<DepositConfigDto | null> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT enabled, "perCanAmount", "promoStartsAt", "promoEndsAt", tiers
    FROM "DepositConfig"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    enabled: Boolean(r.enabled),
    perCanAmount: num(r.perCanAmount),
    promoStartsAt: r.promoStartsAt ? iso(r.promoStartsAt) : null,
    promoEndsAt: r.promoEndsAt ? iso(r.promoEndsAt) : null,
    tiers: Array.isArray(r.tiers) ? r.tiers : [],
  };
}

export async function dbListOrders(): Promise<OrderDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT o.id, o."orderNumber", o.status, o."timeSlot", o."paymentMethod", o."totalAmount",
           o."depositBase", o."depositCharge", o."depositDiscount", o."handlingTotal",
           o."depositRefundedAt", o."assignedAt", o."deliveryNotes",
           o."deliveryPartnerId", o."deliveryStatus", o."ifCanRefund",
           o."returnedCanCount", o."createdAt", o."updatedAt",
           json_build_object(
             'id', u.id,
             'name', coalesce(nullif(btrim(u.name), ''), nullif(btrim(a.name), '')),
             'phone', u.phone
           ) AS "user",
           CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
             'id', a.id, 'name', a.name, 'label', a.label, 'line1', a.line1, 'line2', a.line2,
             'city', a.city, 'state', a.state, 'pincode', a.pincode, 'phone', a.phone
           ) END AS address,
           CASE WHEN dp.id IS NULL THEN NULL ELSE json_build_object(
             'id', dp.id, 'userId', dp."userId", 'name', dp.name, 'phone', dp.phone
           ) END AS "deliveryPartner",
           coalesce((
             SELECT json_agg(json_build_object(
               'id', oi.id,
               'productId', oi."productId",
               'quantity', oi.quantity,
               'unitPrice', oi."unitPrice",
               'price', oi."unitPrice",
               'productName', p.name,
               'name', p.name,
               'photoUrl', p."photoUrl",
               'photoUrls', p."photoUrls"
             ) ORDER BY oi.id)
             FROM "OrderItem" oi
             LEFT JOIN "Product" p ON p.id = oi."productId"
             WHERE oi."orderId" = o.id
           ), '[]'::json) AS items
    FROM "Order" o
    LEFT JOIN "User" u ON u.id = o."userId"
    LEFT JOIN "Address" a ON a.id = o."addressId"
    LEFT JOIN "DeliveryPartner" dp ON dp.id = o."deliveryPartnerId"
    ORDER BY o."createdAt" DESC
  `);

  return rows.map((r) => {
    const depositCharge = num(r.depositCharge);
    const depositDiscount = num(r.depositDiscount);
    const handlingTotal = num(r.handlingTotal);
    const refunded = Boolean(r.depositRefundedAt);
    return {
      id: r.id as string,
      orderNumber: r.orderNumber != null ? String(r.orderNumber) : undefined,
      status: r.status as string,
      statusLabel: statusLabel(String(r.status)),
      timeSlot: (r.timeSlot as string | null) ?? null,
      createdAt: iso(r.createdAt),
      totalAmount: num(r.totalAmount),
      total: num(r.totalAmount),
      handlingTotal,
      depositCharge,
      depositDiscount,
      depositBase: num(r.depositBase),
      depositRefunded: refunded,
      depositRefundAmount: refunded ? depositCharge - depositDiscount : 0,
      deposit: {
        charge: depositCharge,
        discount: depositDiscount,
        refunded,
        refundedAmount: refunded ? depositCharge - depositDiscount : 0,
      },
      ifCanRefund: Boolean(r.ifCanRefund),
      returnedCanCount: Number(r.returnedCanCount) || 0,
      deliveryPartnerId: (r.deliveryPartnerId as string | null) ?? null,
      assignedAt: r.assignedAt ? iso(r.assignedAt) : null,
      deliveryStatus: (r.deliveryStatus as string) ?? "NONE",
      deliveryNotes: (r.deliveryNotes as string | null) ?? null,
      deliveryPartner: r.deliveryPartner ?? null,
      user: r.user ?? undefined,
      address: (r.address as Record<string, unknown> | null) ?? undefined,
      items: Array.isArray(r.items) ? r.items : [],
    } satisfies OrderDto;
  });
}

export async function dbListCustomers(opts: {
  page?: number;
  limit?: number;
  phone?: string;
  name?: string;
}): Promise<PaginatedCustomersDto> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;
  const phone = opts.phone?.trim() ?? "";
  const name = opts.name?.trim() ?? "";

  const where: string[] = phone
    ? [`u.role IN ('customer', 'admin', 'owner')`]
    : [`u.role = 'customer'`];
  const params: unknown[] = [];
  if (phone) {
    params.push(`%${phone}%`);
    where.push(`u.phone ILIKE $${params.length}`);
  }
  if (name) {
    params.push(`%${name}%`);
    where.push(`u.name ILIKE $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getBusinessPool();
  const countRes = await pool.query(
    `SELECT count(*)::int AS total FROM "User" u ${whereSql}`,
    params
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `
    SELECT u.id, u.phone, u.name, u."createdAt", u."updatedAt",
      (SELECT count(*)::int FROM "Order" o WHERE o."userId" = u.id) AS "orderCount",
      (SELECT count(*)::int FROM "Address" a WHERE a."userId" = u.id) AS "addressCount",
      CASE
        WHEN EXISTS (
          SELECT 1 FROM "DepositTransaction" t WHERE t."userId" = u.id
        ) THEN GREATEST(0, COALESCE((
          SELECT SUM(
            CASE
              WHEN t.type IN ('CHARGE', 'TOP_UP', 'ADMIN_CREDIT') THEN t.amount
              WHEN t.type IN ('REFUND', 'ADMIN_DEBIT') THEN -t.amount
              ELSE 0
            END
          )
          FROM "DepositTransaction" t
          WHERE t."userId" = u.id
        ), 0))
        ELSE COALESCE(w.balance, 0)
      END AS "depositBalance"
    FROM "User" u
    LEFT JOIN "UserDepositWallet" w ON w."userId" = u.id
    ${whereSql}
    ORDER BY u."createdAt" DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  const data: CustomerRowDto[] = rows.map((r) => ({
    id: r.id as string,
    phone: r.phone as string,
    name: (r.name as string) ?? "",
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    orderCount: Number(r.orderCount) || 0,
    addressCount: Number(r.addressCount) || 0,
    depositBalance: Number(r.depositBalance) || 0,
  }));

  return { data, total, page, limit };
}

export async function dbGetCustomerDetail(
  id: string
): Promise<CustomerDetailDto | null> {
  const pool = getBusinessPool();
  const userRes = await pool.query(
    `
    SELECT u.id, u.phone, u.name, u."createdAt", u."updatedAt",
      (SELECT count(*)::int FROM "Order" o WHERE o."userId" = u.id) AS "orderCount",
      (SELECT count(*)::int FROM "Address" a WHERE a."userId" = u.id) AS "addressCount",
      CASE
        WHEN EXISTS (
          SELECT 1 FROM "DepositTransaction" t WHERE t."userId" = u.id
        ) THEN GREATEST(0, COALESCE((
          SELECT SUM(
            CASE
              WHEN t.type IN ('CHARGE', 'TOP_UP', 'ADMIN_CREDIT') THEN t.amount
              WHEN t.type IN ('REFUND', 'ADMIN_DEBIT') THEN -t.amount
              ELSE 0
            END
          )
          FROM "DepositTransaction" t
          WHERE t."userId" = u.id
        ), 0))
        ELSE COALESCE(w.balance, 0)
      END AS "depositBalance"
    FROM "User" u
    LEFT JOIN "UserDepositWallet" w ON w."userId" = u.id
    WHERE u.id = $1 AND u.role IN ('customer', 'admin', 'owner')
    LIMIT 1
    `,
    [id]
  );
  const u = userRes.rows[0];
  if (!u) return null;

  const addrRes = await pool.query(
    `
    SELECT id, label, line1, line2, city, state, pincode, "isDefault", lat, lng
    FROM "Address"
    WHERE "userId" = $1
    ORDER BY "isDefault" DESC, "createdAt" DESC
    `,
    [id]
  );

  return {
    id: u.id as string,
    phone: u.phone as string,
    name: (u.name as string) ?? "",
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.updatedAt),
    orderCount: Number(u.orderCount) || 0,
    addressCount: Number(u.addressCount) || 0,
    depositBalance: Number(u.depositBalance) || 0,
    addresses: addrRes.rows.map((a) => ({
      id: a.id as string,
      label: (a.label as string | null) ?? null,
      line1: (a.line1 as string | null) ?? null,
      line2: (a.line2 as string | null) ?? null,
      city: (a.city as string | null) ?? null,
      state: (a.state as string | null) ?? null,
      pincode: (a.pincode as string | null) ?? null,
      isDefault: Boolean(a.isDefault),
      lat: a.lat == null ? null : Number(a.lat),
      lng: a.lng == null ? null : Number(a.lng),
    })),
  };
}

export async function dbListDeliveryPartners(): Promise<DeliveryPartnerDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT id, "userId", name, phone, "vehicleType", "vehicleNumber",
           "isAvailable", "currentLat", "currentLng", "createdAt", "updatedAt"
    FROM "DeliveryPartner"
    ORDER BY name ASC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    userId: r.userId as string,
    name: r.name as string,
    phone: r.phone as string,
    vehicleType: (r.vehicleType as string | null) ?? null,
    vehicleNumber: (r.vehicleNumber as string | null) ?? null,
    isAvailable: Boolean(r.isAvailable),
    currentLat: numOrNull(r.currentLat),
    currentLng: numOrNull(r.currentLng),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

export async function dbListDeliveryZones(): Promise<DeliveryZoneDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT id, name, "centerLat", "centerLng", "radiusKm", "isActive",
           "createdAt", "updatedAt"
    FROM "DeliveryZone"
    ORDER BY name ASC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    centerLat: num(r.centerLat),
    centerLng: num(r.centerLng),
    radiusKm: num(r.radiusKm),
    isActive: Boolean(r.isActive),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

export async function dbListPurchaseEntries(opts?: {
  dateFrom?: string;
  dateTo?: string;
  supplierName?: string;
  referenceNo?: string;
}): Promise<PurchaseEntryDto[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.dateFrom) {
    params.push(opts.dateFrom);
    where.push(`pe."purchasedAt"::date >= $${params.length}::date`);
  }
  if (opts?.dateTo) {
    params.push(opts.dateTo);
    where.push(`pe."purchasedAt"::date <= $${params.length}::date`);
  }
  if (opts?.supplierName?.trim()) {
    params.push(`%${opts.supplierName.trim()}%`);
    where.push(`pe."supplierName" ILIKE $${params.length}`);
  }
  if (opts?.referenceNo?.trim()) {
    params.push(`%${opts.referenceNo.trim()}%`);
    where.push(`pe."referenceNo" ILIKE $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getBusinessPool();
  const { rows } = await pool.query(
    `
    SELECT pe.id, pe."supplierName", pe."referenceNo", pe.notes, pe."totalAmount",
           pe."purchasedAt", pe."createdAt", pe."updatedAt",
           CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
             'id', u.id, 'name', u.name, 'phone', u.phone
           ) END AS "createdBy",
           coalesce((
             SELECT json_agg(json_build_object(
               'id', i.id,
               'productId', i."productId",
               'productName', p.name,
               'quantity', i.quantity,
               'unitCost', i."unitCost",
               'lineTotal', (i.quantity::numeric * i."unitCost")
             ) ORDER BY i.id)
             FROM "PurchaseEntryItem" i
             LEFT JOIN "Product" p ON p.id = i."productId"
             WHERE i."purchaseEntryId" = pe.id
           ), '[]'::json) AS items
    FROM "PurchaseEntry" pe
    LEFT JOIN "User" u ON u.id = pe."createdById"
    ${whereSql}
    ORDER BY pe."purchasedAt" DESC
    `,
    params
  );

  return rows.map((r) => ({
    id: r.id as string,
    supplierName: (r.supplierName as string | null) ?? null,
    referenceNo: (r.referenceNo as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    totalAmount: num(r.totalAmount),
    purchasedAt: iso(r.purchasedAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    createdBy: r.createdBy ?? null,
    items: Array.isArray(r.items)
      ? r.items.map((item: Record<string, unknown>) => ({
          id: String(item.id),
          productId: String(item.productId),
          productName: item.productName ? String(item.productName) : undefined,
          quantity: Number(item.quantity) || 0,
          unitCost: num(item.unitCost),
          lineTotal: num(item.lineTotal),
        }))
      : [],
  }));
}

export async function dbListAdmins(): Promise<AdminUserDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT id, phone, name, role, permissions, "createdAt"
    FROM "User"
    WHERE role = 'admin'
    ORDER BY "createdAt" DESC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    phone: r.phone as string,
    name: (r.name as string) ?? "",
    role: "admin" as const,
    permissions: Array.isArray(r.permissions)
      ? (r.permissions as FeatureKey[])
      : [],
    createdAt: iso(r.createdAt),
  }));
}

const BANNER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "Banner" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "linkUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "imageMime" TEXT NOT NULL,
  "imageBytes" BYTEA,
  "imageKey" TEXT,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function ensureBannerTable() {
  const pool = getBusinessPool();
  await pool.query(BANNER_TABLE_SQL);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "Banner_isActive_idx" ON "Banner"("isActive")`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "Banner_sortOrder_idx" ON "Banner"("sortOrder")`
  );
  await pool.query(
    `ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "productId" TEXT`
  );
  await pool.query(
    `ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "imageKey" TEXT`
  );
  await pool.query(
    `ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`
  );
  await pool.query(
    `ALTER TABLE "Banner" ALTER COLUMN "imageBytes" DROP NOT NULL`
  );
}

export async function dbListBanners(): Promise<BannerDto[]> {
  await ensureBannerTable();
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT b.id, b.title, b."linkUrl", b."productId", b."sortOrder", b."isActive",
           b."imageUrl" AS "storedImageUrl",
           b."createdAt", b."updatedAt", p.name AS "productName"
    FROM "Banner" b
    LEFT JOIN "Product" p ON p.id = b."productId"
    ORDER BY b."sortOrder" ASC, b."createdAt" DESC
  `);
  return rows.map((r) => {
    const productName = (r.productName as string | null) ?? null;
    const slug = productName
      ? productName.trim().toLowerCase().replace(/\s+/g, "-")
      : null;
    const linkUrl = slug
      ? `https://neerbottle.in/product/${slug}`
      : ((r.linkUrl as string | null) ?? null);
    const stored = ((r.storedImageUrl as string | null) ?? "").trim();
    const imageUrl =
      stored.startsWith("http://") || stored.startsWith("https://")
        ? stored
        : `/api/admin/banners/${r.id as string}/image`;
    return {
      id: r.id as string,
      title: (r.title as string | null) ?? null,
      linkUrl,
      productId: (r.productId as string | null) ?? null,
      productName,
      sortOrder: Number(r.sortOrder) || 0,
      isActive: Boolean(r.isActive),
      imageUrl,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  });
}

export type AdminDbGetResult =
  | { handled: false }
  | { handled: true; data: unknown; status?: number };

/** Resolve a BFF GET path to a DB payload, or `{ handled: false }` to proxy. */
export async function resolveAdminDbGet(
  segments: string[],
  searchParams: URLSearchParams
): Promise<AdminDbGetResult> {
  const [scope, resource, id] = segments;
  if (scope === "admin" && resource === "products" && !id) {
    return { handled: true, data: await dbListProducts() };
  }
  if (scope === "admin" && resource === "orders" && !id) {
    return { handled: true, data: await dbListOrders() };
  }
  if (scope === "admin" && resource === "customers" && !id) {
    return {
      handled: true,
      data: await dbListCustomers({
        page: Number(searchParams.get("page") ?? 1) || 1,
        limit: Number(searchParams.get("limit") ?? 20) || 20,
        phone: searchParams.get("phone") ?? undefined,
        name: searchParams.get("name") ?? undefined,
      }),
    };
  }
  if (scope === "admin" && resource === "customers" && id) {
    const detail = await dbGetCustomerDetail(id);
    if (!detail) return { handled: true, data: { message: "Not found" }, status: 404 };
    return { handled: true, data: detail };
  }
  if (scope === "admin" && resource === "delivery-partners" && !id) {
    return { handled: true, data: await dbListDeliveryPartners() };
  }
  if (scope === "admin" && resource === "delivery-zones" && !id) {
    return { handled: true, data: await dbListDeliveryZones() };
  }
  if (scope === "admin" && resource === "banners" && !id) {
    try {
      return { handled: true, data: await dbListBanners() };
    } catch {
      return { handled: false };
    }
  }
  if (scope === "admin" && resource === "purchase-entries" && !id) {
    return {
      handled: true,
      data: await dbListPurchaseEntries({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
        supplierName: searchParams.get("supplierName") ?? undefined,
        referenceNo: searchParams.get("referenceNo") ?? undefined,
      }),
    };
  }
  if (scope === "owner" && resource === "admins" && !id) {
    return { handled: true, data: await dbListAdmins() };
  }
  return { handled: false };
}
