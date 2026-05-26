// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Test } from "forge-std/Test.sol";
import { ForgeOSRegistry } from "../src/ForgeOSRegistry.sol";
import { IForgeOSRegistry } from "../src/interfaces/IForgeOSRegistry.sol";

contract ForgeOSRegistryTest is Test {
    ForgeOSRegistry public registry;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        registry = new ForgeOSRegistry();
    }

    function test_registerAgent() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent("DeFi Rebalancer", "https://agent.example/defi");

        IForgeOSRegistry.AgentRecord memory record = registry.getAgent(agentId);
        assertEq(record.owner, alice);
        assertEq(record.name, "DeFi Rebalancer");
        assertTrue(record.active);
        assertTrue(registry.isActive(agentId));
    }

    function test_deactivateAgent() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent("Payment Executor", "https://agent.example/pay");

        vm.prank(alice);
        registry.deactivateAgent(agentId);

        assertFalse(registry.isActive(agentId));
    }

    function test_revert_deactivate_wrong_owner() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent("Agent", "https://a");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IForgeOSRegistry.NotAgentOwner.selector, agentId, bob)
        );
        registry.deactivateAgent(agentId);
    }

    function test_revert_empty_name() public {
        vm.prank(alice);
        vm.expectRevert(IForgeOSRegistry.EmptyName.selector);
        registry.registerAgent("", "https://a");
    }
}
