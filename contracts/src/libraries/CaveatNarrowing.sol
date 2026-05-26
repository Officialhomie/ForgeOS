// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Caveat } from "@metamask/delegation-framework/utils/Types.sol";

/// @title CaveatNarrowing
/// @notice Validates sub-delegation caveats are a strict subset of parent caveats.
library CaveatNarrowing {
    error CaveatWideningNotAllowed(address enforcer, string reason);
    error ParentCaveatMissing(address enforcer);

    function validateSubset(Caveat[] memory parentCaveats, Caveat[] memory childCaveats) internal pure {
        for (uint256 i = 0; i < childCaveats.length; ++i) {
            Caveat memory child = childCaveats[i];
            bool foundParent;
            for (uint256 j = 0; j < parentCaveats.length; ++j) {
                if (parentCaveats[j].enforcer == child.enforcer) {
                    foundParent = true;
                    _validatePair(parentCaveats[j], child);
                    break;
                }
            }
            if (!foundParent) revert ParentCaveatMissing(child.enforcer);
        }
    }

    /// @notice Allow child-only caveats when they narrow scope (e.g. LimitedCalls on redelegation hop).
    function validateSubsetAllowNewEnforcers(
        Caveat[] memory parentCaveats,
        Caveat[] memory childCaveats
    ) internal pure {
        for (uint256 i = 0; i < childCaveats.length; ++i) {
            Caveat memory child = childCaveats[i];
            bool foundParent;
            for (uint256 j = 0; j < parentCaveats.length; ++j) {
                if (parentCaveats[j].enforcer == child.enforcer) {
                    foundParent = true;
                    _validatePair(parentCaveats[j], child);
                    break;
                }
            }
            if (!foundParent && child.terms.length == 32) {
                uint256 childLimit = abi.decode(child.terms, (uint256));
                if (childLimit == 0) {
                    revert CaveatWideningNotAllowed(child.enforcer, "invalid call limit");
                }
                continue;
            }
            if (!foundParent) revert ParentCaveatMissing(child.enforcer);
        }
    }

    function _validatePair(Caveat memory parent, Caveat memory child) private pure {
        if (parent.terms.length >= 64 && child.terms.length >= 64) {
            (address parentToken, uint256 parentMax) = abi.decode(parent.terms, (address, uint256));
            (address childToken, uint256 childMax) = abi.decode(child.terms, (address, uint256));
            if (parentToken != childToken) {
                revert CaveatWideningNotAllowed(child.enforcer, "token mismatch");
            }
            if (childMax > parentMax) {
                revert CaveatWideningNotAllowed(child.enforcer, "amount exceeds parent");
            }
            return;
        }

        if (parent.terms.length == 32 && child.terms.length == 32) {
            (uint128 parentAfter, uint128 parentBefore) = abi.decode(parent.terms, (uint128, uint128));
            (uint128 childAfter, uint128 childBefore) = abi.decode(child.terms, (uint128, uint128));

            if (parentBefore != 0 || childBefore != 0) {
                if (childAfter < parentAfter) {
                    revert CaveatWideningNotAllowed(child.enforcer, "starts before parent window");
                }
                if (parentBefore != 0 && (childBefore == 0 || childBefore > parentBefore)) {
                    revert CaveatWideningNotAllowed(child.enforcer, "ends after parent window");
                }
                return;
            }

            uint256 parentLimit = uint256(parentAfter);
            uint256 childLimit = uint256(childAfter);
            if (childLimit > parentLimit) {
                revert CaveatWideningNotAllowed(child.enforcer, "call limit exceeds parent");
            }
            return;
        }

        if (keccak256(parent.terms) != keccak256(child.terms)) {
            revert CaveatWideningNotAllowed(child.enforcer, "terms must match or narrow");
        }
    }
}
