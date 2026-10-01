export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return <div className="min-h-screen bg-shade">{children}</div>
}
