# Routes

File-based routing, Next.js App Router. Three groups:

- `app/(shop)/` — storefront, wrapped in `app/(shop)/layout.js` (header, footer, overlays)
- `app/(auth)/` — sign-in, no storefront chrome
- `app/admin/` — operations console behind `AdminGate` + `AdminShell`, opts out of storefront chrome

`app/layout.js` is the root for all three: document, Poppins, theme boot script, Apollo/Theme/UI providers.


| URL | File | Layout | Render |
|---|---|---|---|
| `/` | `app/(shop)/page.js` | `(shop)` | static |
| `/shop` | `app/(shop)/shop/page.js` | `(shop)` | dynamic (searchParams) |
| `/shop/[slug]` | `app/(shop)/shop/[slug]/page.js` | `(shop)` | SSG via generateStaticParams |
| `/checkout` | `app/(shop)/checkout/page.js` | `(shop)` | static shell, client data |
| `/orders` | `app/(shop)/orders/page.js` | `(shop)` | static shell, client data |
| `/orders/[orderNumber]` | `app/(shop)/orders/[orderNumber]/page.js` | `(shop)` | dynamic |
| `/account` | `app/(shop)/account/page.js` | `(shop)` | static shell, client data |
| `/wishlist` | `app/(shop)/wishlist/page.js` | `(shop)` | static shell, client data |
| `/about` | `app/(shop)/about/page.js` | `(shop)` | static |
| `/contact` | `app/(shop)/contact/page.js` | `(shop)` | static |
| `/faq` | `app/(shop)/faq/page.js` | `(shop)` | static |
| `/shipping` | `app/(shop)/shipping/page.js` | `(shop)` | static |
| `/returns` | `app/(shop)/returns/page.js` | `(shop)` | static |
| `/login` | `app/(auth)/login/page.js` | `(auth)` | static |
| `/admin` | `app/admin/page.js` | `admin` | client |
| `/admin/products` | `app/admin/products/page.js` | `admin` | client |
| `/admin/products/new` | `app/admin/products/new/page.js` | `admin` | client |
| `/admin/products/[id]` | `app/admin/products/[id]/page.js` | `admin` | client |
| `/admin/orders/[orderNumber]` | `app/admin/orders/[orderNumber]/page.js` | `admin` | client |
| `/admin/discounts` | `app/admin/discounts/page.js` | `admin` | client |
| `/admin/reviews` | `app/admin/reviews/page.js` | `admin` | client |
| `/admin/settings` | `app/admin/settings/page.js` | `admin` | client |

Copy is Mongolian throughout the storefront. Money is whole tugrik (`bigint`, no minor unit).