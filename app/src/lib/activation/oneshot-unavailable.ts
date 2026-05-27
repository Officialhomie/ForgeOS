/** True when 1Shot relayer cannot serve the configured chain (empty capabilities). */
export function isOneShotUnavailableError(message: string): boolean {
  return /no accepted payment tokens|returned no accepted payment|acceptedTokens/i.test(
    message,
  )
}
