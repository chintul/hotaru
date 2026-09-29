import { Poppins } from "next/font/google";
import "./globals.css";
import { ApolloWrapper } from "@/lib/apollo/ApolloWrapper";
import { UIProvider } from "@/components/UIProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
// From lib/, not from ThemeProvider: that file is 'use client', and a constant
// imported across that boundary arrives here as undefined. See lib/theme.js.
import { THEME_KEY } from "@/lib/theme";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  title: { default: "hotaru", template: "%s · hotaru" },
  description: "Өдөр тутмын хэрэглээний загварлаг бүтээгдэхүүн.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [57, 60, 72, 76, 114, 120, 144, 152, 180].map((size) => ({
      url: `/apple-icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  },
  other: {
    "msapplication-TileColor": "#fbfcfe",
    "msapplication-TileImage": "/ms-icon-144x144.png",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#13191f" },
  ],
};

// An undefined key interpolates to `localStorage.getItem(undefined)`: no throw,
// no match, every load painting the OS theme before hydration corrects it.
if (typeof THEME_KEY !== "string") {
  throw new Error("THEME_KEY must be a string on the server");
}

const THEME_BOOT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var d=p==='dark'||((!p||p==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-sans antialiased">
        <ApolloWrapper>
          <ThemeProvider>
            <UIProvider>{children}</UIProvider>
          </ThemeProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
