import { gql } from '@apollo/client'

/**
 * Every document the app sends. Mirrors graphql/operations/*.graphql.
 *
 * Note the shape: pg_graphql returns Relay connections everywhere, so almost
 * everything is edges/node. Use `nodes()` from lib/format to unwrap.
 */

export const PRODUCT_CARD = gql`
  fragment ProductCard on Product {
    id
    slug
    minPriceMnt
    maxPriceMnt
    inStock
    ratingAvg
    ratingCount
    productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
      edges { node { title subtitle } }
    }
    productImageCollection(first: 2, orderBy: [{ position: AscNullsLast }]) {
      edges { node { filePath alt width height position } }
    }
    # Cards show a colour-swatch row and the active variant's name in a pill,
    # so the grid query has to carry variants too.
    variantCollection(first: 8, filter: { isActive: { eq: true } }, orderBy: [{ position: AscNullsLast }]) {
      edges { node { id optionLabel optionValue priceMnt quantity allowBackorder image { filePath alt } } }
    }
  }
`

export const CATALOG_PAGE = gql`
  ${PRODUCT_CARD}
  query CatalogPage($first: Int = 24, $after: Cursor) {
    productCollection(
      first: $first
      after: $after
      filter: { status: { eq: active } }
      orderBy: [{ position: AscNullsLast }]
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { node { ...ProductCard } }
    }
  }
`

// Two distinct shelves. These used to carry the same filter and the same
// ordering, so the home page printed one list twice under two headings —
// "featured" ignored products.is_featured entirely, and "new arrivals" was
// never sorted by date.
export const FEATURED_PRODUCTS = gql`
  ${PRODUCT_CARD}
  query FeaturedProducts {
    productCollection(
      first: 8
      filter: { status: { eq: active }, isFeatured: { eq: true } }
      orderBy: [{ position: AscNullsLast }]
    ) {
      edges { node { ...ProductCard } }
    }
  }
`

export const NEW_ARRIVALS = gql`
  ${PRODUCT_CARD}
  query NewArrivals($first: Int = 8) {
    productCollection(
      first: $first
      filter: { status: { eq: active } }
      orderBy: [{ createdAt: DescNullsLast }]
    ) {
      edges { node { ...ProductCard } }
    }
  }
`

export const NAV_CATEGORIES = gql`
  query NavCategories {
    categoryCollection(first: 20, orderBy: [{ position: AscNullsLast }]) {
      edges {
        node {
          id
          slug
          imagePath
          categoryTranslationCollection(first: 1) { edges { node { name } } }
        }
      }
    }
  }
`

export const PRODUCT_DETAIL = gql`
  query ProductDetail($slug: String!) {
    productCollection(first: 1, filter: { slug: { eq: $slug } }) {
      edges {
        node {
          id
          slug
          inStock
          ratingAvg
          ratingCount
          minPriceMnt
          productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
            edges { node { title subtitle description careDetails seoTitle seoDescription } }
          }
          productImageCollection(first: 12, orderBy: [{ position: AscNullsLast }]) {
            edges { node { filePath alt width height position } }
          }
          variantCollection(
            first: 20
            filter: { isActive: { eq: true } }
            orderBy: [{ position: AscNullsLast }]
          ) {
            edges {
              node {
                id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity allowBackorder
                image { id filePath alt }
              }
            }
          }
          reviewCollection(first: 10, filter: { isApproved: { eq: true } }) {
            totalCount
            edges { node { id rating title body isVerifiedPurchase createdAt } }
          }
        }
      }
    }
  }
`

export const SEARCH_PRODUCTS = gql`
  ${PRODUCT_CARD}
  query SearchProducts($term: String!, $first: Int = 8) {
    searchProducts(term: $term, first: $first) {
      edges { node { ...ProductCard } }
    }
  }
`

export const CART_CONTENTS = gql`
  fragment CartContents on Cart {
    id
    status
    updatedAt
    cartItemCollection(first: 50) {
      edges {
        node {
          id
          quantity
          variant {
            id
            sku
            optionLabel
            optionValue
            priceMnt
            quantity
            allowBackorder
            product {
              slug
              productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
                edges { node { title } }
              }
              productImageCollection(first: 1, orderBy: [{ position: AscNullsLast }]) {
                edges { node { filePath alt } }
              }
            }
          }
        }
      }
    }
  }
`

export const MY_CART = gql`
  ${CART_CONTENTS}
  query MyCart($profileId: UUID!) {
    cartCollection(
      first: 1
      filter: { status: { eq: "open" }, profileId: { eq: $profileId } }
    ) {
      edges { node { ...CartContents } }
    }
  }
`

export const ADD_TO_CART = gql`
  ${CART_CONTENTS}
  mutation AddToCart($variantId: UUID!, $quantity: Int = 1) {
    addToCart(variantId: $variantId, quantity: $quantity) { ...CartContents }
  }
`

export const SET_CART_QTY = gql`
  ${CART_CONTENTS}
  mutation SetCartItemQuantity($variantId: UUID!, $quantity: Int!) {
    setCartItemQuantity(variantId: $variantId, quantity: $quantity) { ...CartContents }
  }
`

export const CLEAR_CART = gql`
  ${CART_CONTENTS}
  mutation ClearCart { clearCart { ...CartContents } }
`

export const CHECKOUT_CONTEXT = gql`
  query CheckoutContext($profileId: UUID!) {
    deliveryMethodCollection(first: 10, orderBy: [{ position: AscNullsLast }]) {
      edges { node { id code name kind feeMnt note } }
    }
    addressCollection(first: 10, filter: { profileId: { eq: $profileId } }) {
      edges {
        node {
          id label recipientName phone cityAimag districtSum
          khorooBag building entrance apartment landmarkNote isDefault
        }
      }
    }
    storeSettingsCollection(first: 1) {
      edges {
        node {
          bankName bankAccountNumber bankAccountName
          paymentInstructions paymentDeadlineHours
          qpayEnabled
        }
      }
    }
  }
`

export const PLACE_ORDER = gql`
  mutation PlaceOrder(
    $addressId: UUID!
    $deliveryMethodId: UUID!
    $discountCode: String
    $customerNote: String
  ) {
    placeOrder(
      addressId: $addressId
      deliveryMethodId: $deliveryMethodId
      discountCode: $discountCode
      customerNote: $customerNote
    ) {
      id orderNumber status paymentStatus
      subtotalMnt discountMnt deliveryMnt totalMnt
    }
  }
`

export const SUBMIT_PAYMENT_PROOF = gql`
  mutation SubmitPaymentProof($orderId: UUID!, $externalReference: String, $payerNote: String) {
    submitPaymentProof(orderId: $orderId, externalReference: $externalReference, payerNote: $payerNote) {
      id orderNumber status paymentStatus
    }
  }
`

export const MY_ORDERS = gql`
  query MyOrders($profileId: UUID!, $first: Int = 20) {
    orderCollection(
      first: $first
      filter: { profileId: { eq: $profileId } }
      orderBy: [{ placedAt: DescNullsLast }]
    ) {
      totalCount
      edges {
        node {
          id orderNumber status paymentStatus totalMnt placedAt trackingNumber
          deliveryMethod { name kind }
          orderItemCollection(first: 20) {
            edges { node { id productTitle variantLabel quantity unitPriceMnt lineTotalMnt } }
          }
        }
      }
    }
  }
`

export const ORDER_DETAIL = gql`
  query OrderDetail($orderNumber: String!, $profileId: UUID!) {
    orderCollection(
      first: 1
      filter: { orderNumber: { eq: $orderNumber }, profileId: { eq: $profileId } }
    ) {
      edges {
        node {
          id orderNumber status paymentStatus
          subtotalMnt discountMnt deliveryMnt totalMnt
          placedAt paidAt shippedAt cancelledAt
          trackingNumber shippingAddress customerNote
          deliveryMethod { name kind }
          orderItemCollection(first: 30) {
            edges {
              node {
                id productTitle variantLabel sku quantity unitPriceMnt lineTotalMnt
                # The line's own image snapshot, not the product's current one:
                # the page must keep showing what was actually bought after the
                # product is re-shot or deleted.
                imagePath
              }
            }
          }
        }
      }
    }
    storeSettingsCollection(first: 1) {
      edges {
        node {
          bankName bankAccountNumber bankAccountName paymentInstructions paymentDeadlineHours
          qpayEnabled
        }
      }
    }
  }
`

export const CREATE_ADDRESS = gql`
  mutation CreateAddress($objects: [AddressInsertInput!]!) {
    insertIntoAddressCollection(objects: $objects) {
      records {
        id label recipientName phone cityAimag districtSum
        khorooBag building entrance apartment landmarkNote isDefault
      }
    }
  }
`

export const MY_WISHLIST = gql`
  ${PRODUCT_CARD}
  query MyWishlist {
    wishlistItemCollection(first: 50) {
      edges { node { createdAt product { ...ProductCard } } }
    }
  }
`

export const TOGGLE_WISHLIST = gql`
  mutation ToggleWishlist($productId: UUID!) { toggleWishlist(productId: $productId) }
`

export const SUBMIT_REVIEW = gql`
  mutation SubmitReview($productId: UUID!, $rating: Int!, $title: String, $body: String) {
    submitReview(productId: $productId, rating: $rating, title: $title, body: $body) {
      id rating title body isApproved isVerifiedPurchase
    }
  }
`

/* ---------------------------------- admin --------------------------------- */

export const ADMIN_PENDING = gql`
  query AdminPending {
    awaiting: orderCollection(
      first: 50
      filter: { status: { eq: awaiting_payment } }
      orderBy: [{ placedAt: AscNullsLast }]
    ) {
      totalCount
      edges {
        node {
          id orderNumber email phone totalMnt placedAt paymentStatus customerNote shippingAddress
          deliveryMethod { name }
          orderItemCollection(first: 30) {
            edges { node { id productTitle variantLabel sku quantity unitPriceMnt lineTotalMnt } }
          }
        }
      }
    }
    oversold: orderCollection(first: 20, filter: { status: { eq: oversold } }) {
      totalCount
      edges { node { id orderNumber email phone totalMnt placedAt } }
    }
  }
`

export const ADMIN_ALL_ORDERS = gql`
  query AdminAllOrders($first: Int = 50) {
    orderCollection(first: $first, orderBy: [{ placedAt: DescNullsLast }]) {
      totalCount
      edges {
        node { id orderNumber email phone status paymentStatus totalMnt placedAt trackingNumber }
      }
    }
  }
`

export const CONFIRM_PAYMENT = gql`
  mutation ConfirmPayment($orderId: UUID!, $externalReference: String) {
    confirmPayment(orderId: $orderId, externalReference: $externalReference) {
      id orderNumber status paymentStatus paidAt
    }
  }
`

export const CANCEL_ORDER = gql`
  mutation CancelOrder($orderId: UUID!, $reason: String) {
    cancelOrder(orderId: $orderId, reason: $reason) { id orderNumber status }
  }
`

export const ADMIN_INVENTORY = gql`
  query AdminInventory($first: Int = 100) {
    productCollection(first: $first, orderBy: [{ position: AscNullsLast }]) {
      totalCount
      edges {
        node {
          id slug status isFeatured minPriceMnt inStock publishedAt
          productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
            edges { node { title } }
          }
          variantCollection(first: 20, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id sku optionLabel optionValue priceMnt quantity isActive } }
          }
        }
      }
    }
  }
`

export const ADMIN_SETTINGS = gql`
  query AdminSettings {
    storeSettingsCollection(first: 1) {
      edges {
        node {
          bankName bankAccountNumber bankAccountName bankSwift
          bankCode qpayMerchantId qpayEnabled
          paymentInstructions paymentDeadlineHours
          ownerAlertEmail storeEmail storePhone storeAddress
          facebookUrl instagramUrl
          heroImagePath heroHeadline heroSubline heroCtaLabel heroCtaHref
        }
      }
    }
  }
`

export const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($set: StoreSettingsUpdateInput!) {
    updateStoreSettingsCollection(set: $set, atMost: 1) {
      affectedCount
      records { bankName bankAccountNumber bankAccountName paymentInstructions }
    }
  }
`

export const ME = gql`
  query Me($id: UUID!) {
    profileCollection(first: 1, filter: { id: { eq: $id } }) {
      edges { node { id email phone fullName role marketingOptIn phoneVerifiedAt } }
    }
  }
`

export const ISSUE_CART_TRANSFER = gql`
  mutation IssueCartTransfer { issueCartTransferToken }
`

export const REDEEM_CART_TRANSFER = gql`
  ${CART_CONTENTS}
  mutation RedeemCartTransfer($token: UUID!) {
    redeemCartTransfer(token: $token) { ...CartContents }
  }
`

// One round trip for a category page: resolve the slug and pull its products
// through the reverse FK rather than fetching the id first.
export const CATALOG_BY_CATEGORY = gql`
  ${PRODUCT_CARD}
  query CatalogByCategory($slug: String!, $first: Int = 24) {
    categoryCollection(first: 1, filter: { slug: { eq: $slug } }) {
      edges {
        node {
          id
          slug
          categoryTranslationCollection(first: 1) { edges { node { name description } } }
          productCollection(
            first: $first
            filter: { status: { eq: active } }
            orderBy: [{ position: AscNullsLast }]
          ) {
            totalCount
            edges { node { ...ProductCard } }
          }
        }
      }
    }
  }
`

export const ADMIN_ADD_IMAGE = gql`
  mutation AdminAddImage(
    $productId: UUID!
    $imagekitFileId: String!
    $filePath: String!
    $alt: String
    $width: Int
    $height: Int
  ) {
    adminAddProductImage(
      productId: $productId
      imagekitFileId: $imagekitFileId
      filePath: $filePath
      alt: $alt
      width: $width
      height: $height
    ) {
      id filePath alt position width height
    }
  }
`

export const ADMIN_DELETE_IMAGE = gql`
  mutation AdminDeleteImage($imageId: UUID!) { adminDeleteProductImage(imageId: $imageId) }
`

export const ADMIN_REORDER_IMAGES = gql`
  mutation AdminReorderImages($productId: UUID!, $imageIds: [UUID!]!) {
    adminReorderProductImages(productId: $productId, imageIds: $imageIds) {
      edges { node { id position filePath } }
    }
  }
`

// Flexible catalog query: the page builds the filter object from URL params so
// sorting and filtering stay server-side (cacheable) instead of shipping the
// whole catalog to the browser to slice it there.
export const CATALOG_FILTERED = gql`
  ${PRODUCT_CARD}
  query CatalogFiltered($first: Int = 24, $filter: ProductFilter, $orderBy: [ProductOrderBy!]) {
    productCollection(first: $first, filter: $filter, orderBy: $orderBy) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { node { ...ProductCard } }
    }
  }
`

/* ------------------------- admin write mutations ------------------------- */

export const ADMIN_SET_ORDER_STATUS = gql`
  mutation AdminSetOrderStatus($orderId: UUID!, $status: String!, $trackingNumber: String, $internalNote: String) {
    adminSetOrderStatus(orderId: $orderId, status: $status, trackingNumber: $trackingNumber, internalNote: $internalNote) {
      id orderNumber status trackingNumber shippedAt
    }
  }
`

export const ADMIN_MARK_REFUNDED = gql`
  mutation AdminMarkRefunded($orderId: UUID!, $note: String) {
    adminMarkRefunded(orderId: $orderId, note: $note) { id orderNumber status paymentStatus }
  }
`

export const ADMIN_UPSERT_PRODUCT = gql`
  mutation AdminUpsertProduct(
    $slug: String!, $title: String!, $categorySlug: String, $subtitle: String,
    $description: String, $careDetails: String, $status: String, $isFeatured: Boolean,
    $sortOrder: Int, $productId: UUID, $seoTitle: String, $seoDescription: String
  ) {
    adminUpsertProduct(
      slug: $slug, title: $title, categorySlug: $categorySlug, subtitle: $subtitle,
      description: $description, careDetails: $careDetails, status: $status,
      isFeatured: $isFeatured, sortOrder: $sortOrder, productId: $productId,
      seoTitle: $seoTitle, seoDescription: $seoDescription
    ) { id slug status isFeatured }
  }
`

export const ADMIN_UPSERT_VARIANT = gql`
  mutation AdminUpsertVariant(
    $productId: UUID!, $priceMnt: BigInt!, $quantity: Int!, $sku: String,
    $optionLabel: String, $optionValue: String, $compareAtPriceMnt: BigInt,
    $allowBackorder: Boolean, $isActive: Boolean, $sortOrder: Int, $variantId: UUID,
    $imageId: UUID
  ) {
    adminUpsertVariant(
      productId: $productId, priceMnt: $priceMnt, quantity: $quantity, sku: $sku,
      optionLabel: $optionLabel, optionValue: $optionValue, compareAtPriceMnt: $compareAtPriceMnt,
      allowBackorder: $allowBackorder, isActive: $isActive, sortOrder: $sortOrder, variantId: $variantId,
      imageId: $imageId
    ) { id sku optionValue priceMnt quantity isActive image { id filePath alt } }
  }
`

// Separate from the upsert because the upsert coalesces a null imageId to the
// stored value — deliberately, so the row editor cannot blank a photo it never
// sent. This is therefore the only way to CLEAR a link: pass a null imageId.
export const ADMIN_SET_VARIANT_IMAGE = gql`
  mutation AdminSetVariantImage($variantId: UUID!, $imageId: UUID) {
    adminSetVariantImage(variantId: $variantId, imageId: $imageId) {
      id image { id filePath alt }
    }
  }
`

export const ADMIN_SET_STOCK = gql`
  mutation AdminSetStock($variantId: UUID!, $quantity: Int!) {
    adminSetStock(variantId: $variantId, quantity: $quantity) { id quantity }
  }
`

export const ADMIN_ARCHIVE_PRODUCT = gql`
  mutation AdminArchiveProduct($productId: UUID!) {
    adminArchiveProduct(productId: $productId) { id status }
  }
`

export const ADMIN_DELETE_VARIANT = gql`
  mutation AdminDeleteVariant($variantId: UUID!) { adminDeleteVariant(variantId: $variantId) }
`

export const ADMIN_UPSERT_DISCOUNT = gql`
  mutation AdminUpsertDiscount(
    $code: String!, $kind: String!, $value: BigFloat!, $minSubtotalMnt: BigInt,
    $usageLimit: Int, $isActive: Boolean, $discountId: UUID
  ) {
    adminUpsertDiscount(
      code: $code, kind: $kind, value: $value, minSubtotalMnt: $minSubtotalMnt,
      usageLimit: $usageLimit, isActive: $isActive, discountId: $discountId
    ) { id code kind value isActive timesUsed }
  }
`

export const ADMIN_SET_REVIEW_APPROVAL = gql`
  mutation AdminSetReviewApproval($reviewId: UUID!, $approved: Boolean!) {
    adminSetReviewApproval(reviewId: $reviewId, approved: $approved) { id isApproved }
  }
`

export const ADMIN_DELETE_REVIEW = gql`
  mutation AdminDeleteReview($reviewId: UUID!) { adminDeleteReview(reviewId: $reviewId) }
`

export const ADMIN_PRODUCTS = gql`
  query AdminProducts($first: Int = 100) {
    productCollection(first: $first, orderBy: [{ position: AscNullsLast }]) {
      totalCount
      edges {
        node {
          id slug status isFeatured position minPriceMnt inStock
          category { slug }
          productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
            edges { node { title subtitle description careDetails seoTitle seoDescription } }
          }
          variantCollection(first: 20, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity isActive } }
          }
          # Just the card image, so the list is scannable without loading a gallery.
          productImageCollection(first: 1, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id filePath } }
          }
        }
      }
    }
    categoryCollection(first: 30, orderBy: [{ position: AscNullsLast }]) {
      edges { node { id slug categoryTranslationCollection(first: 1) { edges { node { name } } } } }
    }
  }
`

export const ADMIN_DISCOUNTS = gql`
  query AdminDiscounts {
    discountCodeCollection(first: 100) {
      edges { node { id code kind value minSubtotalMnt usageLimit timesUsed isActive endsAt } }
    }
  }
`

export const ADMIN_REVIEWS = gql`
  query AdminReviews {
    reviewCollection(first: 100, orderBy: [{ createdAt: DescNullsLast }]) {
      totalCount
      edges {
        node {
          id rating title body isApproved isVerifiedPurchase createdAt
          product { slug productTranslationCollection(first: 1) { edges { node { title } } } }
        }
      }
    }
  }
`

export const ADMIN_ORDER_DETAIL = gql`
  query AdminOrderDetail($orderNumber: String!) {
    orderCollection(first: 1, filter: { orderNumber: { eq: $orderNumber } }) {
      edges {
        node {
          id orderNumber email phone status paymentStatus
          subtotalMnt discountMnt deliveryMnt totalMnt
          placedAt paidAt shippedAt cancelledAt trackingNumber
          shippingAddress customerNote internalNote
          deliveryMethod { name kind feeMnt }
          orderItemCollection(first: 50) {
            edges { node { id productTitle variantLabel sku imagePath quantity unitPriceMnt lineTotalMnt } }
          }
          paymentCollection(first: 5) {
            edges { node { id provider status amountMnt externalReference payerNote confirmedAt createdAt } }
          }
        }
      }
    }
  }
`

// How the store can be paid, for the copy that promises it. anon is granted
// this one column so a logged-out visitor's page can tell the truth.
export const PAYMENT_MODE = gql`
  query PaymentMode {
    storeSettingsCollection(first: 1) {
      edges { node { qpayEnabled } }
    }
  }
`

// How to reach the shop. Anon-visible columns only — the same row also holds
// the bank account, which is why this is its own query rather than a wider one.
export const STORE_CONTACT = gql`
  query StoreContact {
    storeSettingsCollection(first: 1) {
      edges { node { storeEmail storePhone storeAddress facebookUrl instagramUrl } }
    }
  }
`

// Hero lives in store_settings; anon can read only the presentation columns.
export const HERO = gql`
  query Hero {
    storeSettingsCollection(first: 1) {
      edges { node { heroImagePath heroHeadline heroSubline heroCtaLabel heroCtaHref } }
    }
  }
`

// One round trip for the account home: profile, recent orders and the counts
// the summary tiles show.
export const ACCOUNT_OVERVIEW = gql`
  query AccountOverview($id: UUID!) {
    profileCollection(first: 1, filter: { id: { eq: $id } }) {
      edges { node { id email phone fullName role marketingOptIn phoneVerifiedAt createdAt } }
    }
    orderCollection(first: 3, filter: { profileId: { eq: $id } }, orderBy: [{ placedAt: DescNullsLast }]) {
      totalCount
      edges {
        node {
          id orderNumber status paymentStatus totalMnt placedAt
          orderItemCollection(first: 3) { edges { node { id productTitle imagePath } } }
        }
      }
    }
    wishlistItemCollection(first: 50) { edges { node { productId } } }
    addressCollection(first: 20, filter: { profileId: { eq: $id } }) { edges { node { id } } }
  }
`

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($set: ProfileUpdateInput!) {
    updateProfileCollection(set: $set, atMost: 1) {
      affectedCount
      records { id fullName phone marketingOptIn }
    }
  }
`

/* ------------------------------ bulk actions ------------------------------ */
// One round trip per action instead of one per row. Orders are absent on
// purpose — their guards make partial failure normal, so they run row by row
// through lib/admin/bulk.js against the existing single-row mutations.

export const ADMIN_BULK_SET_PRODUCT_STATUS = gql`
  mutation AdminBulkSetProductStatus($productIds: [UUID!]!, $status: String!) {
    adminBulkSetProductStatus(productIds: $productIds, status: $status) {
      edges { node { id status isFeatured } }
    }
  }
`

export const ADMIN_BULK_SET_PRODUCT_FEATURED = gql`
  mutation AdminBulkSetProductFeatured($productIds: [UUID!]!, $isFeatured: Boolean!) {
    adminBulkSetProductFeatured(productIds: $productIds, isFeatured: $isFeatured) {
      edges { node { id isFeatured } }
    }
  }
`

export const ADMIN_BULK_SET_PRODUCT_CATEGORY = gql`
  mutation AdminBulkSetProductCategory($productIds: [UUID!]!, $categorySlug: String!) {
    adminBulkSetProductCategory(productIds: $productIds, categorySlug: $categorySlug) {
      edges { node { id category { slug } } }
    }
  }
`

export const ADMIN_BULK_DELETE_PRODUCTS = gql`
  mutation AdminBulkDeleteProducts($productIds: [UUID!]!) {
    adminBulkDeleteProducts(productIds: $productIds)
  }
`

export const ADMIN_BULK_SET_REVIEW_APPROVAL = gql`
  mutation AdminBulkSetReviewApproval($reviewIds: [UUID!]!, $approved: Boolean!) {
    adminBulkSetReviewApproval(reviewIds: $reviewIds, approved: $approved) {
      edges { node { id isApproved } }
    }
  }
`

export const ADMIN_BULK_DELETE_REVIEWS = gql`
  mutation AdminBulkDeleteReviews($reviewIds: [UUID!]!) {
    adminBulkDeleteReviews(reviewIds: $reviewIds)
  }
`

export const ADMIN_BULK_SET_DISCOUNT_ACTIVE = gql`
  mutation AdminBulkSetDiscountActive($discountIds: [UUID!]!, $isActive: Boolean!) {
    adminBulkSetDiscountActive(discountIds: $discountIds, isActive: $isActive) {
      edges { node { id isActive } }
    }
  }
`

export const ADMIN_BULK_DELETE_DISCOUNTS = gql`
  mutation AdminBulkDeleteDiscounts($discountIds: [UUID!]!) {
    adminBulkDeleteDiscounts(discountIds: $discountIds)
  }
`


// One product, everything the editor's four tabs need, plus the category list
// for the details select.
export const ADMIN_PRODUCT_DETAIL = gql`
  query AdminProductDetail($productId: UUID!) {
    productCollection(filter: { id: { eq: $productId } }, first: 1) {
      edges {
        node {
          id slug status isFeatured position minPriceMnt inStock
          category { slug }
          productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
            edges { node { title subtitle description careDetails seoTitle seoDescription } }
          }
          variantCollection(first: 50, orderBy: [{ position: AscNullsLast }]) {
            edges { node {
              id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity isActive
              # position and allowBackorder are not display fields — they are here
              # because admin_upsert_variant ASSIGNS every column except image_id
              # rather than coalescing. A row editor that omits position collapses
              # every edited variant to the front of the swatch row; one that omits
              # allowBackorder silently turns backorder off.
              allowBackorder position
              image { id filePath alt }
            } }
          }
          productImageCollection(first: 24, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id filePath alt position width height } }
          }
        }
      }
    }
    categoryCollection(first: 30, orderBy: [{ position: AscNullsLast }]) {
      edges { node { id slug categoryTranslationCollection(first: 1) { edges { node { name } } } } }
    }
  }
`
