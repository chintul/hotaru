export type Mnt = string | number

export type Json = string | Record<string, unknown> | null

export interface Edge<T> {
  node: T
}

export interface Connection<T> {
  edges?: Edge<T>[] | null
  totalCount?: number | null
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'deposit_paid'
  | 'awaiting_balance'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'oversold'

export type ProductStatus = 'draft' | 'active' | 'archived'

export type PaymentStatus = 'unpaid' | 'submitted' | 'partially_paid' | 'confirmed' | 'failed' | 'refunded'

export type PaymentKind = 'full' | 'deposit' | 'balance'

export interface ProductTranslation {
  title?: string | null
  subtitle?: string | null
  description?: string | null
  careDetails?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
}

export interface ProductImage {
  id?: string
  filePath: string
  alt?: string | null
  width?: number | null
  height?: number | null
  position?: number | null
}

export interface Variant {
  id: string
  sku?: string | null
  optionLabel?: string | null
  optionValue?: string | null
  priceMnt?: Mnt | null
  compareAtPriceMnt?: Mnt | null
  quantity?: number | null
  allowBackorder?: boolean | null
  isActive?: boolean | null
  position?: number | null
  image?: ProductImage | null
  product?: Product | null
}

export interface Review {
  id: string
  rating: number
  title?: string | null
  body?: string | null
  isApproved?: boolean | null
  isVerifiedPurchase?: boolean | null
  createdAt?: string | null
  product?: Product | null
}

export interface Product {
  id?: string
  slug: string
  status?: ProductStatus | null
  isFeatured?: boolean | null
  position?: number | null
  minPriceMnt?: Mnt | null
  maxPriceMnt?: Mnt | null
  inStock?: boolean | null
  ratingAvg?: number | string | null
  ratingCount?: number | null
  publishedAt?: string | null
  preorderDepositPct?: number | null
  preorderEta?: string | null
  category?: { slug: string } | null
  productTranslationCollection?: Connection<ProductTranslation> | null
  productImageCollection?: Connection<ProductImage> | null
  variantCollection?: Connection<Variant> | null
  reviewCollection?: Connection<Review> | null
}

export interface CategoryTranslation {
  name?: string | null
  description?: string | null
}

export interface Category {
  id?: string
  slug: string
  position?: number | null
  isVisible?: boolean | null
  parent?: { id?: string; slug: string } | null
  imagePath?: string | null
  categoryTranslationCollection?: Connection<CategoryTranslation> | null
  productCollection?: Connection<Product> | null
}

export interface CartItem {
  id: string
  quantity: number
  variant?: Variant | null
}

export interface Cart {
  id: string
  status?: string | null
  updatedAt?: string | null
  cartItemCollection?: Connection<CartItem> | null
}

export interface DeliveryMethod {
  id?: string
  code?: string | null
  name?: string | null
  kind?: string | null
  feeMnt?: Mnt | null
  note?: string | null
}

export interface Address {
  id: string
  label?: string | null
  recipientName?: string | null
  phone?: string | null
  cityAimag?: string | null
  districtSum?: string | null
  khorooBag?: string | null
  building?: string | null
  entrance?: string | null
  apartment?: string | null
  landmarkNote?: string | null
  isDefault?: boolean | null
}

export interface AddressSnapshot {
  recipient_name?: string | null
  phone?: string | null
  city_aimag?: string | null
  district_sum?: string | null
  khoroo_bag?: string | null
  building?: string | null
  entrance?: string | null
  apartment?: string | null
  landmark_note?: string | null
}

export interface OrderItem {
  id: string
  productTitle?: string | null
  variantLabel?: string | null
  sku?: string | null
  imagePath?: string | null
  quantity?: number | null
  unitPriceMnt?: Mnt | null
  lineTotalMnt?: Mnt | null
  isPreorder?: boolean | null
  depositPct?: number | null
  preorderEta?: string | null
}

export interface Payment {
  id: string
  provider?: string | null
  status?: string | null
  kind?: PaymentKind | null
  amountMnt?: Mnt | null
  externalReference?: string | null
  payerNote?: string | null
  confirmedAt?: string | null
  createdAt?: string | null
}

export interface Order {
  id: string
  orderNumber: string
  email?: string | null
  phone?: string | null
  status?: OrderStatus | null
  paymentStatus?: PaymentStatus | null
  subtotalMnt?: Mnt | null
  discountMnt?: Mnt | null
  deliveryMnt?: Mnt | null
  totalMnt?: Mnt | null
  upfrontMnt?: Mnt | null
  balanceMnt?: Mnt | null
  minUpfrontMnt?: Mnt | null
  placedAt?: string | null
  paidAt?: string | null
  balanceRequestedAt?: string | null
  balancePaidAt?: string | null
  shippedAt?: string | null
  cancelledAt?: string | null
  trackingNumber?: string | null
  shippingAddress?: Json
  customerNote?: string | null
  internalNote?: string | null
  deliveryMethod?: DeliveryMethod | null
  orderItemCollection?: Connection<OrderItem> | null
  paymentCollection?: Connection<Payment> | null
}

export interface StoreSettings {
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  bankSwift?: string | null
  bankCode?: string | null
  qpayMerchantId?: string | null
  qpayEnabled?: boolean | null
  paymentInstructions?: string | null
  paymentDeadlineHours?: number | null
  ownerAlertEmail?: string | null
  storeEmail?: string | null
  storePhone?: string | null
  storeAddress?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  heroImagePath?: string | null
  heroHeadline?: string | null
  heroSubline?: string | null
  heroCtaLabel?: string | null
  heroCtaHref?: string | null
}

export interface Profile {
  id: string
  email?: string | null
  phone?: string | null
  fullName?: string | null
  role?: string | null
  marketingOptIn?: boolean | null
  phoneVerifiedAt?: string | null
  createdAt?: string | null
}

export interface Discount {
  id: string
  code: string
  kind: string
  value: string | number
  minSubtotalMnt?: Mnt | null
  usageLimit?: number | null
  timesUsed?: number | null
  isActive?: boolean | null
  endsAt?: string | null
}

export interface WishlistItem {
  createdAt?: string | null
  productId?: string
  product?: Product | null
}
