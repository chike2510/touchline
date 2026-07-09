/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: this app has no server-side logic at all (no API routes,
  // no SSR data fetching) — every system runs client-side against IndexedDB
  // and Web Workers. Exporting statically means `npm run build` produces a
  // plain folder of HTML/JS/CSS in `out/` that keeps working with **no**
  // Node server running at all once the service worker has cached it —
  // genuine offline-first, not just "offline against your dev server".
  output: "export",
  images: { unoptimized: true }, // next/image optimization needs a server; not used here anyway
  // Service worker (public/sw.js) is registered manually in
  // src/components/layout/ServiceWorkerRegistrar.tsx rather than via a build
  // plugin, so the offline cache list is explicit and easy to audit/extend
  // by hand (see public/sw.js). Cache-Control headers below only apply when
  // running `next dev` / a Node server for local testing; the exported
  // static build should be served with no-cache on sw.js by whatever static
  // host you deploy to (most default to sane caching for .js already).
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

module.exports = nextConfig;
