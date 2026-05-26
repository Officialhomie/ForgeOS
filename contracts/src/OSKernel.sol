// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Delegation, Caveat } from "@metamask/delegation-framework/utils/Types.sol";
import { EncoderLib } from "@metamask/delegation-framework/libraries/EncoderLib.sol";
import { CaveatNarrowing } from "./libraries/CaveatNarrowing.sol";
import { IOSKernel } from "./interfaces/IOSKernel.sol";

/// @title OSKernel
/// @notice Root delegation receiver and sub-delegation router for ForgeOS.
/// @dev Production deployments pair this logic with MetaMask EIP7702DeleGatorCore;
///      this contract implements ForgeOS delegation lifecycle + caveat narrowing for Sepolia demo.
contract OSKernel is IOSKernel, Ownable, ReentrancyGuard {
    using CaveatNarrowing for Caveat[];

    /// @dev Sentinel for root delegations (ForgeOS kernel scope).
    bytes32 public constant ROOT_AUTHORITY =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    mapping(bytes32 => bool) public activeDelegations;
    mapping(bytes32 => bytes) private _caveatData;
    mapping(bytes32 => address) private _delegates;
    mapping(bytes32 => address) private _delegators;
    mapping(bytes32 => bytes32) private _authorities;
    bytes32[] private _activeHashes;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @inheritdoc IOSKernel
    function delegate(Delegation calldata delegation) external onlyOwner returns (bytes32 delegationHash) {
        if (delegation.authority != ROOT_AUTHORITY) revert InvalidAuthority();
        if (delegation.delegator != owner()) revert InvalidDelegator();

        delegationHash = _storeDelegation(delegation);
        emit DelegationGranted(delegationHash, delegation.delegate, delegation.delegator);
    }

    /// @inheritdoc IOSKernel
    function redelegate(Delegation calldata delegation, bytes32 parentHash)
        external
        returns (bytes32 subDelegationHash)
    {
        if (!activeDelegations[parentHash]) revert ParentNotActive();
        if (delegation.authority != parentHash) revert InvalidAuthority();
        if (delegation.delegator != _delegates[parentHash]) revert InvalidDelegator();
        if (msg.sender != delegation.delegator && msg.sender != owner()) revert UnauthorizedCaller();

        Caveat[] memory parentCaveats = abi.decode(_caveatData[parentHash], (Caveat[]));
        CaveatNarrowing.validateSubsetAllowNewEnforcers(parentCaveats, delegation.caveats);

        subDelegationHash = _storeDelegation(delegation);
        emit DelegationGranted(subDelegationHash, delegation.delegate, delegation.delegator);
    }

    /// @inheritdoc IOSKernel
    function revokeOne(bytes32 delegationHash) external onlyOwner {
        if (!activeDelegations[delegationHash]) revert DelegationNotActive();
        _revoke(delegationHash);
        emit DelegationRevoked(delegationHash);
    }

    /// @inheritdoc IOSKernel
    function revokeAll() external onlyOwner nonReentrant returns (uint256 count) {
        count = _activeHashes.length;
        bytes32[] memory hashes = _activeHashes;
        for (uint256 i = 0; i < hashes.length; ++i) {
            _revoke(hashes[i]);
        }
        emit AllDelegationsRevoked(owner(), count);
    }

    /// @inheritdoc IOSKernel
    function owner() public view override(IOSKernel, Ownable) returns (address) {
        return Ownable.owner();
    }

    /// @inheritdoc IOSKernel
    function isDelegationActive(bytes32 delegationHash) external view returns (bool active) {
        return activeDelegations[delegationHash];
    }

    function getDelegationCaveats(bytes32 delegationHash) external view returns (Caveat[] memory) {
        return abi.decode(_caveatData[delegationHash], (Caveat[]));
    }

    function activeDelegationCount() external view returns (uint256) {
        return _activeHashes.length;
    }

    error InvalidAuthority();
    error InvalidDelegator();
    error ParentNotActive();
    error DelegationNotActive();
    error DelegationAlreadyExists();
    error UnauthorizedCaller();

    function _storeDelegation(Delegation calldata delegation) internal returns (bytes32 delegationHash) {
        delegationHash = EncoderLib._getDelegationHash(_delegationToMemory(delegation));
        if (activeDelegations[delegationHash]) revert DelegationAlreadyExists();

        activeDelegations[delegationHash] = true;
        _delegates[delegationHash] = delegation.delegate;
        _delegators[delegationHash] = delegation.delegator;
        _authorities[delegationHash] = delegation.authority;
        _caveatData[delegationHash] = abi.encode(delegation.caveats);
        _activeHashes.push(delegationHash);
    }

    function _delegationToMemory(Delegation calldata delegation)
        private
        pure
        returns (Delegation memory result)
    {
        result.delegate = delegation.delegate;
        result.delegator = delegation.delegator;
        result.authority = delegation.authority;
        result.salt = delegation.salt;
        result.signature = delegation.signature;
        result.caveats = delegation.caveats;
    }

    function _revoke(bytes32 delegationHash) internal {
        activeDelegations[delegationHash] = false;
        for (uint256 i = 0; i < _activeHashes.length; ++i) {
            if (_activeHashes[i] == delegationHash) {
                _activeHashes[i] = _activeHashes[_activeHashes.length - 1];
                _activeHashes.pop();
                break;
            }
        }
    }

}
