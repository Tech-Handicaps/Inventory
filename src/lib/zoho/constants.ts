/** Zoho account hosts — token + OAuth browser flows use these (Assist API host stays assist.zoho.com). */
export const ZOHO_DATA_CENTERS = [
  { value: "us", label: "US (accounts.zoho.com)" },
  { value: "eu", label: "EU (accounts.zoho.eu)" },
  { value: "in", label: "IN (accounts.zoho.in)" },
  { value: "au", label: "AU (accounts.zoho.com.au)" },
  { value: "ca", label: "CA (accounts.zohocloud.ca)" },
  { value: "jp", label: "JP (accounts.zoho.jp)" },
  { value: "sa", label: "SA (accounts.zoho.sa)" },
] as const;

export type ZohoDataCenter = (typeof ZOHO_DATA_CENTERS)[number]["value"];
