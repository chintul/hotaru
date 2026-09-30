# Extractable components

Candidates for Superdesign `DraftComponent` extraction. Only state/navigation props are listed —
icons, labels, Mongolian copy and all CSS classes stay hardcoded in the component.

The storefront has no component library. Visual primitives are CSS classes in `app/globals.css`
(`.btn-solid`, `.btn-outline`, `.nav-link`, `.label`, `.icon-btn`, `.swatch`, `.card-media`,
`.auth-input`, `.tap`, `.link-underline`), so an extracted component carries its markup plus those
class names rather than a props-driven design system.

## Layout components (on every storefront page)

### Header
- Source: `components/Header.jsx`
- Category: layout
- Description: Sticky bar — hamburger, wordmark, desktop nav with a "Дэлгүүр" dropdown, icon cluster (theme, search, account, wishlist, cart with count badge), and the grouped mobile panel.
- Extractable props: `categories` (array of `{href,label}`, from the server), `cartCount` (number, default 0), `isAuthenticated` (boolean, default false), `activePath` (string, default "/")
- Hardcoded: wordmark images, icon SVGs, "Нүүр / Дэлгүүр / Бидний тухай / Холбоо барих", the Дэлгүүр / Миний / Мэдээлэл group titles, all CSS

### Footer
- Source: `components/Footer.jsx`
- Category: layout
- Description: Dark band (`--color-footer`, dark in both themes) with link columns, store contact, socials and the newsletter form.
- Extractable props: `showContact` (boolean, default true), `showSocials` (boolean, default true)
- Hardcoded: column titles and links, icon SVGs, white-alpha text scale, all CSS

### AnnouncementBar
- Source: `components/AnnouncementBar.jsx`
- Category: layout
- Description: Looping marquee of delivery and promo lines, above the header.
- Extractable props: `lines` (array of strings)
- Hardcoded: marquee animation, emoji, all CSS

### CartDrawer
- Source: `components/CartDrawer.jsx`
- Category: layout
- Description: Right-hand drawer overlay — line items with quantity steppers, subtotal, "Захиалах" CTA, empty state.
- Extractable props: `open` (boolean, default false), `itemCount` (number, default 0), `isEmpty` (boolean, default true)
- Hardcoded: "Сагс", "Дүн", "Захиалах", "Сагс хоослох", icon SVGs, all CSS

### SearchOverlay
- Source: `components/SearchOverlay.jsx`
- Category: layout
- Description: Full-screen search with live results.
- Extractable props: `open` (boolean, default false), `hasResults` (boolean, default false)
- Hardcoded: placeholder copy, icon SVGs, all CSS

## Basic components (across pages)

### ProductCard
- Source: `components/ProductCard.jsx`
- Category: basic
- Description: Catalogue card — image with hover variant preview, title, price, colourway swatch row.
- Extractable props: `showSwatches` (boolean, default true), `onSale` (boolean, default false)
- Hardcoded: `.card-media` / `.swatch` classes, price formatting, "эхлэх үнэ" prefix

### ProductGrid
- Source: `components/ProductGrid.jsx`
- Category: basic
- Description: Responsive grid of ProductCard. Resolves to 2 columns at every width below `md`.
- Extractable props: `cols` (2 | 3 | 4, default 4 — only applies from `md` up), `isEmpty` (boolean, default false)
- Hardcoded: gap scale, empty-state copy

### SectionHeading
- Source: `components/SectionHeading.jsx`
- Category: basic
- Description: Centred uppercase `.section-title` with an underlined "Бүгдийг үзэх" link.
- Extractable props: `title` (string), `href` (string, optional)
- Hardcoded: `.section-title` / `.link-underline` classes, link copy

### CategoryRail
- Source: `components/CategoryRail.jsx`
- Category: basic
- Description: Horizontally scrolling circular category entry points.
- Extractable props: `categories` (array of `{href,label,imagePath}`)
- Hardcoded: circle sizing, scroll-snap, all CSS

### ProductImage
- Source: `components/ProductImage.jsx`
- Category: basic
- Description: ImageKit `<Image>` wrapper. Renders a deterministic slug-seeded tinted placeholder when the key or the photograph is missing — so a draft never shows a broken image.
- Extractable props: `filePath` (string | null), `seed` (string), `priority` (boolean, default false)
- Hardcoded: ImageKit transformation params, placeholder tint function

### ThemeToggle
- Source: `components/ThemeToggle.jsx`
- Category: basic
- Description: Single icon button flipping light/dark. Both icons sit in the DOM; CSS shows the one you would switch **to**, so it is correct before hydration.
- Extractable props: none (reads `useTheme`)
- Hardcoded: sun/moon SVGs, `.icon-btn`, `.theme-icon-*` classes

### ShopToolbar
- Source: `components/ShopToolbar.jsx`
- Category: basic
- Description: Result count, column switcher (hidden below `md`), sort select.
- Extractable props: `total` (number), `cols` (2 | 3 | 4), `sort` (string)
- Hardcoded: "Эрэмбэлэх" / "Харах" labels, sort option copy

### ShopFilters
- Source: `components/ShopFilters.jsx`
- Category: basic
- Description: Category, stock and price filters. A sheet on a phone, inline from `lg`.
- Extractable props: `open` (boolean, default false), `activeCategory` (string | null)
- Hardcoded: "ШҮҮХ" label, facet copy

### NewsletterForm
- Source: `components/NewsletterForm.jsx`
- Category: basic
- Description: Footer email capture with inline success and error states.
- Extractable props: `state` ("idle" | "sending" | "done" | "error", default "idle")
- Hardcoded: placeholder and confirmation copy

### Logo
- Source: `components/Logo.jsx`
- Category: basic
- Description: `hotaru.mn` wordmark. Two `<img>` tags; CSS shows the one matching the theme. The navy in the mark is the brand primary `#152b57`.
- Extractable props: `className` (string, for sizing)
- Hardcoded: both image sources, `.logo-light` / `.logo-dark` classes
