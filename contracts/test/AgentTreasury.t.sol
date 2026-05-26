// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Test } from "forge-std/Test.sol";
import { AgentTreasury } from "../src/AgentTreasury.sol";
import { IAgentTreasury } from "../src/interfaces/IAgentTreasury.sol";
import { OSKernel } from "../src/OSKernel.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockVenicePayee } from "./mocks/MockVenicePayee.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";

contract AgentTreasuryTest is Test {
    MockERC20 public usdc;
    OSKernel public kernel;
    AgentTreasury public treasury;
    MockVenicePayee public venice;

    address public owner = makeAddr("owner");
    address public platform = makeAddr("platform");
    bytes32 public agentId = keccak256("payment-executor");
    bytes32 public delegationHash;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        kernel = new OSKernel(owner);
        treasury = new AgentTreasury(address(usdc), address(kernel), platform, owner);
        venice = new MockVenicePayee(address(usdc));

        bytes32 rootAuthority = kernel.ROOT_AUTHORITY();
        vm.prank(owner);
        delegationHash = kernel.delegate(
            Delegation({
                delegate: makeAddr("agent"),
                delegator: owner,
                authority: rootAuthority,
                caveats: new Caveat[](0),
                salt: 0,
                signature: ""
            })
        );

        usdc.mint(owner, 10_000e6);
        vm.startPrank(owner);
        usdc.approve(address(treasury), 10_000e6);
        treasury.fund(1000e6);
        treasury.setAgentBudget(agentId, 500e6);
        vm.stopPrank();
    }

    function test_fund_and_balance() public {
        assertEq(treasury.getBalance(), 1000e6);
    }

    function test_execute_payment_revenue_split() public {
        uint256 amount = 100e6;
        bytes memory proof = abi.encode(delegationHash);

        vm.prank(owner);
        treasury.executePayment(address(venice), amount, agentId, proof);

        assertEq(treasury.getAgentSpend(agentId), amount);
        assertEq(treasury.refillPool(), (amount * 1500) / 10_000);
        assertEq(usdc.balanceOf(platform), (amount * 500) / 10_000);
    }

    function test_revert_invalid_proof() public {
        bytes memory proof = abi.encode(keccak256("inactive"));

        vm.prank(owner);
        vm.expectRevert(IAgentTreasury.InvalidDelegationProof.selector);
        treasury.executePayment(address(venice), 10e6, agentId, proof);
    }
}
