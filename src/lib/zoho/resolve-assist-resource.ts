import {
  extractAssistListRows,
  findAssistComputerRowBySearch,
} from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDevicesList,
  ZOHO_ASSIST_DEVICES_MAX_COUNT,
} from "@/lib/zoho/client";

/** Resolve Assist unattended device resource id from id or display name search. */
export async function resolveAssistResourceId(
  accessToken: string,
  departmentId: string,
  orgId: string | null | undefined,
  input: { resourceId?: string; displayName?: string }
): Promise<{ resourceId: string; listComputer?: unknown }> {
  if (input.resourceId?.trim()) {
    return { resourceId: input.resourceId.trim() };
  }
  const dn = input.displayName?.trim();
  if (!dn) {
    throw new Error(
      "Provide resourceId or displayName (device display name in Assist)."
    );
  }

  let listJson = await fetchAssistDevicesList(accessToken, {
    departmentId,
    orgId,
    displayName: dn,
    count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
    index: 1,
  });
  let found = findAssistComputerRowBySearch(listJson, dn);
  if (!found) {
    for (let page = 1; page <= 100; page++) {
      listJson = await fetchAssistDevicesList(accessToken, {
        departmentId,
        orgId,
        count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
        index: page,
      });
      found = findAssistComputerRowBySearch(listJson, dn);
      if (found) break;
      const pageRows = extractAssistListRows(listJson);
      if (pageRows.length < ZOHO_ASSIST_DEVICES_MAX_COUNT) break;
    }
  }
  if (!found) {
    throw new Error(
      `No unattended device matched “${dn}”. Confirm the name in Zoho Assist and your default department ID.`
    );
  }
  return { resourceId: found.resourceId, listComputer: found.raw };
}
