/**
 * MetaMask allows only one wallet_requestExecutionPermissions at a time (-32002).
 * Serialize all ERC-7715 permission requests through this lock.
 */
let inFlight: Promise<unknown> | null = null

export function isErc7715Busy(): boolean {
  return inFlight !== null
}

export async function withErc7715Lock<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight) {
    try {
      await inFlight
    } catch {
      // prior request failed; continue
    }
  }
  const run = fn()
  inFlight = run
  try {
    return await run
  } finally {
    if (inFlight === run) inFlight = null
  }
}

export function isErc7715ResourceBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? (error as { code: unknown }).code : undefined
  const message =
    'message' in error ? String((error as { message: unknown }).message) : String(error)
  return (
    code === -32002 ||
    message.includes('wallet_requestExecutionPermissions request is in process')
  )
}
