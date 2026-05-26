// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Test } from "forge-std/Test.sol";
import { OSKernel } from "../src/OSKernel.sol";
import { CaveatNarrowing } from "../src/libraries/CaveatNarrowing.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";
import { ERC20TransferAmountEnforcer } from "@metamask/delegation-framework/enforcers/ERC20TransferAmountEnforcer.sol";
import { LimitedCallsEnforcer } from "@metamask/delegation-framework/enforcers/LimitedCallsEnforcer.sol";

/// @title DelegationChainTest
/// @notice 2-hop chain: User(owner) → OSKernel → DeFiAgent → PaymentAgent
contract DelegationChainTest is Test {
    OSKernel public kernel;
    ERC20TransferAmountEnforcer public amountEnforcer;
    LimitedCallsEnforcer public callsEnforcer;

    address public owner = makeAddr("owner");
    address public kernelAddr;
    address public defiAgent = makeAddr("defiAgent");
    address public paymentAgent = makeAddr("paymentAgent");
    address public usdc = makeAddr("usdc");

    bytes32 public rootHash;

    function setUp() public {
        kernel = new OSKernel(owner);
        kernelAddr = address(kernel);
        amountEnforcer = new ERC20TransferAmountEnforcer();
        callsEnforcer = new LimitedCallsEnforcer();

        Caveat[] memory rootCaveats = new Caveat[](1);
        rootCaveats[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(1000e6)),
            args: ""
        });

        bytes32 rootAuthority = kernel.ROOT_AUTHORITY();
        vm.prank(owner);
        rootHash = kernel.delegate(
            Delegation({
                delegate: kernelAddr,
                delegator: owner,
                authority: rootAuthority,
                caveats: rootCaveats,
                salt: 0,
                signature: ""
            })
        );

        Caveat[] memory subCaveats = new Caveat[](1);
        subCaveats[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(500e6)),
            args: ""
        });

        vm.prank(owner);
        bytes32 subHash = kernel.redelegate(
            Delegation({
                delegate: defiAgent,
                delegator: kernelAddr,
                authority: rootHash,
                caveats: subCaveats,
                salt: 0,
                signature: ""
            }),
            rootHash
        );

        Caveat[] memory reDelCaveats = new Caveat[](2);
        reDelCaveats[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(100e6)),
            args: ""
        });
        reDelCaveats[1] = Caveat({
            enforcer: address(callsEnforcer),
            terms: abi.encode(uint256(1)),
            args: ""
        });

        vm.prank(owner);
        bytes32 payHash = kernel.redelegate(
            Delegation({
                delegate: paymentAgent,
                delegator: defiAgent,
                authority: subHash,
                caveats: reDelCaveats,
                salt: 0,
                signature: ""
            }),
            subHash
        );

        assertTrue(kernel.isDelegationActive(payHash));
    }

    function test_revert_widen_amount_on_redelegate() public {
        Caveat[] memory wideCaveats = new Caveat[](1);
        wideCaveats[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(2000e6)),
            args: ""
        });

        vm.prank(owner);
        vm.expectRevert();
        kernel.redelegate(
            Delegation({
                delegate: defiAgent,
                delegator: kernelAddr,
                authority: rootHash,
                caveats: wideCaveats,
                salt: 1,
                signature: ""
            }),
            rootHash
        );
    }

    function test_caveat_narrowing_reverts_widen() public {
        Caveat[] memory parent = new Caveat[](1);
        parent[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(500e6)),
            args: ""
        });
        Caveat[] memory child = new Caveat[](1);
        child[0] = Caveat({
            enforcer: address(amountEnforcer),
            terms: abi.encode(usdc, uint256(1000e6)),
            args: ""
        });

        vm.expectRevert();
        this._validateSubsetExternal(parent, child);
    }

    function _validateSubsetExternal(Caveat[] memory parent, Caveat[] memory child) external pure {
        CaveatNarrowing.validateSubset(parent, child);
    }
}
