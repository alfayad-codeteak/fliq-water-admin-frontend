import type {
  AdminUserDto,
  CustomerDetailDto,
  CustomerRowDto,
  DeliveryPartnerDto,
  DeliveryZoneDto,
  DepositConfigDto,
  DepositTransactionDto,
  DeliveryPartnerReportDto,
  DeliveryPartnerReportRowDto,
  FeatureKey,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
  PurchaseEntryDto,
  BannerDto,
} from "@/lib/api/types";

import { pickCustomerDisplayName } from "@/lib/customers/display-name";
import { getBusinessPool } from "./business-pool";
import {
  isUpcomingScheduledDate,
  scheduledDateFromTimeSlot,
} from "@/lib/orders/schedule";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "object" && typeof (v as { toString?: () => string }).toString === "function") {
    const n = Number((v as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
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

/** User.profile name, else recipient name on the default/latest address. */
const CUSTOMER_DISPLAY_NAME_SQL = `COALESCE(
  NULLIF(BTRIM(u.name), ''),
  (
    SELECT NULLIF(BTRIM(a.name), '')
    FROM "Address" a
    WHERE a."userId" = u.id
      AND NULLIF(BTRIM(a.name), '') IS NOT NULL
    ORDER BY a."isDefault" DESC, a."createdAt" DESC
    LIMIT 1
  ),
  ''
)`;

/** Ledger plus unrefunded order charges that never got a CHARGE row. */
const HELD_DEPOSIT_SQL = `GREATEST(0,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN t.type IN ('CHARGE', 'TOP_UP', 'ADMIN_CREDIT') THEN t.amount
        WHEN t.type IN ('REFUND', 'ADMIN_DEBIT') THEN -t.amount
        ELSE 0
      END
    )
    FROM "DepositTransaction" t
    WHERE t."userId" = u.id
  ), 0)
  + COALESCE((
    SELECT SUM(o."depositCharge")
    FROM "Order" o
    WHERE o."userId" = u.id
      AND o."depositRefundedAt" IS NULL
      AND o."depositCharge" > 0
      AND NOT EXISTS (
        SELECT 1 FROM "DepositTransaction" t
        WHERE t."orderId" = o.id AND t.type = 'CHARGE'
      )
  ), 0),
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "DepositTransaction" t WHERE t."userId" = u.id
    ) THEN 0
    ELSE COALESCE(w.balance, 0)
  END
)`;

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

export async function dbListDepositTransactions(opts?: {
  userId?: string;
}): Promise<DepositTransactionDto[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts?.userId?.trim()) {
    params.push(opts.userId.trim());
    where.push(`t."userId" = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(200);

  const pool = getBusinessPool();
  const { rows } = await pool.query(
    `
    SELECT t.id, t."userId", t.type, t.amount, t.note, t."orderId", t."createdAt",
           u.phone, ${CUSTOMER_DISPLAY_NAME_SQL} AS "customerName"
    FROM "DepositTransaction" t
    JOIN "User" u ON u.id = t."userId"
    ${whereSql}
    ORDER BY t."createdAt" DESC
    LIMIT $${params.length}
    `,
    params,
  );

  return rows.map((r) => ({
    id: r.id as string,
    userId: r.userId as string,
    customerName: pickCustomerDisplayName({ name: r.customerName }),
    phone: (r.phone as string) ?? "",
    type: r.type as string,
    amount: num(r.amount),
    note: (r.note as string | null) ?? null,
    orderId: (r.orderId as string | null) ?? null,
    createdAt: iso(r.createdAt),
  }));
}

export async function dbListOrders(): Promise<OrderDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT o.id, o."orderNumber", o.status, o."timeSlot", o."paymentMethod", o."totalAmount",
           o."depositBase", o."depositCharge", o."depositDiscount", o."handlingTotal",
           o."depositRefundedAt", o."assignedAt", o."deliveryNotes",
           o."deliveryPartnerId", o."deliveryStatus", o."ifCanRefund",
           o."returnedCanCount", o."actualReturnedCanCount", o."createdAt", o."updatedAt",
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
      scheduledDate: scheduledDateFromTimeSlot(
        (r.timeSlot as string | null) ?? null,
        r.createdAt as Date | string,
      ),
      isUpcoming: isUpcomingScheduledDate(
        scheduledDateFromTimeSlot(
          (r.timeSlot as string | null) ?? null,
          r.createdAt as Date | string,
        ),
      ),
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
      actualReturnedCanCount:
        r.actualReturnedCanCount == null
          ? null
          : Number(r.actualReturnedCanCount),
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
    where.push(`(
      u.name ILIKE $${params.length}
      OR EXISTS (
        SELECT 1 FROM "Address" a
        WHERE a."userId" = u.id AND a.name ILIKE $${params.length}
      )
    )`);
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
    SELECT u.id, u.phone, ${CUSTOMER_DISPLAY_NAME_SQL} AS name, u."createdAt", u."updatedAt",
      (SELECT count(*)::int FROM "Order" o WHERE o."userId" = u.id) AS "orderCount",
      (SELECT count(*)::int FROM "Address" a WHERE a."userId" = u.id) AS "addressCount",
      ${HELD_DEPOSIT_SQL} AS "depositBalance"
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
    name: pickCustomerDisplayName(r),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    orderCount: Number(r.orderCount) || 0,
    addressCount: Number(r.addressCount) || 0,
    depositBalance: num(r.depositBalance),
  }));

  return { data, total, page, limit };
}

export async function dbGetCustomerDetail(
  id: string
): Promise<CustomerDetailDto | null> {
  const pool = getBusinessPool();
  const userRes = await pool.query(
    `
    SELECT u.id, u.phone, ${CUSTOMER_DISPLAY_NAME_SQL} AS name, u."createdAt", u."updatedAt",
      (SELECT count(*)::int FROM "Order" o WHERE o."userId" = u.id) AS "orderCount",
      (SELECT count(*)::int FROM "Address" a WHERE a."userId" = u.id) AS "addressCount",
      ${HELD_DEPOSIT_SQL} AS "depositBalance"
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
    SELECT id, name, label, line1, line2, city, state, pincode, "isDefault", lat, lng
    FROM "Address"
    WHERE "userId" = $1
    ORDER BY "isDefault" DESC, "createdAt" DESC
    `,
    [id]
  );

  return {
    id: u.id as string,
    phone: u.phone as string,
    name: pickCustomerDisplayName({
      name: u.name,
      addresses: addrRes.rows,
    }),
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.updatedAt),
    orderCount: Number(u.orderCount) || 0,
    addressCount: Number(u.addressCount) || 0,
    depositBalance: num(u.depositBalance),
    addresses: addrRes.rows.map((a) => ({
      id: a.id as string,
      name: (a.name as string | null) ?? null,
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

function emptyPartnerReportTotals(): DeliveryPartnerReportDto["totals"] {
  return {
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
  };
}

function parseIstBound(ymd: string | undefined, endExclusive: boolean): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const start = new Date(`${ymd}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) return null;
  if (!endExclusive) return start;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function sumPartnerTotals(
  partners: DeliveryPartnerReportRowDto[],
  unassignedCount: number,
  unassignedAmount: number,
): DeliveryPartnerReportDto["totals"] {
  const totals = emptyPartnerReportTotals();
  totals.partnerCount = partners.length;
  totals.availableCount = partners.filter((p) => p.isAvailable).length;
  totals.unassignedCount = unassignedCount;
  totals.unassignedAmount = unassignedAmount;
  for (const p of partners) {
    totals.orderCount += p.orderCount;
    totals.deliveredCount += p.deliveredCount;
    totals.inProgressCount += p.inProgressCount;
    totals.cancelledCount += p.cancelledCount;
    totals.assignedAmount += p.assignedAmount;
    totals.deliveredAmount += p.deliveredAmount;
    totals.codAmount += p.codAmount;
    totals.codCollected += p.codCollected;
    totals.codOutstanding += p.codOutstanding;
    totals.handlingTotal += p.handlingTotal;
    totals.depositCharged += p.depositCharged;
    totals.cansDelivered += p.cansDelivered;
    totals.emptyCansExpected += p.emptyCansExpected;
    totals.emptyCansCollected += p.emptyCansCollected;
  }
  return totals;
}

export async function dbGetDeliveryPartnerReport(opts?: {
  dateFrom?: string;
  dateTo?: string;
  partnerId?: string;
}): Promise<DeliveryPartnerReportDto> {
  const dateFrom = opts?.dateFrom?.trim() || null;
  const dateTo = opts?.dateTo?.trim() || null;
  const partnerId = opts?.partnerId?.trim() || null;
  const from = parseIstBound(dateFrom ?? undefined, false);
  const toExclusive = parseIstBound(dateTo ?? undefined, true);

  const orderDateSql = [
    from ? `AND o."createdAt" >= $FROM` : "",
    toExclusive ? `AND o."createdAt" < $TO` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pool = getBusinessPool();
  const params: unknown[] = [];
  const bind = (value: unknown, token: string, sql: string) => {
    if (!sql.includes(token)) return sql;
    params.push(value);
    return sql.replaceAll(token, `$${params.length}`);
  };

  let partnerSql = `
    SELECT
      dp.id, dp.name, dp.phone, dp."vehicleType", dp."vehicleNumber", dp."isAvailable",
      COUNT(o.id)::int AS "orderCount",
      COUNT(o.id) FILTER (WHERE o.status = 'DELIVERED')::int AS "deliveredCount",
      COUNT(o.id) FILTER (WHERE o.status IN ('CANCELLED', 'REJECTED'))::int AS "cancelledCount",
      COUNT(o.id) FILTER (
        WHERE o.id IS NOT NULL AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED')
      )::int AS "inProgressCount",
      COALESCE(SUM(o."totalAmount"), 0) AS "assignedAmount",
      COALESCE(SUM(o."totalAmount") FILTER (WHERE o.status = 'DELIVERED'), 0) AS "deliveredAmount",
      COALESCE(SUM(o."totalAmount") FILTER (WHERE UPPER(o."paymentMethod") = 'COD'), 0) AS "codAmount",
      COALESCE(SUM(o."totalAmount") FILTER (
        WHERE o.status = 'DELIVERED' AND UPPER(o."paymentMethod") = 'COD'
      ), 0) AS "codCollected",
      COALESCE(SUM(o."totalAmount") FILTER (
        WHERE UPPER(o."paymentMethod") = 'COD'
          AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED')
      ), 0) AS "codOutstanding",
      COALESCE(SUM(o."handlingTotal"), 0) AS "handlingTotal",
      COALESCE(SUM(o."depositCharge"), 0) AS "depositCharged",
      COALESCE(SUM(items.qty), 0)::int AS "cansDelivered",
      COALESCE(SUM(o."returnedCanCount"), 0)::int AS "emptyCansExpected",
      COALESCE(SUM(o."actualReturnedCanCount"), 0)::int AS "emptyCansCollected"
    FROM "DeliveryPartner" dp
    LEFT JOIN "Order" o ON o."deliveryPartnerId" = dp.id
      ${orderDateSql}
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS qty
      FROM "OrderItem" oi
      WHERE oi."orderId" = o.id
    ) items ON true
    ${partnerId ? `WHERE dp.id = $PARTNER` : ""}
    GROUP BY dp.id
    ORDER BY "deliveredAmount" DESC, dp.name ASC
  `;
  if (from) partnerSql = bind(from, "$FROM", partnerSql);
  if (toExclusive) partnerSql = bind(toExclusive, "$TO", partnerSql);
  if (partnerId) partnerSql = bind(partnerId, "$PARTNER", partnerSql);

  const partnerRes = await pool.query(partnerSql, params);

  const partners: DeliveryPartnerReportRowDto[] = partnerRes.rows.map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "",
    phone: (r.phone as string) ?? "",
    vehicleType: (r.vehicleType as string | null) ?? null,
    vehicleNumber: (r.vehicleNumber as string | null) ?? null,
    isAvailable: Boolean(r.isAvailable),
    orderCount: Number(r.orderCount) || 0,
    deliveredCount: Number(r.deliveredCount) || 0,
    inProgressCount: Number(r.inProgressCount) || 0,
    cancelledCount: Number(r.cancelledCount) || 0,
    assignedAmount: num(r.assignedAmount),
    deliveredAmount: num(r.deliveredAmount),
    codAmount: num(r.codAmount),
    codCollected: num(r.codCollected),
    codOutstanding: num(r.codOutstanding),
    handlingTotal: num(r.handlingTotal),
    depositCharged: num(r.depositCharged),
    cansDelivered: Number(r.cansDelivered) || 0,
    emptyCansExpected: Number(r.emptyCansExpected) || 0,
    emptyCansCollected: Number(r.emptyCansCollected) || 0,
  }));

  const uParams: unknown[] = [];
  let unassignedSql = `
    SELECT COUNT(*)::int AS count, COALESCE(SUM("totalAmount"), 0) AS amount
    FROM "Order" o
    WHERE o."deliveryPartnerId" IS NULL
      AND o.status NOT IN ('CANCELLED', 'REJECTED')
      ${from ? `AND o."createdAt" >= $FROM` : ""}
      ${toExclusive ? `AND o."createdAt" < $TO` : ""}
  `;
  if (from) {
    uParams.push(from);
    unassignedSql = unassignedSql.replace("$FROM", `$${uParams.length}`);
  }
  if (toExclusive) {
    uParams.push(toExclusive);
    unassignedSql = unassignedSql.replace("$TO", `$${uParams.length}`);
  }
  const unassignedRes = partnerId
    ? { rows: [{ count: 0, amount: 0 }] }
    : await pool.query(unassignedSql, uParams);
  const unassignedCount = Number(unassignedRes.rows[0]?.count) || 0;
  const unassignedAmount = num(unassignedRes.rows[0]?.amount);

  const dParams: unknown[] = [];
  let dailySql = `
    SELECT to_char((o."createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS orders,
      COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::int AS delivered,
      COALESCE(SUM(o."totalAmount"), 0) AS amount
    FROM "Order" o
    WHERE o."deliveryPartnerId" IS NOT NULL
      ${from ? `AND o."createdAt" >= $FROM` : ""}
      ${toExclusive ? `AND o."createdAt" < $TO` : ""}
      ${partnerId ? `AND o."deliveryPartnerId" = $PARTNER` : ""}
    GROUP BY 1
    ORDER BY 1
  `;
  if (from) {
    dParams.push(from);
    dailySql = dailySql.replace("$FROM", `$${dParams.length}`);
  }
  if (toExclusive) {
    dParams.push(toExclusive);
    dailySql = dailySql.replace("$TO", `$${dParams.length}`);
  }
  if (partnerId) {
    dParams.push(partnerId);
    dailySql = dailySql.replace("$PARTNER", `$${dParams.length}`);
  }
  const dailyRes = await pool.query(dailySql, dParams);

  const oParams: unknown[] = [];
  let ordersSql = `
    SELECT o.id, o."orderNumber", o.status, o."deliveryStatus", o."paymentMethod",
           o."totalAmount", o."depositCharge", o."handlingTotal",
           o."returnedCanCount", o."actualReturnedCanCount",
           o."createdAt", o."assignedAt", o."timeSlot", o."deliveryPartnerId",
           dp.name AS "partnerName",
           COALESCE(NULLIF(BTRIM(u.name), ''), NULLIF(BTRIM(a.name), ''), '') AS "customerName",
           u.phone,
           COALESCE((SELECT SUM(oi.quantity) FROM "OrderItem" oi WHERE oi."orderId" = o.id), 0)::int AS "canQty"
    FROM "Order" o
    JOIN "DeliveryPartner" dp ON dp.id = o."deliveryPartnerId"
    LEFT JOIN "User" u ON u.id = o."userId"
    LEFT JOIN "Address" a ON a.id = o."addressId"
    WHERE o."deliveryPartnerId" IS NOT NULL
      ${from ? `AND o."createdAt" >= $FROM` : ""}
      ${toExclusive ? `AND o."createdAt" < $TO` : ""}
      ${partnerId ? `AND o."deliveryPartnerId" = $PARTNER` : ""}
    ORDER BY o."createdAt" DESC
    LIMIT 400
  `;
  if (from) {
    oParams.push(from);
    ordersSql = ordersSql.replace("$FROM", `$${oParams.length}`);
  }
  if (toExclusive) {
    oParams.push(toExclusive);
    ordersSql = ordersSql.replace("$TO", `$${oParams.length}`);
  }
  if (partnerId) {
    oParams.push(partnerId);
    ordersSql = ordersSql.replace("$PARTNER", `$${oParams.length}`);
  }
  const ordersRes = await pool.query(ordersSql, oParams);

  return {
    dateFrom,
    dateTo,
    totals: sumPartnerTotals(partners, unassignedCount, unassignedAmount),
    partners,
    daily: dailyRes.rows.map((r) => ({
      date: String(r.date),
      orders: Number(r.orders) || 0,
      delivered: Number(r.delivered) || 0,
      amount: num(r.amount),
    })),
    orders: ordersRes.rows.map((r) => ({
      id: r.id as string,
      orderNumber: String(r.orderNumber ?? r.id),
      partnerId: r.deliveryPartnerId as string,
      partnerName: (r.partnerName as string) ?? "",
      customerName: pickCustomerDisplayName({ name: r.customerName }) || "Customer",
      phone: (r.phone as string) ?? "",
      status: r.status as string,
      deliveryStatus: (r.deliveryStatus as string) ?? "NONE",
      paymentMethod: (r.paymentMethod as string) ?? "",
      totalAmount: num(r.totalAmount),
      depositCharge: num(r.depositCharge),
      handlingTotal: num(r.handlingTotal),
      canQty: Number(r.canQty) || 0,
      returnedCanCount: Number(r.returnedCanCount) || 0,
      actualReturnedCanCount:
        r.actualReturnedCanCount == null ? null : Number(r.actualReturnedCanCount),
      createdAt: iso(r.createdAt),
      assignedAt: r.assignedAt ? iso(r.assignedAt) : null,
      timeSlot: (r.timeSlot as string | null) ?? null,
    })),
  };
}

export async function dbListAdmins(): Promise<AdminUserDto[]> {
  const pool = getBusinessPool();
  const { rows } = await pool.query(`
    SELECT id, phone, name, role, permissions, "createdAt"
    FROM "User"
    WHERE role IN ('admin', 'owner')
    ORDER BY "createdAt" DESC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    phone: r.phone as string,
    name: (r.name as string) ?? "",
    role: r.role === "owner" ? ("owner" as const) : ("admin" as const),
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
  if (scope === "admin" && resource === "deposits" && id === "transactions") {
    return {
      handled: true,
      data: await dbListDepositTransactions({
        userId: searchParams.get("userId") ?? undefined,
      }),
    };
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
  if (scope === "admin" && resource === "reports" && id === "delivery-partners") {
    return {
      handled: true,
      data: await dbGetDeliveryPartnerReport({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
        partnerId: searchParams.get("partnerId") ?? undefined,
      }),
    };
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
