import type { NextConfig } from "next";

/**
 * Routes that call `lookupGeoFromPublicIp`; the ~60 MB GeoLite2 database is traced into these functions only.
 * Keys are picomatch globs matched with `contains`, so dynamic segments need escaped brackets.
 */
const GEOIP_ROUTES = [
  "/api/cron/sync-assist-public-ip",
  "/api/assets/\\[id\\]/sync-assist",
  "/api/assets/\\[id\\]/link-assist",
  "/api/assets/import-assist",
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  outputFileTracingIncludes: Object.fromEntries(
    GEOIP_ROUTES.map((route) => [route, ["./data/geoip/*.mmdb"]])
  ),
};

export default nextConfig;
