# ForgeOS chain strategy

## Primary testnet: Ethereum Sepolia (11155111)

Default for the app, ERC-7715 Flask, and 1Shot relay.

| Layer            | Chain              | ID        |
|------------------|--------------------|-----------|
| Contracts deploy | Ethereum Sepolia   | `11155111` |
| Wallet / wagmi   | Ethereum Sepolia   | `11155111` |
| 1Shot relay      | Ethereum Sepolia   | `11155111` |
| USDC (test)      | Ethereum Sepolia   | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## Deployed contracts (Ethereum Sepolia) — **use these in app**

| Contract | Address | Etherscan |
|----------|---------|-----------|
| ForgeOSRegistry | `0x4668B4Dd600FB4404783a9C73B6b4fcb71e78347` | [view](https://sepolia.etherscan.io/address/0x4668B4Dd600FB4404783a9C73B6b4fcb71e78347) |
| OSKernel | `0xcFC6BECB0054D6e313a88c70CcE1d477D8752382` | [view](https://sepolia.etherscan.io/address/0xcFC6BECB0054D6e313a88c70CcE1d477D8752382) |
| AgentTreasury | `0xe0DD408BE8cb3Dfe6441FEfE1e209E886F48071A` | [view](https://sepolia.etherscan.io/address/0xe0DD408BE8cb3Dfe6441FEfE1e209E886F48071A) |

Deploy cost: **~0.00419 ETH** total (block 10934090).

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

## Deployer wallet

- Keystore: `deployer-onetruehomie`
- Address: `0x9aC2d5a0A0E88D459Ecfb68Bcbb94DFD7cdF1f09`
- Fund on **Ethereum Sepolia** for L1 deploy (~0.01 ETH minimum).
