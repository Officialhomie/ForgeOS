// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Delegation } from "@metamask/delegation-framework/utils/Types.sol";

/// @title IOSKernel
/// @notice Root delegation receiver and sub-delegation router for ForgeOS.
///         Inherits EIP7702DeleGatorCore from the MetaMask Delegation Framework.
interface IOSKernel {
    // ─── EVENTS ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new delegation is granted from this kernel.
    event DelegationGranted(
        bytes32 indexed delegationHash,
        address indexed delegate,
        address indexed delegator
    );

    /// @notice Emitted when a single delegation is revoked.
    event DelegationRevoked(bytes32 indexed delegationHash);

    /// @notice Emitted when all delegations are atomically revoked.
    event AllDelegationsRevoked(address indexed owner, uint256 count);

    // ─── FUNCTIONS ────────────────────────────────────────────────────────────

    /// @notice Grant a new root delegation from the kernel to an agent.
    /// @param delegation The delegation struct (authority must be ROOT_AUTHORITY).
    /// @return delegationHash Keccak256 hash identifying this delegation.
    function delegate(Delegation calldata delegation)
        external
        returns (bytes32 delegationHash);

    /// @notice Issue a sub-delegation chained from an existing delegation.
    /// @param delegation The new sub-delegation (authority = parentHash).
    /// @param parentHash Hash of the parent delegation — must be active.
    /// @return subDelegationHash Hash of the new sub-delegation.
    /// @dev Caveats must be a strict subset (narrower) of the parent delegation.
    function redelegate(Delegation calldata delegation, bytes32 parentHash)
        external
        returns (bytes32 subDelegationHash);

    /// @notice Revoke a single active delegation.
    /// @param delegationHash The hash of the delegation to revoke.
    function revokeOne(bytes32 delegationHash) external;

    /// @notice Atomically revoke ALL active delegations.
    ///         Kills every agent sub-delegation in a single transaction.
    ///         Emergency kill switch — all agents stop immediately.
    /// @return count Number of delegations that were revoked.
    function revokeAll() external returns (uint256 count);

    /// @notice Check whether a delegation is currently active.
    /// @param delegationHash The hash to query.
    /// @return active True if the delegation exists and has not been revoked.
    function isDelegationActive(bytes32 delegationHash)
        external
        view
        returns (bool active);

    /// @notice Return the owner (deploying EOA / smart account) of this kernel.
    function owner() external view returns (address);
}
