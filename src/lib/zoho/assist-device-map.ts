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
    out.serialNumber = str(di.serial_number);
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

  const md = asRecord(rep.manufacturer_details);
  if (md) {
    if (!out.manufacturer) {
      out.manufacturer =
        str(md.manufacturer) ??
        str(md.system_manufacturer) ??
        str(md.brand) ??
        str(md.vendor);
    }
    if (!out.model) {
      out.model =
        str(md.model) ??
        str(md.product) ??
        str(md.system_model) ??
        str(md.product_name);
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

  return out;
}
