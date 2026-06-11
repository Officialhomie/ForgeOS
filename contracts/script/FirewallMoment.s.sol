// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Script, console2 } from "forge-std/Script.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";
import { OSKernel } from "../src/OSKernel.sol";

/// @title FirewallMoment
/// @notice Produces the live creation-time narrowing evidence on the deployed
///         Sepolia OSKernel (SHIP_AUDIT.md "Redeem Decision" fallback branch):
///         1. Registers a root delegation (owner -> DeFi agent, 500 USDC cap).
///         2. Attempts a WIDENING redelegation (1000 USDC) — expected to revert
///            with CaveatWideningNotAllowed. Run separately WITHOUT expectRevert
///            (see step2Widen) to capture a real failed-tx hash for judges.
///         3. Submits a NARROWING redelegation (100 USDC) — succeeds.
///
/// Usage (owner = deployer keystore):
///   forge script script/FirewallMoment.s.sol --sig "run()" \
///     --account deployer-onetruehomie --rpc-url "$SEPOLIA_RPC_URL" --broadcast -vvvv
/// To capture the live widening revert as an on-chain failed tx:
///   forge script script/FirewallMoment.s.sol --sig "step2Widen()" \
///     --account deployer-onetruehomie --rpc-url "$SEPOLIA_RPC_URL" --broadcast --skip-simulation -vvvv
contract FirewallMoment is Script {
    OSKernel internal constant KERNEL = OSKernel(0xa4bD3e0946431dFA0C38F700f5935E03b749C77C);
    address internal constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    // Verified Sepolia enforcer (CHAINS.md "SEPOLIA_ENFORCERS")
    address internal constant ERC20_TRANSFER_AMOUNT_ENFORCER =
        0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc;
    address internal constant DEFI_AGENT = 0xfD87122f8b2d41e4BD270F477835D387565233D4;
    address internal constant PAYMENT_AGENT = 0x424A9f9Bc1D47172b41B47f9c0A242e6e656A9c5;

    function _caveat(uint256 maxAmount) internal pure returns (Caveat[] memory caveats) {
        caveats = new Caveat[](1);
        // 64-byte abi.encode(token, maxAmount): the format OSKernel's
        // CaveatNarrowing amount comparison expects (not the enforcer's
        // 52-byte packed format — OSKernel validates narrowing structurally).
        caveats[0] = Caveat({
            enforcer: ERC20_TRANSFER_AMOUNT_ENFORCER,
            terms: abi.encode(USDC, maxAmount),
            args: ""
        });
    }

    function _rootDelegation(uint256 salt) internal view returns (Delegation memory) {
        return Delegation({
            delegate: DEFI_AGENT,
            delegator: KERNEL.owner(),
            authority: KERNEL.ROOT_AUTHORITY(),
            caveats: _caveat(500_000_000), // 500 USDC
            salt: salt,
            signature: ""
        });
    }

    function _subDelegation(bytes32 parentHash, uint256 maxAmount, uint256 salt)
        internal
        pure
        returns (Delegation memory)
    {
        return Delegation({
            delegate: PAYMENT_AGENT,
            delegator: DEFI_AGENT,
            authority: parentHash,
            caveats: _caveat(maxAmount),
            salt: salt,
            signature: ""
        });
    }

    /// Registers root + narrowing sub-delegation (both succeed).
    function run() external {
        uint256 salt = vm.envOr("FIREWALL_SALT", block.timestamp);
        vm.startBroadcast();
        bytes32 rootHash = KERNEL.delegate(_rootDelegation(salt));
        console2.log("Root delegation registered (500 USDC cap):");
        console2.logBytes32(rootHash);

        bytes32 subHash = KERNEL.redelegate(_subDelegation(rootHash, 100_000_000, salt), rootHash);
        console2.log("Narrowing redelegation accepted (100 USDC cap):");
        console2.logBytes32(subHash);
        vm.stopBroadcast();
    }

    /// Attempts the WIDENING redelegation against an existing root delegation.
    /// Set FIREWALL_ROOT_HASH to the hash printed by run(). With --broadcast
    /// --skip-simulation this lands a real failed tx on Sepolia whose revert is
    /// CaveatWideningNotAllowed("amount exceeds parent").
    function step2Widen() external {
        bytes32 rootHash = vm.envBytes32("FIREWALL_ROOT_HASH");
        uint256 salt = vm.envOr("FIREWALL_SALT", block.timestamp);
        vm.startBroadcast();
        KERNEL.redelegate(_subDelegation(rootHash, 1_000_000_000, salt + 1), rootHash);
        vm.stopBroadcast();
    }
}
