'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useDisconnect, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { createClient, createPublicClient, custom, http, parseAbi, parseUnits } from 'viem'
import { useForgeWalletConnect } from '@/hooks/useForgeWalletConnect'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { CONTRACTS } from '@/lib/contracts'
import { buildActivationPermissions } from '@/lib/delegation/buildPermissions'
import { getRelayTargetAddress } from '@/lib/oneshot/client'
import {
  createRootDelegationStruct,
  kitDelegationToForge,
} from '@/lib/delegation/createRootDelegation'
import { predictSmartAccountAddress } from '@/lib/smart-account/predictAddress'
import { isStaleActivationState } from '@/lib/activation/stale-state'
import { isOneShotUnavailableError } from '@/lib/activation/oneshot-unavailable'
import { rootDelegationNeedsRelayResign } from '@/lib/delegation/needs-relay-resign'
import { withErc7715Lock } from '@/lib/wallet/erc7715-lock'
import { forgeChain } from '@/lib/wagmi/chains'
import { ensureForgeChain } from '@/lib/wagmi/ensure-forge-chain'
import {
  formatErc7715Error,
  formatWalletError,
  getErc7715Provider,
  getEthereumProviderDiagnostics,
  hasEthereumProvider,
  probeErc7715RpcSupport,
  refreshWalletRuntimeCache,
} from '@/lib/wagmi/ethereum-provider'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import { useActivationStore, INITIAL_WALLET } from '@/stores/activation.store'
import type {
  ActivationPhase,
  ActivationStepId,
  ActivationStepState,
} from '@/types/activation'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Address, Hash, OSKernelConfig } from '@/types'
import {
  formatTreasuryPreflightError,
  preflightTreasuryFunding,
} from '@/lib/treasury/validate-funding'

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

const treasuryAbi = parseAbi(['function fund(uint256 amount)'])

const STEP_ORDER: ActivationStepId[] = [
  'connect',
  'deploy',
  'permissions',
  'fund',
  'complete',
]

function stepIndex(id: ActivationStepId): number {
  return STEP_ORDER.indexOf(id)
}

function resolveCurrentStep(
  phase: ActivationPhase,
  completedSteps: ActivationStepId[],
): ActivationStepId {
  if (phase === 'active') return 'complete'
  if (phase === 'deploying') return 'deploy'
  if (phase === 'requesting_permissions') return 'permissions'
  if (phase === 'funding') return 'fund'
  if (phase === 'connecting') return 'connect'

  const flow: ActivationStepId[] = ['connect', 'deploy', 'permissions', 'fund']
  const next = flow.find((s) => !completedSteps.includes(s))
  return next ?? 'fund'
}

export function useActivation() {
  const { address, isConnected, status: walletStatus } = useAccount()
  const chainId = useChainId()
  const {
    connectWallet: connectForgeWallet,
    isPending: connectPending,
    error: connectError,
  } = useForgeWalletConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: connectedWalletClient } = useWalletClient()

  const setOsStatus = useOsStore((s) => s.setOsStatus)
  const rootDelegation = useOsStore((s) => s.rootDelegation)
  const setRootDelegation = useOsStore((s) => s.setRootDelegation)
  const setKernel = useOsStore((s) => s.setKernel)
  const setActivationStep = useOsStore((s) => s.setActivationStep)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)

  // ─── Per-wallet persisted state ─────────────────────────────────────────
  // Read the current wallet's slice. Falls back to INITIAL_WALLET when address
  // is not yet known or the wallet has no stored state.
  const walletState = useActivationStore((s) =>
    address ? (s.wallets[address.toLowerCase()] ?? INITIAL_WALLET) : INITIAL_WALLET,
  )

  const { phase, completedSteps, smartAccountAddress, deployTxHash, fundTxHash, oneShotTaskId } =
    walletState

  // ─── Transient UI state (not persisted) ────────────────────────────────
  // 'connecting' is ephemeral — address isn't known yet so we can't key
  // it per wallet. We hold it in local state and merge into the derived phase.
  const [connectPhase, setConnectPhase] = useState<'idle' | 'connecting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fundAmountUsdc, setFundAmountUsdc] = useState('10')
  const fundAbortRef = useRef<AbortController | null>(null)

  // Derived phase: connecting takes priority during wallet connection flow.
  const derivedPhase: ActivationPhase = connectPhase === 'connecting' ? 'connecting' : phase

  // ─── Store helpers scoped to current wallet ─────────────────────────────
  const patch = useCallback(
    (update: Partial<typeof INITIAL_WALLET>) => {
      if (!address) return
      useActivationStore.getState().patchWallet(address, update)
    },
    [address],
  )

  const markComplete = useCallback(
    (step: ActivationStepId) => {
      if (!address) return
      useActivationStore.getState().addWalletStep(address, step)
    },
    [address],
  )

  // ─── Mount: validate stored state for this wallet ───────────────────────
  useEffect(() => {
    if (!address) return
    const stored = useActivationStore.getState().getWallet(address)
    if (isStaleActivationState(stored)) {
      useActivationStore.getState().resetWallet(address)
      setOsStatus('inactive')
      setKernel(null)
      return
    }
    if (stored.phase === 'active') {
      setOsStatus('active')
      setActivationStep(4)
    }
  }, [address, setOsStatus, setActivationStep, setKernel])

  // Stale root delegation (OSKernel delegate) — reopen permissions so user can re-sign.
  // Only on /activate so we do not clear delegation while user is on /dashboard/builder.
  useEffect(() => {
    if (!address || !rootDelegation) return
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/activate')) {
      return
    }
    let cancelled = false
    void (async () => {
      const needsResign = await rootDelegationNeedsRelayResign(rootDelegation)
      if (cancelled || !needsResign) return
      const wallet = useActivationStore.getState().getWallet(address)
      useActivationStore.getState().patchWallet(address, {
        completedSteps: wallet.completedSteps.filter(
          (s) => s !== 'permissions' && s !== 'fund',
        ),
        phase: 'idle',
        delegationHash: null,
      })
      setRootDelegation(null)
      setDelegations([])
      setActivationStep(2)
      setError(
        'Your saved permissions use the old OSKernel delegate. Approve again below so gasless relay works.',
      )
    })()
    return () => {
      cancelled = true
    }
  }, [address, rootDelegation, setRootDelegation, setDelegations, setActivationStep])

  // ─── Derived step state ─────────────────────────────────────────────────
  const currentStep = resolveCurrentStep(derivedPhase, completedSteps)
  const currentStepIndex = stepIndex(currentStep)

  const steps: ActivationStepState[] = useMemo(
    () =>
      [
        {
          id: 'connect' as const,
          title: 'Connect wallet',
          description: 'Link your MetaMask wallet to get started.',
        },
        {
          id: 'deploy' as const,
          title: 'Upgrade account',
          description: 'Add smart capabilities to your wallet so agents can act on your behalf.',
        },
        {
          id: 'permissions' as const,
          title: 'Set permissions',
          description: 'Approve what your agents are allowed to do, with limits you control.',
        },
        {
          id: 'fund' as const,
          title: 'Add funds',
          description: "Add a small USDC balance to cover your agents's actions.",
        },
      ].map((step) => {
        const idx = stepIndex(step.id)
        let status: ActivationStepState['status'] = 'pending'
        if (completedSteps.includes(step.id)) status = 'complete'
        else if (idx === currentStepIndex && derivedPhase !== 'active') status = 'current'
        else if (idx < currentStepIndex) status = 'complete'
        if (derivedPhase === 'error' && idx === currentStepIndex) status = 'error'
        return { ...step, status, error: status === 'error' ? error ?? undefined : undefined }
      }),
    [completedSteps, currentStepIndex, derivedPhase, error],
  )

  const progressPercent = useMemo(() => {
    const done = completedSteps.length
    return Math.min(100, Math.round((done / 4) * 100))
  }, [completedSteps])

  // ─── Network helpers ────────────────────────────────────────────────────
  const ensureForgeNetwork = useCallback(async () => {
    if (chainId === ACTIVATION_CHAIN_ID) return
    await ensureForgeChain(switchChainAsync)
  }, [chainId, switchChainAsync])

  // ─── Step 1: Connect wallet ─────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    setError(null)
    setConnectPhase('connecting')
    try {
      await connectForgeWallet()
    } catch (e) {
      setConnectPhase('idle')
      setError(formatWalletError(e))
    }
  }, [connectForgeWallet])

  // After wagmi confirms connection, mark step complete and persist phase.
  useEffect(() => {
    if (connectPhase !== 'connecting' || !isConnected || !address) return
    void (async () => {
      try {
        await ensureForgeChain(switchChainAsync)
        markComplete('connect')
        patch({ phase: 'idle' })
        setConnectPhase('idle')
        setActivationStep(1)
      } catch (e) {
        patch({ phase: 'error' })
        setConnectPhase('idle')
        setError(formatWalletError(e))
      }
    })()
  }, [connectPhase, isConnected, address, markComplete, patch, setActivationStep, switchChainAsync])

  // ─── Step 2: Deploy smart account ──────────────────────────────────────
  const loadPredictedAddress = useCallback(async () => {
    if (!address) return null
    try {
      const predicted = await predictSmartAccountAddress(address)
      patch({ smartAccountAddress: predicted })
      return predicted
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to predict smart account')
      return null
    }
  }, [address, patch])

  const deploySmartAccount = useCallback(async () => {
    setError(null)
    patch({ phase: 'deploying' })
    try {
      if (!address) throw new Error('Connect wallet first')
      await ensureForgeNetwork()
      const predicted = await loadPredictedAddress()
      if (!predicted) throw new Error('Could not resolve smart account address')

      // Stateless7702 uses the connected EOA as the smart account — no 7710 relay before permissions.
      if (predicted.toLowerCase() === address.toLowerCase()) {
        patch({ smartAccountAddress: predicted, phase: 'idle' })
        markComplete('deploy')
        setActivationStep(2)
        return
      }

      let taskId: string | null = null
      let txHash: Hash | undefined

      const res = await fetch('/api/relay/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: ACTIVATION_CHAIN_ID,
          smartAccountAddress: predicted,
        }),
      })
      const data = (await res.json()) as {
        taskId?: string
        txHash?: Hash
        error?: string
      }

      if (res.ok) {
        taskId = data.taskId ?? null
        txHash = data.txHash
      } else {
        const relayError = data.error ?? 'Deploy relay failed'
        const needsDelegationFirst =
          /permissionContext|signed ERC-7710 delegation/i.test(relayError)
        if (
          !isOneShotUnavailableError(relayError) &&
          !needsDelegationFirst
        ) {
          throw new Error(relayError)
        }
        if (predicted.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            needsDelegationFirst
              ? 'Complete permissions (step 3) before gasless deploy, or use a wallet whose smart account matches your EOA.'
              : '1Shot unavailable and smart account address differs from wallet. Cannot deploy on Sepolia.',
          )
        }
      }

      patch({ oneShotTaskId: taskId, deployTxHash: txHash, phase: 'idle' })
      markComplete('deploy')
      setActivationStep(2)
    } catch (e) {
      patch({ phase: 'error' })
      setError(e instanceof Error ? e.message : 'Deploy failed')
    }
  }, [address, ensureForgeNetwork, loadPredictedAddress, markComplete, patch, setActivationStep])

  // ─── Step 3: Sign root delegation (ERC-7715) ───────────────────────────
  const requestPermissions = useCallback(async () => {
    setError(null)
    patch({ phase: 'requesting_permissions' })
    try {
      if (!address) throw new Error('Connect wallet first')
      if (chainId !== ACTIVATION_CHAIN_ID) {
        await ensureForgeChain(switchChainAsync)
      }

      if (!hasEthereumProvider()) {
        throw new Error('MetaMask not available')
      }

      await refreshWalletRuntimeCache()
      const diag = getEthereumProviderDiagnostics()
      if (diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) {
        throw new Error(
          'Dual MetaMask extensions detected. Disable regular MetaMask, keep only Flask, hard-refresh, reconnect.',
        )
      }
      if (diag.kind === 'metamask' && !diag.hasFlaskCandidate) {
        throw new Error(
          'Connected to standard MetaMask, not Flask. Disable standard MetaMask and reconnect with Flask only.',
        )
      }

      const provider = await getErc7715Provider()
      if (!provider) throw new Error('MetaMask not available')

      const rpcOk = await probeErc7715RpcSupport(provider)
      if (!rpcOk) {
        throw new Error(
          'wallet_getSupportedExecutionPermissions is not available on this MetaMask Flask build. Install a Flask version with ERC-7715 enabled.',
        )
      }

      const erc7715Client = createClient({
        chain: forgeChain,
        transport: custom(provider),
      }).extend(erc7715ProviderActions())

      const relayTarget = await getRelayTargetAddress(ACTIVATION_CHAIN_ID)
      const permissions = buildActivationPermissions(relayTarget)
      const granted = await withErc7715Lock(() =>
        erc7715Client.requestExecutionPermissions(permissions),
      )

      const delegator = (smartAccountAddress ?? address) as Address
      const kitDel = await createRootDelegationStruct({
        delegator,
        delegate: relayTarget,
      })
      const signature = granted[0]?.context as `0x${string}` | undefined
      if (!signature || signature === '0x') {
        throw new Error(
          'MetaMask did not return a delegation signature. Approve the permission request and retry.',
        )
      }
      const forgeDel = kitDelegationToForge(kitDel, signature)

      setRootDelegation(forgeDel)
      setDelegations([forgeDel])

      const delegateRes = await fetch('/api/relay/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: ACTIVATION_CHAIN_ID,
          delegationHash: forgeDel.hash,
          signedDelegation: forgeDel,
        }),
      })
      const delegateData = (await delegateRes.json()) as { taskId?: string; error?: string }
      if (!delegateRes.ok) {
        const relayError = delegateData.error ?? 'On-chain delegate relay failed'
        if (!isOneShotUnavailableError(relayError)) {
          throw new Error(relayError)
        }
      }

      patch({
        delegationHash: forgeDel.hash,
        oneShotTaskId: delegateData.taskId ?? null,
        phase: 'idle',
      })
      markComplete('permissions')
      setActivationStep(3)
    } catch (e) {
      patch({ phase: 'error' })
      if (process.env.NODE_ENV === 'development') {
        console.error('[ForgeOS] ERC-7715 request failed', e)
      }
      setError(formatErc7715Error(e))
    }
  }, [
    address,
    chainId,
    smartAccountAddress,
    markComplete,
    patch,
    setRootDelegation,
    setDelegations,
    setActivationStep,
    switchChainAsync,
  ])

  // ─── Step 4: Fund treasury ──────────────────────────────────────────────
  const finishActivation = useCallback(
    (tx?: Hash) => {
      const kernel: OSKernelConfig = {
        kernelAddress: CONTRACTS.osKernel,
        treasuryAddress: CONTRACTS.agentTreasury,
        registryAddress: CONTRACTS.registry,
        deployedAt: Math.floor(Date.now() / 1000),
        deployTxHash:
          deployTxHash ??
          ('0x0000000000000000000000000000000000000000000000000000000000000000' as Hash),
        chainId: ACTIVATION_CHAIN_ID,
      }
      setKernel(kernel)
      setOsStatus('active')
      markComplete('fund')
      patch({ phase: 'active', fundTxHash: tx ?? null })
      setActivationStep(4)
    },
    [deployTxHash, markComplete, patch, setKernel, setOsStatus, setActivationStep],
  )

  const fundTreasury = useCallback(async () => {
    setError(null)
    patch({ phase: 'funding' })
    fundAbortRef.current?.abort()
    const abort = new AbortController()
    fundAbortRef.current = abort

    try {
      const isTransportTimeout = (err: unknown): boolean => {
        const message = err instanceof Error ? err.message : String(err)
        return /transport request timed out|rpcerr53|timeout/i.test(message)
      }

      if (!address) throw new Error('Connect wallet first')
      if (chainId !== ACTIVATION_CHAIN_ID) {
        await ensureForgeChain(switchChainAsync)
      }

      const amountRaw = parseUnits(fundAmountUsdc, 6)
      if (amountRaw <= 0n) throw new Error('Enter a USDC amount greater than 0')

      if (!connectedWalletClient) throw new Error('MetaMask wallet client unavailable')
      const walletChainBefore = connectedWalletClient.chain?.id ?? null
      if (walletChainBefore !== ACTIVATION_CHAIN_ID) {
        throw new Error(
          `Wallet network is ${walletChainBefore ?? 'unknown'}. Switch MetaMask to Sepolia (${ACTIVATION_CHAIN_ID}) and retry funding.`,
        )
      }
      const walletClient = connectedWalletClient
      const retryWriteContract = async (
        request: Parameters<typeof walletClient.writeContract>[0],
        label: 'approve' | 'fund',
      ) => {
        try {
          return await walletClient.writeContract(request)
        } catch (err) {
          if (!isTransportTimeout(err)) throw err
          await new Promise((resolve) => setTimeout(resolve, 1500))
          try {
            return await walletClient.writeContract(request)
          } catch (retryErr) {
            if (!isTransportTimeout(retryErr)) throw retryErr
            throw new Error(
              `Sepolia RPC timed out during ${label}. Retry in a few seconds, or switch MetaMask Sepolia RPC to a faster endpoint (for example Infura/Alchemy) and try again.`,
            )
          }
        }
      }
      const publicClient = createPublicClient({
        chain: forgeChain,
        transport: http(forgeChain.rpcUrls.default.http[0]),
      })

      const preflight = await preflightTreasuryFunding(publicClient, {
        treasuryAddress: CONTRACTS.agentTreasury,
        configuredUsdc: CONTRACTS.usdc,
        funder: address,
        amount: amountRaw,
      })
      if (!preflight.fundSimulationOk) {
        throw new Error(formatTreasuryPreflightError(preflight, fundAmountUsdc))
      }

      const fundingUsdc = preflight.treasuryUsdc
      if (preflight.allowance < amountRaw) {
        const approveHash = await retryWriteContract(
          {
            address: fundingUsdc,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONTRACTS.agentTreasury, amountRaw],
            chain: forgeChain,
            account: address,
          },
          'approve',
        )
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      if (abort.signal.aborted) {
        throw new Error('Funding cancelled')
      }

      const fundHash = await retryWriteContract(
        {
          address: CONTRACTS.agentTreasury,
          abi: treasuryAbi,
          functionName: 'fund',
          args: [amountRaw],
          chain: forgeChain,
          account: address,
        },
        'fund',
      )
      const receipt = await publicClient.waitForTransactionReceipt({ hash: fundHash })

      if (receipt.status !== 'success') {
        throw new Error('Treasury funding transaction reverted on-chain')
      }

      finishActivation(fundHash)
    } catch (e) {
      if (abort.signal.aborted) {
        patch({ phase: 'idle' })
        return
      }
      const message = e instanceof Error ? e.message : String(e)
      if (/user denied transaction signature/i.test(message)) {
        patch({ phase: 'error' })
        setError(
          'Funding needs 2 MetaMask confirmations (approve + fund). The second fund signature was rejected, so no treasury deposit was sent.',
        )
        return
      }
      if (/Wallet network is \d+/.test(message)) {
        patch({ phase: 'idle' })
        setError(message)
        return
      }
      if (/AgentTreasury expects USDC|Treasury accepts USDC|Treasury funding would fail/i.test(message)) {
        patch({ phase: 'idle' })
        setError(message)
        return
      }
      patch({ phase: 'error' })
      setError(e instanceof Error ? e.message : 'Treasury funding failed')
    } finally {
      if (fundAbortRef.current === abort) {
        fundAbortRef.current = null
      }
    }
  }, [address, chainId, connectedWalletClient, fundAmountUsdc, finishActivation, patch, switchChainAsync])

  const cancelFunding = useCallback(() => {
    fundAbortRef.current?.abort()
    patch({ phase: 'idle' })
    setError(null)
  }, [patch])

  // ─── Reset entire activation for the current wallet ─────────────────────
  const resetActivation = useCallback(() => {
    if (address) useActivationStore.getState().resetWallet(address)
    setConnectPhase('idle')
    setError(null)
    setOsStatus('inactive')
    setRootDelegation(null)
    setKernel(null)
    setActivationStep(0)
    disconnect()
  }, [address, disconnect, setKernel, setOsStatus, setRootDelegation, setActivationStep])

  // ─── Wallet disconnected mid-flow ────────────────────────────────────────
  // Preserve the wallet's stored progress — if they reconnect with the same
  // wallet, they resume where they left off. Only reset transient local state.
  useEffect(() => {
    if (walletStatus !== 'disconnected') return
    setConnectPhase('idle')
    setError(null)
  }, [walletStatus])

  // ─── Go back one step ───────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (!address) return
    const flow: ActivationStepId[] = ['connect', 'deploy', 'permissions', 'fund']
    const currentIdx = flow.indexOf(
      currentStep as Exclude<ActivationStepId, 'complete'>,
    )
    if (currentIdx <= 0) return
    setError(null)
    const prevStep = flow[currentIdx - 1]
    const prevIdx = flow.indexOf(prevStep)
    const current = useActivationStore.getState().getWallet(address).completedSteps
    useActivationStore.getState().patchWallet(address, {
      completedSteps: current.filter((s) => {
        const idx = flow.indexOf(s as Exclude<ActivationStepId, 'complete'>)
        return idx < prevIdx
      }),
      phase: 'idle',
    })
  }, [address, currentStep])

  // ─── Can this step proceed? ─────────────────────────────────────────────
  const canProceed = useCallback(
    (step: ActivationStepId) => {
      if (step === 'connect') return isConnected
      if (step === 'deploy') return completedSteps.includes('connect')
      if (step === 'permissions') return completedSteps.includes('deploy')
      if (step === 'fund') return completedSteps.includes('permissions')
      return completedSteps.includes('fund')
    },
    [isConnected, completedSteps],
  )

  return {
    phase: derivedPhase,
    error,
    steps,
    progressPercent,
    currentStep,
    currentStepIndex,
    isConnected,
    address,
    chainId,
    connectPending,
    connectError,
    smartAccountAddress,
    deployTxHash,
    fundTxHash,
    oneShotTaskId,
    fundAmountUsdc,
    setFundAmountUsdc,
    connectWallet,
    deploySmartAccount,
    requestPermissions,
    fundTreasury,
    cancelFunding,
    loadPredictedAddress,
    resetActivation,
    goBack,
    canProceed,
    disconnect,
    ensureForgeNetwork,
    /** @deprecated Use ensureForgeNetwork */
    ensureSepolia: ensureForgeNetwork,
    isForgeChain: chainId === ACTIVATION_CHAIN_ID,
    /** @deprecated Use isForgeChain */
    isSepolia: chainId === ACTIVATION_CHAIN_ID,
    /** @deprecated Use isForgeChain */
    isBase: chainId === ACTIVATION_CHAIN_ID,
  }
}
