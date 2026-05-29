# ForgeOS chain strategy

## Primary testnet: Ethereum Sepolia (11155111)

Default for the app, ERC-7715 Flask, and 1Shot relay.

| Layer            | Chain              | ID        |
|------------------|--------------------|-----------|
| Contracts deploy | Ethereum Sepolia   | `11155111` |
| Wallet / wagmi   | Ethereum Sepolia   | `11155111` |
| 1Shot relay      | Ethereum Sepolia   | `11155111` → `https://relayer.1shotapi.dev/relayers` |
| USDC (test)      | Ethereum Sepolia   | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## Deployed contracts (Ethereum Sepolia) — **use these in app**

| Contract | Address | Etherscan |
|----------|---------|-----------|
| ForgeOSRegistry | `0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68` | [view](https://sepolia.etherscan.io/address/0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68) |
| OSKernel | `0xa4bD3e0946431dFA0C38F700f5935E03b749C77C` | [view](https://sepolia.etherscan.io/address/0xa4bD3e0946431dFA0C38F700f5935E03b749C77C) |
| AgentTreasury | `0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429` | [view](https://sepolia.etherscan.io/address/0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429) |

Deploy cost: **~0.01695 ETH** total (block 10945007).

**Note:** `OSKernel.owner()` was set to Foundry’s `DefaultSender` (`0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38`) in simulation; on-chain owner may differ from deployer `0x9aC2d5…` — check Etherscan before owner-only actions.

Verification: fix `ETHERSCAN_API_KEY` (Etherscan.io key, not Basescan) and re-run `forge verify-contract`.

## Deploy command (Ethereum Sepolia)

```bash
cd contracts
source .env   # SEPOLIA_RPC_URL, USDC_ADDRESS, ETHERSCAN_API_KEY

forge script script/Deploy.s.sol \
  --account deployer-onetruehomie \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  --verify \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  -vvvv
```

Explorer: https://sepolia.etherscan.io

## Alternate: Base Sepolia (84532)

Cheaper deploy (~0.000018 ETH). Use only if you do not need ERC-7715 on L1 Sepolia.

| Contract | Address |
|----------|---------|
| ForgeOSRegistry | `0x56D0D2bBc289CC51BDA49F38d05e8F7f9EBf2804` |
| OSKernel | `0x110502e906671e7715016472407a1981309501A8` |
| AgentTreasury | `0xd764DB26b34305eAc115c8051c6Bc9AeA947aa42` |

```bash
forge script script/Deploy.s.sol \
  --account deployer-onetruehomie \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast --verify --chain base-sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" -vvvv
```

## Venice x402 (live)

| Feature | Chain | ID |
|---------|-------|-----|
| Venice x402 | Base mainnet | `8453` |

Set `VENICE_CHAIN_ID=8453` (default).

## 1Shot relayer URLs

| Environment | `ONESHOT_RELAYER_URL` |
|-------------|------------------------|
| Sepolia / Base Sepolia (dev) | `https://relayer.1shotapi.dev/relayers` |
| Mainnet (production) | `https://relayer.1shotapi.com/relayers` |

ForgeOS defaults to **`.dev`** when `ONESHOT_CHAIN_ID` is `11155111` or `84532`. Override with `ONESHOT_RELAYER_URL` in `.env.local` / Vercel.

## Deployer wallet

- Keystore: `deployer-onetruehomie`
- Address: `0x9aC2d5a0A0E88D459Ecfb68Bcbb94DFD7cdF1f09`
- Fund on **Ethereum Sepolia** for L1 deploy (~0.01 ETH minimum).
