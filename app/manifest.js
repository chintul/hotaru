export default function manifest() {
  return {
    name: "hotaru.mn",
    short_name: "hotaru.mn",
    description: "Өдөр тутмын хэрэглээнд зориулсан загварлаг бүтээгдэхүүнүүд.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfe",
    theme_color: "#fbfcfe",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
