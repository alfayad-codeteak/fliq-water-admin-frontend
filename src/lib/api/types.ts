/** Aligns with admin-panel-api.md DTOs (field names may vary slightly per backend). */

export type ApiRole = "owner" | "admin" | "customer";

export const FEATURE_KEYS = [
  "products",
  "orders",
  "addresses",
  "customers",
  "dashboard",
  "reports",
  "deposits",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type AuthUserDto = {
  id: string;
  phone: string;
  name: string;
  role: ApiRole;
  permissions?: FeatureKey[];
};

export type AuthResponseDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserDto;
};

export type AdminUserDto = {
  id: string;
  phone: string;
  name: string;
  role: "admin";
  permissions: FeatureKey[];
  createdAt: string;
};

export type ProductDto = {
  id: string;
  name: string;
  price: number;
  stock: number;
  hasDeposit?: boolean;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
  category?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BulkUpdateProductItemDto = {
  id: string;
  price: number;
  stock: number;
};

export type BulkUpdateProductsRequestDto = {
  items: BulkUpdateProductItemDto[];
};

export type BulkUpdateProductsResponseDto = {
  count: number;
  products: ProductDto[];
};

/** Snippet on orders when a delivery partner is assigned */
export type OrderDeliveryPartnerSnippetDto = {
  id: string;
  userId: string;
  name: string;
  phone: string;
};

export type DeliveryPartnerDto = {
  id: string;
  userId?: string;
  phone: string;
  name: string;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  isAvailable?: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrderItemDto = {
  id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
};

export type OrderDto = {
  id: string;
  status: string;
  statusLabel?: string;
  depositEnabled?: boolean;
  ifCanRefund?: boolean;
  returnedCanCount?: number;
  createdAt: string;
  timeSlot?: string | null;
  items?: OrderItemDto[];
  address?: Record<string, unknown>;
  user?: { id?: string; phone?: string; name?: string };
  total?: number;
  amount?: number;
  totalAmount?: number;
  depositCharge?: number;
  depositDiscount?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
  deposit?: {
    charge?: number;
    discount?: number;
    refundedAmount?: number;
    refunded?: boolean;
  };
  /** Last-mile pipeline (separate from warehouse `status`) */
  deliveryPartnerId?: string | null;
  assignedAt?: string | null;
  deliveryStatus?: string;
  deliveryNotes?: string | null;
  deliveryPartner?: OrderDeliveryPartnerSnippetDto | null;
};

export type DepositTierDto = {
  minQty: number;
  discountPercent: number;
};

export type DepositConfigDto = {
  enabled?: boolean;
  perCanAmount: number;
  promoStartsAt?: string | null;
  promoEndsAt?: string | null;
  tiers?: DepositTierDto[];
};

export type WalletDto = {
  userId?: string;
  balance: number;
  updatedAt?: string;
};

export type CustomerRowDto = {
  id: string;
  phone: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  orderCount?: number;
  addressCount?: number;
};

export type PaginatedCustomersDto = {
  data: CustomerRowDto[];
  total: number;
  page: number;
  limit: number;
};
