/** Window event that opens the global Add hardware modal (top bar and page buttons). */
export const ADD_HARDWARE_EVENT = "hna:add-hardware";
/** Fired after the modal creates an asset so open pages can reload. */
export const HARDWARE_CREATED_EVENT = "hna:hardware-created";

export function openAddHardware() {
  window.dispatchEvent(new Event(ADD_HARDWARE_EVENT));
}
