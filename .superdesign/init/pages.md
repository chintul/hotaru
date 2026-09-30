# Pages — component dependency trees

Each tree is the **candidate set** of `--context-file` paths for designing that page.
Apply the PAYLOAD BUDGET rules before passing them all.
Every storefront page also sits inside `app/layout.js` → `app/(shop)/layout.js`
(header, footer, cart drawer, search overlay), listed in `layouts.md`.

## /
Entry: `app/(shop)/page.js`
Home — hero, category rail, featured products.
Dependencies:
```
- lib/apollo/safeQuery.js
  - lib/apollo/rsc.js
- lib/queries.js
- lib/format.js
- lib/payment-copy.js
  - lib/apollo/safeQuery.js  (seen)
  - lib/queries.js  (seen)
  - lib/format.js  (seen)
- components/ProductImage.jsx
- components/ProductGrid.jsx
  - components/ProductCard.jsx
    - lib/format.js  (seen)
    - components/ProductImage.jsx  (seen)
    - components/useCanHover.js
- components/SectionHeading.jsx
- components/CategoryRail.jsx
  - lib/format.js  (seen)
  - components/ProductImage.jsx  (seen)
```

## /shop
Entry: `app/(shop)/shop/page.js`
Catalogue with filters, toolbar and grid.
Dependencies:
```
- lib/apollo/safeQuery.js
  - lib/apollo/rsc.js
- lib/queries.js
- lib/format.js
- components/ProductGrid.jsx
  - components/ProductCard.jsx
    - lib/format.js  (seen)
    - components/ProductImage.jsx
    - components/useCanHover.js
- components/ShopFilters.jsx
  - components/Icons.jsx
  - components/UIProvider.jsx
  - components/useFocusTrap.js
- components/ShopToolbar.jsx
  - components/Icons.jsx  (seen)
```

## /shop/[slug]
Entry: `app/(shop)/shop/[slug]/page.js`
Product detail — gallery, variants, buy row, reviews.
Dependencies:
```
- lib/apollo/safeQuery.js
  - lib/apollo/rsc.js
- lib/queries.js
- lib/format.js
- components/ProductDetailClient.jsx
  - lib/format.js  (seen)
  - lib/queries.js  (seen)
  - lib/supabase/browser.js
  - components/useCart.js
    - lib/queries.js  (seen)
    - lib/format.js  (seen)
    - lib/supabase/browser.js  (seen)
    - components/useSession.js
      - lib/supabase/browser.js  (seen)
    - components/UIProvider.jsx
  - components/UIProvider.jsx  (seen)
  - components/ProductImage.jsx
  - components/Icons.jsx
- components/ReviewForm.jsx
  - lib/queries.js  (seen)
  - lib/format.js  (seen)
  - components/useSession.js  (seen)
- lib/payment-copy.js
  - lib/apollo/safeQuery.js  (seen)
  - lib/queries.js  (seen)
  - lib/format.js  (seen)
```

## /checkout
Entry: `app/(shop)/checkout/page.js`
Address, delivery method, payment rail.
Dependencies:
```
- lib/queries.js
- lib/format.js
- components/useCart.js
  - lib/queries.js  (seen)
  - lib/format.js  (seen)
  - lib/supabase/browser.js
  - components/useSession.js
    - lib/supabase/browser.js  (seen)
  - components/UIProvider.jsx
- components/useSession.js  (seen)
- components/ProductImage.jsx
```

## /orders
Entry: `app/(shop)/orders/page.js`
Order list.
Dependencies:
```
- lib/queries.js
- lib/format.js
- components/useSession.js
  - lib/supabase/browser.js
```

## /orders/[orderNumber]
Entry: `app/(shop)/orders/[orderNumber]/page.js`
Order detail, payment modal, trail.
Dependencies:
```
- lib/queries.js
- lib/format.js
- components/useSession.js
  - lib/supabase/browser.js
- components/ProductImage.jsx
- components/Icons.jsx
- app/(shop)/orders/[orderNumber]/../_components/OrderSkeleton.jsx
- app/(shop)/orders/[orderNumber]/../_components/OrderTrail.jsx
  - lib/format.js  (seen)
  - components/Icons.jsx  (seen)
- app/(shop)/orders/[orderNumber]/../_components/PaymentModal.jsx
  - lib/format.js  (seen)
  - components/Icons.jsx  (seen)
  - app/(shop)/orders/[orderNumber]/../_components/CopyRow.jsx
    - components/Icons.jsx  (seen)
- app/(shop)/orders/[orderNumber]/../_components/useCountdown.js
```

## /account
Entry: `app/(shop)/account/page.js`
Profile, addresses, recent orders.
Dependencies:
```
- lib/queries.js
- lib/format.js
- components/useSession.js
  - lib/supabase/browser.js
- components/useAuthUpgrade.js
  - lib/queries.js  (seen)
  - lib/supabase/browser.js  (seen)
- components/PhoneVerify.jsx
  - lib/queries.js  (seen)
  - lib/supabase/browser.js  (seen)
- components/ProductImage.jsx
```

## /wishlist
Entry: `app/(shop)/wishlist/page.js`
Saved products.
Dependencies:
```
- lib/queries.js
- lib/format.js
- components/ProductGrid.jsx
  - components/ProductCard.jsx
    - lib/format.js  (seen)
    - components/ProductImage.jsx
    - components/useCanHover.js
- components/useSession.js
  - lib/supabase/browser.js
```

## /login
Entry: `app/(auth)/login/page.js`
Phone OTP / email OTP / OAuth.
Dependencies:
```
- components/useSession.js
  - lib/supabase/browser.js
- components/PhoneVerify.jsx
  - lib/queries.js
  - lib/supabase/browser.js  (seen)
- components/EmailOtp.jsx
  - lib/queries.js  (seen)
  - lib/supabase/browser.js  (seen)
- components/OAuthButtons.jsx
  - lib/queries.js  (seen)
  - lib/supabase/browser.js  (seen)
  - components/CartHandoff.jsx
    - lib/queries.js  (seen)
    - components/useSession.js  (seen)
- components/CartHandoff.jsx  (seen)
- components/Logo.jsx
```

## /about
Entry: `app/(shop)/about/page.js`
Static brand page.
Dependencies:
```
- app/(shop)/about/../_components/Prose.jsx
```
