// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Test } from "forge-std/Test.sol";
import { OSKernel } from "../src/OSKernel.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";

contract OSKernelTest is Test {
    OSKernel public kernel;
    address public owner = makeAddr("owner");
    address public defiAgent = makeAddr("defiAgent");
    address public paymentAgent = makeAddr("paymentAgent");

    function setUp() public {
        kernel = new OSKernel(owner);
    }

    function test_delegate_and_revoke_one() public {
        Delegation memory root = _rootDelegation(defiAgent, new Caveat[](0));

        vm.prank(owner);
        bytes32 hash = kernel.delegate(root);
        assertTrue(kernel.isDelegationActive(hash));

        vm.prank(owner);
        kernel.revokeOne(hash);
        assertFalse(kernel.isDelegationActive(hash));
    }

    function test_revoke_all() public {
        vm.startPrank(owner);
        bytes32 h1 = kernel.delegate(_rootDelegation(defiAgent, new Caveat[](0)));
        bytes32 h2 = kernel.delegate(_rootDelegation(paymentAgent, new Caveat[](0)));
        vm.stopPrank();

        assertEq(kernel.activeDelegationCount(), 2);

        vm.prank(owner);
        uint256 count = kernel.revokeAll();
        assertEq(count, 2);
        assertFalse(kernel.isDelegationActive(h1));
        assertFalse(kernel.isDelegationActive(h2));
    }

    function _rootDelegation(address delegate, Caveat[] memory caveats)
        internal
        view
        returns (Delegation memory)
    {
        return Delegation({
            delegate: delegate,
            delegator: owner,
            authority: kernel.ROOT_AUTHORITY(),
            caveats: caveats,
            salt: 0,
            signature: ""
        });
    }
}
