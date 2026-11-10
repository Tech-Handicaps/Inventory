import type { MetadataRoute } from "next";

/** Lets phones "Install app" / "Add to Home screen"; opens straight on the scanner. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HNA Hardware inventory",
    short_name: "HNA Scan",
    description: "Scan hardware barcodes and QR codes for the HNA inventory.",
    id: "/scan",
    start_url: "/scan",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#20282d",
    theme_color: "#20282d",
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
