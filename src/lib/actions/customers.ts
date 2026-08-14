"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/api/server-fetch";
import type { CustomerAddressDto, CustomerRowDto } from "@/lib/api/types";
import {
  createCustomerAddressSchema,
  createCustomerSchema,
  createCustomerWithAddressSchema,
} from "@/lib/validations/customer";

type AddressPayload = {
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

function parseApiError(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(", ");
    if (typeof j.message === "string") return j.message;
  } catch {
    /* plain text */
  }
  return text;
}

function isMissingRouteError(status: number, text: string): boolean {
  return status === 404 && /cannot (post|get|put|patch|delete)/i.test(text);
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

function parseCustomerRow(json: unknown): CustomerRowDto | null {
  if (!json || typeof json !== "object") return null;

  const tryRow = (value: unknown): CustomerRowDto | null => {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const id =
      typeof row.id === "string"
        ? row.id
        : typeof row.userId === "string"
          ? row.userId
          : null;
    if (!id) return null;

    return {
      id,
      phone: typeof row.phone === "string" ? row.phone : "",
      name: typeof row.name === "string" ? row.name : "",
      createdAt:
        typeof row.createdAt === "string"
          ? row.createdAt
          : new Date().toISOString(),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
      orderCount:
        typeof row.orderCount === "number" ? row.orderCount : undefined,
      addressCount:
        typeof row.addressCount === "number" ? row.addressCount : undefined,
    };
  };

  const root = json as Record<string, unknown>;
  const direct =
    tryRow(root) ??
    tryRow(root.data) ??
    tryRow(root.customer) ??
    tryRow(root.user);
  if (direct) return direct;

  if (Array.isArray(root.data) && root.data[0]) {
    return tryRow(root.data[0]);
  }

  return null;
}

function parseAddressDto(json: unknown): CustomerAddressDto | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  for (const candidate of [root, root.data, root.address]) {
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof (candidate as CustomerAddressDto).id === "string"
    ) {
      return candidate as CustomerAddressDto;
    }
  }
  return null;
}

async function lookupCustomerByPhone(
  phone: string
): Promise<CustomerRowDto | null> {
  const res = await backendFetch(
    `/api/admin/customers?phone=${encodeURIComponent(phone)}&page=1&limit=5`
  );
  if (!res.ok) return null;
  const body: unknown = await res.json();
  if (!body || typeof body !== "object") return null;

  const paginated = body as { data?: unknown[] };
  const rows = Array.isArray(paginated.data)
    ? paginated.data
        .map((row) => parseCustomerRow(row))
        .filter((row): row is CustomerRowDto => Boolean(row))
    : [];

  const exact =
    rows.find((row) => normalizePhone(row.phone) === phone) ?? null;
  if (exact) return exact;

  if (rows[0] && normalizePhone(rows[0].phone) === phone) return rows[0];
  return null;
}

/** Look up a customer by 10-digit phone for admin order create. */
export async function findCustomerByPhoneAction(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (phone.length !== 10) {
    return { ok: false as const, error: "Enter a valid 10-digit phone" };
  }
  try {
    const customer = await lookupCustomerByPhone(phone);
    return { ok: true as const, customer };
  } catch {
    return { ok: false as const, error: "Could not look up customer" };
  }
}

async function fetchCustomerById(id: string): Promise<CustomerRowDto | null> {
  const res = await backendFetch(
    `/api/admin/customers/${encodeURIComponent(id)}`
  );
  if (!res.ok) return null;
  return parseCustomerRow(await res.json());
}

async function resolveCustomerAfterCreate(
  createdJson: unknown,
  phone: string
): Promise<CustomerRowDto | null> {
  const parsed = parseCustomerRow(createdJson);
  if (parsed?.id) {
    const verified = await fetchCustomerById(parsed.id);
    return verified ?? parsed;
  }

  return lookupCustomerByPhone(phone);
}

function buildCustomerBody(data: {
  phone: string;
  name?: string;
  password?: string;
  address?: AddressPayload;
}) {
  const body: Record<string, unknown> = { phone: data.phone };
  const name = data.name?.trim();
  const password = data.password?.trim();
  if (name) body.name = name;
  if (password) body.password = password;
  if (data.address) {
    body.address = {
      label: data.address.label,
      line1: data.address.line1,
      city: data.address.city,
      state: data.address.state,
      pincode: data.address.pincode,
      isDefault: data.address.isDefault ?? true,
    };
  }
  return body;
}

async function postCustomerAddress(
  customerId: string,
  payload: AddressPayload
): Promise<Response> {
  const body = {
    label: payload.label,
    line1: payload.line1,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    isDefault: payload.isDefault ?? false,
  };

  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: `/api/admin/customers/${encodeURIComponent(customerId)}/addresses`,
      body,
    },
    {
      path: `/api/admin/customers/${encodeURIComponent(customerId)}/address`,
      body,
    },
    {
      path: "/api/admin/addresses",
      body: { userId: customerId, ...body },
    },
  ];

  let lastText = "";
  for (const attempt of attempts) {
    const res = await backendFetch(attempt.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt.body),
    });
    const text = await res.text();

    if (isMissingRouteError(res.status, text)) {
      lastText = text;
      continue;
    }

    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      message:
        "Address API route not found on your backend. Deploy the latest backend (POST /api/admin/customers/:id/addresses) or point API_URL to the server that has it.",
      statusCode: 404,
    }),
    { status: 404, headers: { "content-type": "application/json" } }
  );
}

export async function createCustomerAction(payload: {
  phone: string;
  name?: string;
  password?: string;
  address?: AddressPayload;
}) {
  const parsed = createCustomerSchema.safeParse({
    phone: payload.phone,
    name: payload.name,
    password: payload.password,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const phone = normalizePhone(parsed.data.phone);
  const res = await backendFetch("/api/admin/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildCustomerBody({
        ...parsed.data,
        phone,
        address: payload.address,
      })
    ),
  });

  if (res.status === 409) {
    return {
      ok: false as const,
      error: { phone: ["Phone already registered"] },
    };
  }
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      error: { root: [parseApiError(t) || `HTTP ${res.status}`] },
    };
  }

  const raw: unknown = await res.json();
  const customer = await resolveCustomerAfterCreate(raw, phone);

  const nestedAddress = parseAddressDto(raw);
  if (customer?.id && nestedAddress) {
    revalidatePath("/customers");
    return {
      ok: true as const,
      data: customer,
      address: nestedAddress,
    };
  }

  if (!customer?.id) {
    return {
      ok: false as const,
      error: {
        root: [
          "Customer may have been created, but the API did not return a usable id. Refresh and search by phone.",
        ],
      },
    };
  }

  revalidatePath("/customers");
  return { ok: true as const, data: customer };
}

export async function createCustomerAddressAction(
  userId: string,
  payload: AddressPayload
) {
  if (!userId?.trim()) {
    return { ok: false as const, error: { root: ["Customer id is required"] } };
  }

  const parsed = createCustomerAddressSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const customer = await fetchCustomerById(userId.trim());
  const customerId = customer?.id ?? userId.trim();

  const res = await postCustomerAddress(customerId, parsed.data);

  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      error: { root: [parseApiError(t) || `HTTP ${res.status}`] },
    };
  }

  const address = parseAddressDto(await res.json());
  if (!address) {
    return {
      ok: false as const,
      error: {
        root: [
          "Address may have been saved, but the API response did not include an address id.",
        ],
      },
    };
  }

  revalidatePath("/customers");
  return { ok: true as const, data: address };
}

export async function createCustomerWithAddressAction(payload: {
  phone: string;
  name?: string;
  password?: string;
  address: AddressPayload;
}) {
  const parsed = createCustomerWithAddressSchema.safeParse({
    ...payload,
    phone: normalizePhone(payload.phone),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const customerRes = await createCustomerAction({
    ...parsed.data,
    address: { ...parsed.data.address, isDefault: true },
  });
  if (!customerRes.ok) return customerRes;

  if ("address" in customerRes && customerRes.address) {
    return {
      ok: true as const,
      data: {
        customer: customerRes.data,
        address: customerRes.address,
      },
    };
  }

  const addressRes = await createCustomerAddressAction(customerRes.data.id, {
    ...parsed.data.address,
    isDefault: true,
  });
  if (!addressRes.ok) {
    return {
      ok: false as const,
      error: addressRes.error,
      partial: { customer: customerRes.data },
    };
  }

  return {
    ok: true as const,
    data: {
      customer: customerRes.data,
      address: addressRes.data,
    },
  };
}
