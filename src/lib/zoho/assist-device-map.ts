/**
 * Maps Zoho Assist GET /api/v2/devices/{resource_id} JSON into our Asset hardware fields.
 * @see https://www.zoho.com/assist/api/getDeviceDetails.html
 */

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function numToStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** Extract Assist device id from resource_type URL like "/api/v2/devices/2750…" */
export function parseAssistResourceIdFromPayload(json: unknown): string | undefined {
  const root = asRecord(json);
  if (!root) return undefined;
  const rt = str(root.resource_type);
  if (rt) {
    const m = rt.match(/\/devices\/([^/?]+)\s*$/);
    if (m?.[1]) return m[1];
  }
  const rep = asRecord(root.representation);
  const di = rep ? asRecord(rep.device_info) : null;
  return str(di?.computer_id) ?? str(di?.resource_id);
}

export type AssistHardwareFields = {
  zohoAssistDeviceId?: string;
  assetName?: string;
  deviceLocation?: string;
  manufacturer?: string;
  model?: string;
  processorName?: string;
  systemRam?: string;
  systemGpu?: string;
  serialNumber?: string;
  zohoAssistDepartmentId?: string;
};

/**
 * Best-effort mapping — Assist payloads vary by OS/agent; unknown sections are skipped.
 */
export function mapAssistDeviceJsonToHardwareFields(json: unknown): AssistHardwareFields {
  const root = asRecord(json);
  const rep = root ? asRecord(root.representation) : null;
  if (!rep) return {};

  const out: AssistHardwareFields = {};

  const resourceId =
    parseAssistResourceIdFromPayload(json) ?? str(rep.urs_key);
  if (resourceId) out.zohoAssistDeviceId = resourceId;

  out.assetName =
    str(rep.display_name) ??
    str(rep.computer_full_name) ??
    undefined;

  const di = asRecord(rep.device_info);
  if (di) {
    if (!out.assetName) {
      out.assetName =
        str(di.device_name) ?? str(di.name) ?? str(di.computer_full_name);
    }
    out.serialNumber = str(di.serial_number) ?? str(di.service_tag);
  }

  const dept = asRecord(rep.department);
  if (dept) {
    out.zohoAssistDepartmentId = str(dept.department_id);
    if (!out.deviceLocation) {
      out.deviceLocation =
        str(dept.display_name) ??
        str(dept.department_name) ??
        str(dept.name);
    }
  }

  /** Zoho Assist uses manufacturer_name / product_name (see API docs). */
  const md = asRecord(rep.manufacturer_details);
  if (md) {
    if (!out.manufacturer) {
      out.manufacturer =
        str(md.manufacturer_name) ??
        str(md.manufacturer) ??
        str(md.system_manufacturer) ??
        str(md.brand) ??
        str(md.vendor);
    }
    if (!out.model) {
      out.model =
        str(md.product_name) ??
        str(md.model) ??
        str(md.product) ??
        str(md.system_model);
    }
  }

  const pd = asRecord(rep.platform_details);
  if (pd) {
    if (!out.serialNumber) {
      out.serialNumber =
        str(pd.serial_number) ??
        str(pd.product_id) ??
        str(pd.service_tag);
    }
  }

  const hw = asRecord(rep.hardware_details);
  if (hw) {
    if (!out.processorName) {
      out.processorName =
        str(hw.processor_name) ??
        str(hw.processor) ??
        str(hw.cpu) ??
        str(hw.cpu_name);
    }
    if (!out.systemRam) {
      out.systemRam =
        str(hw.memory) ??
        str(hw.ram) ??
        str(hw.total_memory) ??
        str(hw.system_memory) ??
        numToStr(hw.memory_in_gb as unknown) ??
        (typeof hw.memory_in_mb === "number"
          ? `${Math.round((hw.memory_in_mb as number) / 1024)} GB`
          : undefined);
    }
    if (!out.systemGpu) {
      out.systemGpu =
        str(hw.gpu) ??
        str(hw.video_controller) ??
        str(hw.graphics_card) ??
        str(hw.display_adapter);
    }
  }

  const sys = asRecord(rep.system_information);
  if (sys) {
    if (!out.processorName) {
      out.processorName =
        str(sys.processor_name) ?? str(sys.processor) ?? str(sys.cpu);
    }
    if (!out.systemRam) {
      out.systemRam =
        str(sys.total_physical_memory) ??
        str(sys.memory) ??
        str(sys.ram);
    }
    if (!out.systemGpu) {
      out.systemGpu = str(sys.gpu) ?? str(sys.video_controller);
    }
  }

  const inv = asRecord(rep.hardware_inventory);
  if (inv) {
    const cpus = inv.cpus;
    if (!out.processorName && Array.isArray(cpus) && cpus[0]) {
      const c0 = asRecord(cpus[0]);
      if (c0) {
        out.processorName = str(c0.name) ?? str(c0.processor_name);
      }
    }
    const gpus = inv.gpus ?? inv.video_controllers;
    if (!out.systemGpu && Array.isArray(gpus) && gpus[0]) {
      const g0 = asRecord(gpus[0]);
      if (g0) {
        out.systemGpu = str(g0.name) ?? str(g0.adapter);
      }
    }
  }

  const procDet =
    asRecord(rep.processor_details) ??
    asRecord(rep.cpu_details) ??
    asRecord(rep.processor);
  if (procDet && !out.processorName) {
    out.processorName =
      str(procDet.name) ??
      str(procDet.processor_name) ??
      str(procDet.description) ??
      str(procDet.model);
  }

  const memDet =
    asRecord(rep.memory_details) ??
    asRecord(rep.system_memory) ??
    asRecord(rep.physical_memory);
  if (memDet && !out.systemRam) {
    out.systemRam =
      str(memDet.total_physical_memory) ??
      str(memDet.installed_physical_memory) ??
      str(memDet.installed_ram) ??
      str(memDet.capacity) ??
      (typeof memDet.capacity_mb === "number"
        ? `${Math.round(memDet.capacity_mb / 1024)} GB`
        : undefined);
  }

  fillHardwareGapsFromDeepScan(rep, out);

  return out;
}

/**
 * Walk nested representation (depth-limited) to pick up CPU/RAM/GPU strings when
 * Zoho nests them under undocumented keys — only fills empty fields.
 */
function fillHardwareGapsFromDeepScan(
  rep: Record<string, unknown>,
  out: AssistHardwareFields,
  depth = 0
): void {
  if (depth > 8) return;
  for (const [k, v] of Object.entries(rep)) {
    const kl = k.toLowerCase();
    if (
      depth <= 3 &&
      (kl === "department" ||
        kl === "credentials" ||
        kl === "groups" ||
        kl === "active_users" ||
        kl === "logged_on_users")
    ) {
      continue;
    }
    if (typeof v === "string" && v.trim().length > 1) {
      const t = v.trim();
      if (
        !out.processorName &&
        (kl.includes("processor") ||
          kl === "cpu" ||
          kl.includes("cpu_name") ||
          (kl.includes("cpu") && !kl.includes("gpu")))
      ) {
        if (!kl.includes("gpu") && !kl.includes("graphics") && !kl.includes("video_controller_name")) {
          out.processorName = t;
        }
      }
      if (
        !out.systemRam &&
        (kl.includes("memory") || kl.includes("ram") || kl.includes("physical_memory")) &&
        !kl.includes("gpu")
      ) {
        out.systemRam = t;
      }
      if (
        !out.systemGpu &&
        (kl.includes("gpu") ||
          kl.includes("video") ||
          kl.includes("graphics") ||
          kl.includes("display_adapter"))
      ) {
        out.systemGpu = t;
      }
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      fillHardwareGapsFromDeepScan(v as Record<string, unknown>, out, depth + 1);
    } else if (Array.isArray(v) && depth < 6) {
      for (const item of v) {
        const o = asRecord(item);
        if (o) fillHardwareGapsFromDeepScan(o, out, depth + 1);
      }
    }
  }
}

/**
 * Merge fields from GET /api/v2/devices list `computers[]` row when detail
 * payload omits manufacturer/product (list entries sometimes include them).
 */
export function mergeAssistListComputerIntoMapped(
  listComputer: unknown | undefined,
  mapped: AssistHardwareFields
): AssistHardwareFields {
  if (!listComputer) return mapped;
  const row = asRecord(listComputer);
  if (!row) return mapped;

  const rowMd = asRecord(row.manufacturer_details);
  const rowDi = asRecord(row.device_info);
  const rowPd = asRecord(row.platform_details);

  const mfg =
    str(row.manufacturer) ??
    str(rowMd?.manufacturer_name) ??
    str(rowMd?.manufacturer);
  const mdl =
    str(row.product) ??
    str(row.computer_full_name) ??
    str(rowMd?.product_name) ??
    str(rowMd?.model);

  return {
    ...mapped,
    manufacturer: mapped.manufacturer ?? mfg,
    model: mapped.model ?? mdl,
    serialNumber:
      mapped.serialNumber ??
      str(rowDi?.serial_number) ??
      str(rowDi?.service_tag) ??
      str(rowPd?.serial_number) ??
      str(rowPd?.product_id),
  };
}

export type AssistListRow = {
  resourceId: string;
  displayName: string;
  deviceName?: string;
  raw: unknown;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Parse GET /api/v2/devices list payload into rows with resource ids. */
export function extractAssistListRows(json: unknown): AssistListRow[] {
  const root = asRecord(json);
  const rep = root ? asRecord(root.representation) : null;
  const computers = rep?.computers;
  if (!Array.isArray(computers)) return [];

  const out: AssistListRow[] = [];
  for (const c of computers) {
    const row = asRecord(c);
    if (!row) continue;
    const resourceId = str(row.resource_id);
    if (!resourceId) continue;
    const di = asRecord(row.device_info);
    const deviceName =
      str(di?.device_name) ?? str(di?.name) ?? str(di?.computer_full_name);
    const displayName =
      str(row.display_name) ?? deviceName ?? resourceId;
    out.push({
      resourceId,
      displayName,
      deviceName,
      raw: c,
    });
  }
  return out;
}

/**
 * Find a computer row by display name / device name (case-insensitive substring or equality).
 */
export function findAssistComputerRowBySearch(
  json: unknown,
  search: string
): AssistListRow | null {
  const q = norm(search);
  if (!q) return null;
  const rows = extractAssistListRows(json);
  const exact = rows.find(
    (r) => norm(r.displayName) === q || (r.deviceName && norm(r.deviceName) === q)
  );
  if (exact) return exact;
  return (
    rows.find(
      (r) =>
        norm(r.displayName).includes(q) ||
        (r.deviceName ? norm(r.deviceName).includes(q) : false)
    ) ?? null
  );
}
