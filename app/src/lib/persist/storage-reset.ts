/**
 * Bump this when contracts or persisted schema change.
 * On next page load, ensureStorageContractVersion() will wipe all PERSIST_KEYS
 * for any client still on an old version, forcing a clean re-activation.
 *
 * Current bump reason: AgentTreasury redeployed with per-user userBalance mapping,
 * withdraw(), and getUserBalance(address). Activation store migrated to per-wallet
 * map (forgeos-activation-v2). Old flat forgeos-activation key is now stale.
 */
export const FORGEOS_STORAGE_RESET_VERSION = 'sepolia-treasury-peruser-v1'

const VERSION_KEY = 'forgeos-storage-reset-version'

const PERSIST_KEYS = [
  'forgeos-os',
  'forgeos-activation',
  'forgeos-activation-v2',
  'forgeos-delegations',
  'forgeos-agents',
  /** Legacy activation key (pre–Zustand store) */
  'forgeos_activation_v1',
] as const

/** Clear stale persisted OS / activation / delegation state after a contract redeploy. */
export function ensureStorageContractVersion(): void {
  if (typeof window === 'undefined') return

  const current = localStorage.getItem(VERSION_KEY)
  if (current === FORGEOS_STORAGE_RESET_VERSION) return

  for (const key of PERSIST_KEYS) {
    localStorage.removeItem(key)
  }
  localStorage.setItem(VERSION_KEY, FORGEOS_STORAGE_RESET_VERSION)
}

export function clearForgePersistedState(): void {
  if (typeof window === 'undefined') return
  for (const key of PERSIST_KEYS) {
    localStorage.removeItem(key)
  }
  localStorage.removeItem(VERSION_KEY)
}
