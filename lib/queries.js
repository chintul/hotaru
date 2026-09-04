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

export const FEATURED_PRODUCTS = gql`
  ${PRODUCT_CARD}
  query FeaturedProducts {
    productCollection(
      first: 8
      filter: { status: { eq: active } }
      orderBy: [{ position: AscNullsLast }]
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
            edges { node { title subtitle description careDetails } }
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
              node { id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity allowBackorder }
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
          placedAt paidAt trackingNumber shippingAddress customerNote
          deliveryMethod { name kind }
          orderItemCollection(first: 30) {
            edges { node { id productTitle variantLabel sku quantity unitPriceMnt lineTotalMnt } }
          }
        }
      }
    }
    storeSettingsCollection(first: 1) {
      edges {
        node { bankName bankAccountNumber bankAccountName paymentInstructions paymentDeadlineHours }
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
          paymentInstructions paymentDeadlineHours
          ownerAlertEmail storeEmail storePhone
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
      edges { node { id email phone fullName role marketingOptIn } }
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
