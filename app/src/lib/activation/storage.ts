/**
 * @deprecated All activation state is now managed by useActivationStore (Zustand persist).
 * This file is kept as a thin stub so any lingering imports compile without errors.
 * Remove this file once all callers have been updated.
 */

/** @deprecated Use useActivationStore.getState().reset() */
export function clearActivationState(): void {
  // no-op — state is cleared via useActivationStore.getState().reset()
}
