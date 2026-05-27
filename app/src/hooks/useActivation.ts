'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useDisconnect, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { createPublicClient, custom, http, parseAbi, parseUnits } from 'viem'
import { useForgeWalletConnect } from '@/hooks/useForgeWalletConnect'
import { createClient } from 'viem'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { CONTRACTS } from '@/lib/contracts'
import { buildActivationPermissions } from '@/lib/delegation/buildPermissions'
import {
  createRootDelegationStruct,
  kitDelegationToForge,
} from '@/lib/delegation/createRootDelegation'
import { predictSmartAccountAddress } from '@/lib/smart-account/predictAddress'
import {
  clearActivationState,
  loadActivationState,
  saveActivationState,
} from '@/lib/activation/storage'
import {
  isStaleActivationState,
  sanitizeStaleActivation,
} from '@/lib/activation/stale-state'
import { isOneShotUnavailableError } from '@/lib/activation/oneshot-unavailable'
import { forgeChain } from '@/lib/wagmi/chains'
import { ensureForgeChain } from '@/lib/wagmi/ensure-forge-chain'
import {
  formatErc7715Error,
  formatWalletError,
  getErc7715Provider,
  getEthereumProvider,
  getEthereumProviderDiagnostics,
  hasEthereumProvider,
  probeErc7715RpcSupport,
  refreshWalletRuntimeCache,
} from '@/lib/wagmi/ethereum-provider'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import type {
  ActivationPhase,
  ActivationStepId,
  ActivationStepState,
  ActivationPersistedState,
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
  const setRootDelegation = useOsStore((s) => s.setRootDelegation)
  const setKernel = useOsStore((s) => s.setKernel)
  const setActivationStep = useOsStore((s) => s.setActivationStep)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)

  const [phase, setPhase] = useState<ActivationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(
    null,
  )
  const [deployTxHash, setDeployTxHash] = useState<Hash | null>(null)
  const [fundTxHash, setFundTxHash] = useState<Hash | null>(null)
  const [oneShotTaskId, setOneShotTaskId] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<ActivationStepId[]>([])
  const [fundAmountUsdc, setFundAmountUsdc] = useState('10')
  const fundAbortRef = useRef<AbortController | null>(null)

  const persist = useCallback(
    (patch: Partial<ActivationPersistedState>) => {
      const prev = loadActivationState()
      saveActivationState({
        phase,
        completedSteps,
        smartAccountAddress: smartAccountAddress ?? undefined,
        kernelAddress: CONTRACTS.osKernel,
        treasuryAddress: CONTRACTS.agentTreasury,
        delegationHash: useOsStore.getState().rootDelegation?.hash,
        deployTxHash: deployTxHash ?? undefined,
        fundTxHash: fundTxHash ?? undefined,
        oneShotTaskId: oneShotTaskId ?? undefined,
        updatedAt: Date.now(),
        ...prev,
        ...patch,
      })
    },
    [
      phase,
      completedSteps,
      smartAccountAddress,
      deployTxHash,
      fundTxHash,
      oneShotTaskId,
    ],
  )

  useEffect(() => {
    const raw = loadActivationState()
    if (!raw) return

    const saved = isStaleActivationState(raw) ? sanitizeStaleActivation(raw) : raw
    if (saved !== raw) {
      saveActivationState(saved)
      setOsStatus('inactive')
      setKernel(null)
    }

    setPhase(saved.phase === 'funding' ? 'idle' : saved.phase)
    setCompletedSteps(saved.completedSteps)
    if (saved.smartAccountAddress) {
      setSmartAccountAddress(saved.smartAccountAddress)
    }
    if (saved.deployTxHash) setDeployTxHash(saved.deployTxHash)
    if (saved.fundTxHash) setFundTxHash(saved.fundTxHash)
    if (saved.oneShotTaskId) setOneShotTaskId(saved.oneShotTaskId)
    if (saved.phase === 'active' && !isStaleActivationState(saved)) {
      setOsStatus('active')
      setActivationStep(4)
    }
    if (saved.rootDelegation) {
      setRootDelegation(saved.rootDelegation)
      setDelegations([saved.rootDelegation])
    }

  }, [setOsStatus, setActivationStep, setRootDelegation, setDelegations, setKernel])

  const currentStep = resolveCurrentStep(phase, completedSteps)
  const currentStepIndex = stepIndex(currentStep)

  const steps: ActivationStepState[] = useMemo(
    () =>
      [
        {
          id: 'connect' as const,
          title: 'Connect wallet',
          description: 'Link MetaMask — your EOA becomes the root of agent permissions.',
        },
        {
          id: 'deploy' as const,
          title: 'Smart account',
          description: 'Upgrade to a MetaMask Smart Account (EIP-7702). Gasless deploy via 1Shot.',
        },
        {
          id: 'permissions' as const,
          title: 'Sign delegation',
          description: 'One ERC-7715 permission request encodes your spend caps on-chain.',
        },
        {
          id: 'fund' as const,
          title: 'Fund treasury',
          description: 'Deposit USDC on Base for Venice x402 inference and agent payments.',
        },
      ].map((step) => {
        const idx = stepIndex(step.id)
        let status: ActivationStepState['status'] = 'pending'
        if (completedSteps.includes(step.id)) status = 'complete'
        else if (idx === currentStepIndex && phase !== 'active') status = 'current'
        else if (idx < currentStepIndex) status = 'complete'
        if (phase === 'error' && idx === currentStepIndex) status = 'error'
        return { ...step, status, error: status === 'error' ? error ?? undefined : undefined }
      }),
    [completedSteps, currentStepIndex, phase, error],
  )

  const progressPercent = useMemo(() => {
    const done = completedSteps.length
    return Math.min(100, Math.round((done / 4) * 100))
  }, [completedSteps])

  const markComplete = useCallback((step: ActivationStepId) => {
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev : [...prev, step],
    )
  }, [])

  const ensureForgeNetwork = useCallback(async () => {
    if (chainId === ACTIVATION_CHAIN_ID) return
    await ensureForgeChain(switchChainAsync)
  }, [chainId, switchChainAsync])

  const connectWallet = useCallback(async () => {
    setError(null)
    setPhase('connecting')
    try {
      await connectForgeWallet()
    } catch (e) {
      setPhase('error')
      setError(formatWalletError(e))
    }
  }, [connectForgeWallet])

  useEffect(() => {
    if (phase !== 'connecting' || !isConnected || !address) return
    void (async () => {
      try {
        await ensureForgeChain(switchChainAsync)
        markComplete('connect')
        setPhase('idle')
        setActivationStep(1)
        persist({ phase: 'idle', completedSteps: ['connect'] })
      } catch (e) {
        setPhase('error')
        setError(formatWalletError(e))
      }
    })()
  }, [
    phase,
    isConnected,
    address,
    markComplete,
    persist,
    setActivationStep,
    switchChainAsync,
  ])

  const loadPredictedAddress = useCallback(async () => {
    if (!address) return null
    try {
      const predicted = await predictSmartAccountAddress(address)
      setSmartAccountAddress(predicted)
      return predicted
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to predict smart account')
      return null
    }
  }, [address])

  const deploySmartAccount = useCallback(async () => {
    setError(null)
    setPhase('deploying')
    try {
      if (!address) throw new Error('Connect wallet first')
      await ensureForgeNetwork()
      const predicted = await loadPredictedAddress()
      if (!predicted) throw new Error('Could not resolve smart account address')

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
        if (!isOneShotUnavailableError(relayError)) {
          throw new Error(relayError)
        }
        // EIP-7702 Stateless: smart account address is the connected EOA.
        // 1Shot has no Sepolia payment tokens — proceed without gasless relay.
        if (predicted.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            '1Shot unavailable and smart account address differs from wallet. Cannot deploy on Sepolia.',
          )
        }
      }

      setOneShotTaskId(taskId)
      if (txHash) setDeployTxHash(txHash)
      markComplete('deploy')
      setPhase('idle')
      setActivationStep(2)
      persist({
        phase: 'idle',
        completedSteps: [...completedSteps, 'deploy'],
        smartAccountAddress: predicted,
        deployTxHash: txHash,
        oneShotTaskId: taskId ?? undefined,
      })
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Deploy failed')
    }
  }, [
    address,
    chainId,
    ensureForgeNetwork,
    loadPredictedAddress,
    markComplete,
    persist,
    completedSteps,
    setActivationStep,
  ])

  const requestPermissions = useCallback(async () => {
    setError(null)
    setPhase('requesting_permissions')
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

      const permissions = buildActivationPermissions(CONTRACTS.osKernel)
      const granted = await erc7715Client.requestExecutionPermissions(permissions)

      const delegator = (smartAccountAddress ?? address) as Address
      const kitDel = await createRootDelegationStruct({ delegator })
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
        }),
      })
      const delegateData = (await delegateRes.json()) as { taskId?: string; error?: string }
      if (!delegateRes.ok) {
        const relayError = delegateData.error ?? 'On-chain delegate relay failed'
        if (!isOneShotUnavailableError(relayError)) {
          throw new Error(relayError)
        }
      } else {
        setOneShotTaskId(delegateData.taskId ?? null)
      }

      markComplete('permissions')
      setPhase('idle')
      setActivationStep(3)
      persist({
        phase: 'idle',
        completedSteps: [...completedSteps, 'permissions'],
        delegationHash: forgeDel.hash,
        rootDelegation: forgeDel,
      })
    } catch (e) {
      setPhase('error')
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
    persist,
    completedSteps,
    setRootDelegation,
    setDelegations,
    setActivationStep,
    switchChainAsync,
  ])

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
      setPhase('active')
      setActivationStep(4)
      persist({
        phase: 'active',
        completedSteps: [...completedSteps, 'fund', 'complete'],
        fundTxHash: tx,
      })
    },
    [
      deployTxHash,
      markComplete,
      persist,
      completedSteps,
      setKernel,
      setOsStatus,
      setActivationStep,
    ],
  )

  const fundTreasury = useCallback(async () => {
    setError(null)
    setPhase('funding')
    fundAbortRef.current?.abort()
    const abort = new AbortController()
    fundAbortRef.current = abort

    try {
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
        const approveHash = await walletClient.writeContract({
          address: fundingUsdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [CONTRACTS.agentTreasury, amountRaw],
          chain: forgeChain,
          account: address,
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      if (abort.signal.aborted) {
        throw new Error('Funding cancelled')
      }

      const fundHash = await walletClient.writeContract({
        address: CONTRACTS.agentTreasury,
        abi: treasuryAbi,
        functionName: 'fund',
        args: [amountRaw],
        chain: forgeChain,
        account: address,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: fundHash })

      if (receipt.status !== 'success') {
        throw new Error('Treasury funding transaction reverted on-chain')
      }

      setFundTxHash(fundHash)
      finishActivation(fundHash)
    } catch (e) {
      if (abort.signal.aborted) {
        setPhase('idle')
        return
      }
      const message = e instanceof Error ? e.message : String(e)
      if (/user denied transaction signature/i.test(message)) {
        setPhase('error')
        setError(
          'Funding needs 2 MetaMask confirmations (approve + fund). The second fund signature was rejected, so no treasury deposit was sent.',
        )
        return
      }
      if (/Wallet network is \d+/.test(message)) {
        setPhase('idle')
        setError(message)
        return
      }
      if (/AgentTreasury expects USDC|Treasury accepts USDC|Treasury funding would fail/i.test(message)) {
        setPhase('idle')
        setError(message)
        return
      }
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Treasury funding failed')
    } finally {
      if (fundAbortRef.current === abort) {
        fundAbortRef.current = null
      }
    }
  }, [
    address,
    chainId,
    connectedWalletClient,
    fundAmountUsdc,
    finishActivation,
  ])

  const cancelFunding = useCallback(() => {
    fundAbortRef.current?.abort()
    setPhase('idle')
    setError(null)
  }, [])

  const resetActivation = useCallback(() => {
    clearActivationState()
    setPhase('idle')
    setError(null)
    setCompletedSteps([])
    setSmartAccountAddress(null)
    setDeployTxHash(null)
    setFundTxHash(null)
    setOneShotTaskId(null)
    setOsStatus('inactive')
    setRootDelegation(null)
    setKernel(null)
    setActivationStep(0)
    disconnect()
  }, [disconnect, setKernel, setOsStatus, setRootDelegation, setActivationStep])

  // If wallet definitively disconnects mid-flow, reset back to connect step so the
  // user can reconnect. We use walletStatus === 'disconnected' (not 'reconnecting')
  // to avoid wiping state during wagmi's automatic reconnection on page load.
  useEffect(() => {
    if (walletStatus !== 'disconnected') return
    setCompletedSteps((prev) => {
      if (!prev.includes('connect')) return prev
      return []
    })
    setPhase((prev) => {
      if (prev === 'active' || prev === 'connecting') return prev
      return 'idle'
    })
    setError(null)
  }, [walletStatus])

  const goBack = useCallback(() => {
    const flow: ActivationStepId[] = ['connect', 'deploy', 'permissions', 'fund']
    const currentIdx = flow.indexOf(
      currentStep as Exclude<ActivationStepId, 'complete'>,
    )
    if (currentIdx <= 0) return
    setError(null)
    setPhase('idle')
    const prevStep = flow[currentIdx - 1]
    const prevIdx = flow.indexOf(prevStep)
    setCompletedSteps((prev) =>
      prev.filter((s) => {
        const idx = flow.indexOf(s as Exclude<ActivationStepId, 'complete'>)
        return idx < prevIdx
      }),
    )
  }, [currentStep])

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
    phase,
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
