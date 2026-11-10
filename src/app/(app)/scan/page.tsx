import { requireOperationalSession } from "@/lib/auth/get-session-role";
import { ScanClient } from "./scan-client";

export const metadata = { title: "Scan · HNA Hardware inventory" };

export default async function ScanPage() {
  await requireOperationalSession();
  return <ScanClient />;
}
