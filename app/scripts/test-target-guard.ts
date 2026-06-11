/**
 * Verification script for the H3 zero-address target guard.
 *
 * Run: npx -y tsx scripts/test-target-guard.ts
 *
 * Proves buildAndValidateUserOps rejects (DelegationProofError -> API 422):
 *   - missing target
 *   - zero-address target
 *   - placeholder targets 0x...0001 / 0x...0002
 *   - unexpanded template token targets
 * and that a valid checksummed target passes target validation.
 */

import {
  buildAndValidateUserOps,
  assertValidActionTarget,
} from '../src/lib/delegation/proof-validation'
import { DelegationProofError } from '../src/lib/delegation/proof-bundle'
import type { PlannedAction, Address } from '../src/types'

let failures = 0

function action(target: unknown): PlannedAction {
  return {
    id: 'test',
    type: 'erc20_transfer',
    agentId: 'payment-executor',
    delegationChain: [],
    target: target as Address,
    calldata: '0x',
    value: 0n,
    humanDescription: 'test',
    estimatedOutput: 'test',
    withinDelegationScope: true,
    dependsOn: [],
  } as PlannedAction
}

function expectReject(label: string, target: unknown): void {
  try {
    buildAndValidateUserOps({ actions: [action(target)], signedDelegations: [] })
    console.error(`FAIL ${label}: expected DelegationProofError, none thrown`)
    failures += 1
  } catch (e) {
    if (e instanceof DelegationProofError && e.message.includes('action.target is missing or invalid')) {
      console.log(`PASS ${label}: rejected with "${e.message}"`)
    } else {
      console.error(`FAIL ${label}: wrong error: ${String(e)}`)
      failures += 1
    }
  }
}

expectReject('missing target', undefined)
expectReject('empty target', '0x')
expectReject('zero address', '0x0000000000000000000000000000000000000000')
expectReject('placeholder 0x...0001', '0x0000000000000000000000000000000000000001')
expectReject('placeholder 0x...0002', '0x0000000000000000000000000000000000000002')
expectReject('template token', '<TARGET_CONTRACT_ADDRESS>')

// Valid target must pass target validation (Sepolia USDC).
try {
  assertValidActionTarget(action('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'))
  console.log('PASS valid target: accepted by assertValidActionTarget')
} catch (e) {
  console.error(`FAIL valid target: unexpectedly rejected: ${String(e)}`)
  failures += 1
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll target-guard checks passed')
