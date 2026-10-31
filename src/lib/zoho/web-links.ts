/** Browser (not API) URLs for Zoho web apps, per data center. */
const ZOHO_WEB_DOMAIN: Record<string, string> = {
  us: "zoho.com",
  eu: "zoho.eu",
  in: "zoho.in",
  au: "zoho.com.au",
  ca: "zohocloud.ca",
  jp: "zoho.jp",
  sa: "zoho.sa",
};

function domainFor(dataCenter: string | null | undefined): string {
  return ZOHO_WEB_DOMAIN[dataCenter ?? ""] ?? ZOHO_WEB_DOMAIN.us;
}

/** Zoho Assist web console (device pages have no stable public deep link). */
export function zohoAssistConsoleUrl(dataCenter: string | null | undefined): string {
  return `https://assist.${domainFor(dataCenter)}/`;
}

/** Opens a Desk ticket by its internal id in the agent UI. */
export function zohoDeskTicketUrl(dataCenter: string | null | undefined, ticketId: string): string {
  return `https://desk.${domainFor(dataCenter)}/support/ShowHomePage.do#Cases/dv/${encodeURIComponent(ticketId)}`;
}
