// The web manifest, as a route rather than a public/ file — Next emits the
// <link rel="manifest"> itself and serves this at /manifest.webmanifest.
export default function manifest() {
  return {
    name: 'hotaru',
    short_name: 'hotaru',
    description: 'Өдөр тутмын хэрэглээний загварлаг бүтээгдэхүүн.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdfb',
    theme_color: '#fffdfb',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { src: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  }
}
