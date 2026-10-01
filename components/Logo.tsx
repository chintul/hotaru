interface LogoProps {
  className?: string
}

export default function Logo({ className = '' }: LogoProps) {
  return (
    <>
      <img
        src="/logo.png"
        alt="hotaru"
        width={1474}
        height={240}
        className={`logo-light ${className}`}
      />
      <img
        src="/logo-white.png"
        alt="hotaru"
        width={1523}
        height={240}
        className={`logo-dark ${className}`}
      />
    </>
  )
}
