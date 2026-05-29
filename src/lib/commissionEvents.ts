export const COMMISSION_UPDATED_EVENT = "commission-updated";

export function dispatchCommissionUpdated() {
  window.dispatchEvent(new Event(COMMISSION_UPDATED_EVENT));
}
