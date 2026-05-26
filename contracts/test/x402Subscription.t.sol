// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Test } from "forge-std/Test.sol";
import { AgentTreasury } from "../src/AgentTreasury.sol";
import { OSKernel } from "../src/OSKernel.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockVenicePayee } from "./mocks/MockVenicePayee.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";
import { TimestampEnforcer } from "@metamask/delegation-framework/enforcers/TimestampEnforcer.sol";
import { ERC20TransferAmountEnforcer } from "@metamask/delegation-framework/enforcers/ERC20TransferAmountEnforcer.sol";
import { LimitedCallsEnforcer } from "@metamask/delegation-framework/enforcers/LimitedCallsEnforcer.sol";

/// @notice Simulates 3 subscription cycles using Timestamp + LimitedCalls + amount caveats.
contract x402SubscriptionTest is Test {
    MockERC20 public usdc;
    OSKernel public kernel;
    AgentTreasury public treasury;
    MockVenicePayee public venice;

    TimestampEnforcer public timestampEnforcer;
    ERC20TransferAmountEnforcer public amountEnforcer;
    LimitedCallsEnforcer public callsEnforcer;

    address public owner = makeAddr("owner");
    bytes32 public agentId = keccak256("venice-subscription");
    bytes32 public subDelegationHash;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        kernel = new OSKernel(owner);
        treasury = new AgentTreasury(address(usdc), address(kernel), makeAddr("platform"), owner);
        venice = new MockVenicePayee(address(usdc));

        timestampEnforcer = new TimestampEnforcer();
        amountEnforcer = new ERC20TransferAmountEnforcer();
        callsEnforcer = new LimitedCallsEnforcer();

        uint128 validAfter = uint128(block.timestamp);
        uint128 validBefore = uint128(block.timestamp + 30 days);

        Caveat[] memory caveats = new Caveat[](3);
        caveats[0] = Caveat({
            enforcer: address(timestampEnforcer),
            terms: abi.encodePacked(validAfter, validBefore),
            args: ""
        });
        caveats[1] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(address(usdc), uint256(10e6)),
            args: ""
        });
        caveats[2] = Caveat({
            enforcer: address(callsEnforcer),
            terms: abi.encode(uint256(3)),
            args: ""
        });

        bytes32 rootAuthority = kernel.ROOT_AUTHORITY();
        vm.prank(owner);
        subDelegationHash = kernel.delegate(
            Delegation({
                delegate: makeAddr("paymentAgent"),
                delegator: owner,
                authority: rootAuthority,
                caveats: caveats,
                salt: 0,
                signature: ""
            })
        );

        usdc.mint(owner, 100e6);
        vm.startPrank(owner);
        usdc.approve(address(treasury), 100e6);
        treasury.fund(100e6);
        vm.stopPrank();
    }

    function test_three_subscription_cycles() public {
        bytes memory proof = abi.encode(subDelegationHash);
        uint256 cycleAmount = 10e6;

        for (uint256 i = 0; i < 3; ++i) {
            vm.warp(block.timestamp + 1 hours);
            vm.prank(owner);
            treasury.executePayment(address(venice), cycleAmount, agentId, proof);
        }

        assertEq(treasury.getAgentSpend(agentId), 30e6);
        uint256 expectedToVenice = 30e6 - ((30e6 * 500) / 10_000);
        assertEq(usdc.balanceOf(address(venice)), expectedToVenice);
    }
}
