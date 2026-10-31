import { Poppins } from "next/font/google";

export const fontBody = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
});

/** Headings share the body face; kept as a separate export so existing imports keep working. */
export const fontHeading = fontBody;
