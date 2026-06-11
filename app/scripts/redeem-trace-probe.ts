/**
 * Step 5 redeem-decision probe (SHIP_AUDIT.md section 8).
 *
 * Builds ONE execution through the real pipeline encoders (buildUserOps ->
 * buildSend7710Params) with a genuinely EIP-712-signed delegation (DeFi agent
 * key), submits it via relayer_send7710Transaction, and reports what the
 * relayer does with it. If a taskId comes back, polls for the txHash so the
 * transaction can be traced with `cast run`.
 *
 * Run from app/: set -a; source .env.local; set +a; npx -y tsx scripts/redeem-trace-probe.ts
 */

import { privateKeyToAccount } from 'viem/accounts'
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import {
  hashDelegation,
  SIGNABLE_DELEGATION_TYPED_DATA,
} from '@metamask/smart-accounts-kit/utils'
import { createRootDelegationStruct } from '../src/lib/delegation/createRootDelegation'
import { buildUserOps } from '../src/services/execution-engine/userop-builder'
import { buildSend7710Params } from '../src/lib/oneshot/build-relay-send'
import type { Delegation, Hash, Address, PlannedAction } from '../src/types'

const CHAIN_ID = 11155111
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
const RELAYER_URL = 'https://relayer.1shotapi.dev/relayers'

async function rpc<T>(method: string, params: unknown): Promise<{ result?: T; error?: { message: string; code?: number } }> {
  const res = await fetch(RELAYER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ONESHOT_API_KEY}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return (await res.json()) as { result?: T; error?: { message: string } }
}

async function main() {
  const key = process.env.DEFI_AGENT_KEY as `0x${string}`
  if (!key) throw new Error('DEFI_AGENT_KEY not set (source app/.env.local first)')
  const signer = privateKeyToAccount(key)
  console.log('Delegator (DeFi agent EOA):', signer.address)

  const env = getSmartAccountsEnvironment(CHAIN_ID)
  console.log('DelegationManager:', env.DelegationManager)

  // 1) Relay capabilities -> delegate must be the relay target
  const caps = await rpc<Record<string, { feeCollector: string; targetAddress: string; tokens: { address: string; decimals: string }[] }>>(
    'relayer_getCapabilities',
    [String(CHAIN_ID)],
  )
  const cap = caps.result?.[String(CHAIN_ID)]
  if (!cap) throw new Error(`no capabilities: ${JSON.stringify(caps)}`)
  console.log('Relay target (delegate):', cap.targetAddress)

  // 2) Build a root delegation EXACTLY as the app's activation flow does
  //    (delegate = relay target, 1 USDC monthly cap policy)
  const kitDel = await createRootDelegationStruct({
    delegator: signer.address,
    delegate: cap.targetAddress as `0x${string}`,
    policy: { monthlySpendCap: 1_000_000n },
  })

  // 3) Sign EIP-712 against the DelegationManager domain
  const signature = await signer.signTypedData({
    domain: {
      name: 'DelegationManager',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: env.DelegationManager as `0x${string}`,
    },
    types: SIGNABLE_DELEGATION_TYPED_DATA,
    primaryType: 'Delegation',
    message: {
      delegate: kitDel.delegate,
      delegator: kitDel.delegator,
      authority: kitDel.authority,
      caveats: kitDel.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: BigInt(kitDel.salt),
    },
  })
  const hash = hashDelegation(kitDel) as Hash
  console.log('Delegation hash:', hash)

  const signedDelegation: Delegation = {
    hash,
    delegate: kitDel.delegate as Address,
    delegator: kitDel.delegator as Address,
    authority: 'ROOT',
    caveats: kitDel.caveats.map((c) => ({
      enforcer: c.enforcer as Address,
      enforcerName: 'ERC20TransferAmountEnforcer',
      terms: c.terms,
      decodedTerms: {},
      humanReadable: 'Max 1 USDC per execution',
    })),
    salt: kitDel.salt as `0x${string}`,
    signature,
    hop: 'root',
    status: 'active',
    issuedAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    agentId: null,
    parentDelegation: null,
    children: [],
  }

  // 4) Real pipeline: PlannedAction -> buildUserOps -> buildSend7710Params
  const action: PlannedAction = {
    id: 'probe',
    type: 'erc20_transfer',
    agentId: 'payment-executor',
    delegationChain: [hash],
    target: USDC,
    // transfer(paymentAgent, 0.01 USDC)
    calldata: ('0xa9059cbb' +
      '000000000000000000000000424A9f9Bc1D47172b41B47f9c0A242e6e656A9c5'.toLowerCase() +
      '0000000000000000000000000000000000000000000000000000000000002710') as `0x${string}`,
    value: 0n,
    humanDescription: 'probe transfer 0.01 USDC',
    estimatedOutput: '',
    withinDelegationScope: true,
    dependsOn: [],
  }

  const userOps = buildUserOps({
    actions: [action],
    signedDelegations: [signedDelegation],
    senderAddress: signer.address,
  })
  console.log('UserOp callData selector:', userOps[0].callData.slice(0, 10))
  console.log('UserOp target:', userOps[0].target)

  const fee = await rpc<{ minFee: string; context: string }>('relayer_getFeeData', {
    chainId: String(CHAIN_ID),
    token: cap.tokens[0].address,
  })
  if (!fee.result) throw new Error(`no fee data: ${JSON.stringify(fee)}`)

  const params = buildSend7710Params({
    chainId: CHAIN_ID,
    userOps,
    capability: {
      feeCollector: cap.feeCollector as `0x${string}`,
      targetAddress: cap.targetAddress as `0x${string}`,
      acceptedTokens: cap.tokens.map((t) => ({
        address: t.address as `0x${string}`,
        symbol: 'USDC',
        decimals: parseInt(String(t.decimals), 10),
      })),
    },
    fee: fee.result,
  })

  // Probe variant: RAW_CALLDATA=1 swaps the action execution's data to the raw
  // ERC20 transfer calldata (what the relayer's validation expects), leaving
  // the permissionContext as the redemption material.
  if (process.env.RAW_CALLDATA === '1') {
    const tx = params.transactions[0]
    tx.executions[1] = { target: action.target, value: '0', data: action.calldata }
    console.log('\n[RAW_CALLDATA variant] executions[1].data =', action.calldata)
  }

  console.log('\n--- send7710 params (what the app actually sends) ---')
  console.log(JSON.stringify(params, null, 2).slice(0, 3000))

  // 5) Submit and observe
  const sent = await rpc<string | { taskId: string }>('relayer_send7710Transaction', params)
  console.log('\n--- relayer response ---')
  console.log(JSON.stringify(sent, null, 2))

  const taskId = typeof sent.result === 'string' ? sent.result : sent.result?.taskId
  if (!taskId) {
    console.log('\nNo taskId -> relayer rejected pre-chain. Error above is the routing evidence.')
    return
  }

  // 6) Poll task status for a txHash
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 6000))
    const st = await rpc<unknown>('relayer_getTransactionStatus', { taskId })
    console.log(`status[${i}]:`, JSON.stringify(st))
    const s = JSON.stringify(st)
    const m = s.match(/0x[0-9a-f]{64}/i)
    if (m && /confirmed|success|failed|mined|reverted/i.test(s)) {
      console.log('\nTxHash for cast run:', m[0])
      return
    }
  }
}

main().catch((e) => {
  console.error('PROBE ERROR:', e)
  process.exit(1)
})
