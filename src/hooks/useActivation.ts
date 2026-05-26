'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from 'wagmi'
import { createWalletClient, custom } from 'viem'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { isDemoMode } from '@/lib/demo'
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
import { sepolia, base } from '@/lib/wagmi/chains'
import { MOCK_DELEGATIONS } from '@/lib/mock-data'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import type {
  ActivationPhase,
  ActivationStepId,
  ActivationStepState,
  ActivationPersistedState,
} from '@/types/activation'
import { ACTIVATION_CHAIN_SEPOLIA } from '@/types/activation'
import type { Address, Hash, OSKernelConfig } from '@/types'
import { sleep } from '@/lib/utils'

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
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: connectPending, error: connectError } =
    useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

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

  const demo = isDemoMode()

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
    const saved = loadActivationState()
    if (!saved) return
    setPhase(saved.phase)
    setCompletedSteps(saved.completedSteps)
    if (saved.smartAccountAddress) {
      setSmartAccountAddress(saved.smartAccountAddress)
    }
    if (saved.deployTxHash) setDeployTxHash(saved.deployTxHash)
    if (saved.fundTxHash) setFundTxHash(saved.fundTxHash)
    if (saved.oneShotTaskId) setOneShotTaskId(saved.oneShotTaskId)
    if (saved.phase === 'active') {
      setOsStatus('active')
      setActivationStep(4)
    }
  }, [setOsStatus, setActivationStep])

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

  useEffect(() => {
    if (isConnected && address && !completedSteps.includes('connect')) {
      markComplete('connect')
      setActivationStep(1)
    }
  }, [isConnected, address, completedSteps, markComplete, setActivationStep])

  const ensureSepolia = useCallback(async () => {
    if (chainId === ACTIVATION_CHAIN_SEPOLIA) return
    await switchChain({ chainId: ACTIVATION_CHAIN_SEPOLIA })
  }, [chainId, switchChain])

  const connectWallet = useCallback(async () => {
    setError(null)
    setPhase('connecting')
    const mm = connectors.find((c) => c.id === 'metaMask') ?? connectors[0]
    if (!mm) {
      setPhase('error')
      setError('No wallet connector available')
      return
    }
    connect({ connector: mm })
  }, [connect, connectors])

  useEffect(() => {
    if (phase === 'connecting' && isConnected && address) {
      markComplete('connect')
      setPhase('idle')
      setActivationStep(1)
      persist({ phase: 'idle', completedSteps: ['connect'] })
    }
  }, [phase, isConnected, address, markComplete, persist, setActivationStep])

  const loadPredictedAddress = useCallback(async () => {
    if (!address) return null
    if (demo) {
      const predicted = address as Address
      setSmartAccountAddress(predicted)
      return predicted
    }
    try {
      const predicted = await predictSmartAccountAddress(address)
      setSmartAccountAddress(predicted)
      return predicted
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to predict smart account')
      return null
    }
  }, [address, demo])

  const deploySmartAccount = useCallback(async () => {
    setError(null)
    setPhase('deploying')
    try {
      if (!demo) await ensureSepolia()
      const predicted = await loadPredictedAddress()
      if (!predicted) throw new Error('Could not resolve smart account address')

      if (demo) {
        await sleep(1200)
        const mockTx =
          '0xDEPLOY000000000000000000000000000000000000000000000000000000001' as Hash
        setDeployTxHash(mockTx)
        setOneShotTaskId('demo-deploy-task')
        markComplete('deploy')
        setPhase('idle')
        setActivationStep(2)
        persist({
          phase: 'idle',
          completedSteps: [...completedSteps, 'deploy'],
          smartAccountAddress: predicted,
          deployTxHash: mockTx,
        })
        return
      }

      const res = await fetch('/api/relay/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: ACTIVATION_CHAIN_SEPOLIA,
          smartAccountAddress: predicted,
        }),
      })
      const data = (await res.json()) as {
        taskId?: string
        txHash?: Hash
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Deploy relay failed')
      setOneShotTaskId(data.taskId ?? null)
      if (data.txHash) setDeployTxHash(data.txHash)
      markComplete('deploy')
      setPhase('idle')
      setActivationStep(2)
      persist({
        phase: 'idle',
        completedSteps: [...completedSteps, 'deploy'],
        smartAccountAddress: predicted,
        deployTxHash: data.txHash,
        oneShotTaskId: data.taskId,
      })
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Deploy failed')
    }
  }, [
    demo,
    ensureSepolia,
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
      if (!demo && chainId !== ACTIVATION_CHAIN_SEPOLIA) {
        throw new Error('ERC-7715 is only available on Sepolia. Switch network and retry.')
      }

      if (demo) {
        await sleep(1500)
        const root = MOCK_DELEGATIONS.root
        setRootDelegation(root)
        setDelegations([root])
        markComplete('permissions')
        setPhase('idle')
        setActivationStep(3)
        persist({
          phase: 'idle',
          completedSteps: [...completedSteps, 'permissions'],
          delegationHash: root.hash,
        })
        return
      }

      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not available')
      }

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions())

      const permissions = buildActivationPermissions(CONTRACTS.osKernel)
      const granted = await walletClient.requestExecutionPermissions(
        permissions,
      )

      const delegator = (smartAccountAddress ?? address) as Address
      const kitDel = await createRootDelegationStruct({ delegator })
      const forgeDel = kitDelegationToForge(
        kitDel,
        '0x' + '00'.repeat(65) as `0x${string}`,
      )
      if (granted[0]?.context) {
        forgeDel.signature = granted[0].context
      }

      setRootDelegation(forgeDel)
      setDelegations([forgeDel])

      const delegateRes = await fetch('/api/relay/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: ACTIVATION_CHAIN_SEPOLIA,
          delegationHash: forgeDel.hash,
        }),
      })
      const delegateData = (await delegateRes.json()) as { taskId?: string; error?: string }
      if (!delegateRes.ok) {
        throw new Error(delegateData.error ?? 'On-chain delegate relay failed')
      }
      setOneShotTaskId(delegateData.taskId ?? null)

      markComplete('permissions')
      setPhase('idle')
      setActivationStep(3)
      persist({
        phase: 'idle',
        completedSteps: [...completedSteps, 'permissions'],
        delegationHash: forgeDel.hash,
      })
    } catch (e) {
      setPhase('error')
      setError(
        e instanceof Error
          ? e.message
          : 'Permission request failed — ensure MetaMask Snaps ERC-7715 is enabled on Sepolia',
      )
    }
  }, [
    address,
    chainId,
    demo,
    smartAccountAddress,
    markComplete,
    persist,
    completedSteps,
    setRootDelegation,
    setDelegations,
    setActivationStep,
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
        chainId: ACTIVATION_CHAIN_SEPOLIA,
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
    try {
      if (!demo && chainId !== base.id) {
        await switchChain({ chainId: base.id })
      }

      if (demo) {
        await sleep(1000)
        const mockFund =
          '0xFUND00000000000000000000000000000000000000000000000000000000001' as Hash
        setFundTxHash(mockFund)
        finishActivation(mockFund)
        return
      }

      const res = await fetch('/api/relay/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: base.id,
          amountUsdc: fundAmountUsdc,
          treasuryAddress: CONTRACTS.agentTreasury,
        }),
      })
      const data = (await res.json()) as { taskId?: string; txHash?: Hash; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Fund relay failed')
      if (data.txHash) setFundTxHash(data.txHash)
      finishActivation(data.txHash)
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Treasury funding failed')
    }
  }, [chainId, demo, fundAmountUsdc, switchChain, finishActivation])

  const skipDemoActivation = useCallback(() => {
    const root = MOCK_DELEGATIONS.root
    setRootDelegation(root)
    setDelegations(Object.values(MOCK_DELEGATIONS))
    setOsStatus('active')
    setActivationStep(4)
    setPhase('active')
    setCompletedSteps(['connect', 'deploy', 'permissions', 'fund', 'complete'])
    saveActivationState({
      phase: 'active',
      completedSteps: ['connect', 'deploy', 'permissions', 'fund', 'complete'],
      smartAccountAddress: address ?? ('0x0000000000000000000000000000000000000001' as Address),
      updatedAt: Date.now(),
    })
  }, [address, setDelegations, setOsStatus, setRootDelegation, setActivationStep])

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
    demo,
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
    loadPredictedAddress,
    skipDemoActivation,
    resetActivation,
    canProceed,
    disconnect,
    ensureSepolia,
    isSepolia: chainId === ACTIVATION_CHAIN_SEPOLIA,
    isBase: chainId === base.id,
  }
}
