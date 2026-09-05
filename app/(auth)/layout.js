/**
 * Auth screens carry no shop chrome.
 *
 * A header full of category links and a cart icon on a sign-in page is an
 * invitation to wander off at the exact moment the shopper is one step from
 * ordering. The reference does the same: its login is a bare hosted page.
 */
export default function AuthLayout({ children }) {
  return <div className="min-h-screen bg-shade">{children}</div>
}
