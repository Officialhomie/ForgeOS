// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @notice Minimal environment holder for tests (delegation manager + entry point placeholders).
contract MockDeleGatorEnv {
    address public delegationManager;
    address public entryPoint;

    constructor(address delegationManager_, address entryPoint_) {
        delegationManager = delegationManager_;
        entryPoint = entryPoint_;
    }
}
