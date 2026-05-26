// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Mock Venice x402 payee — records USDC received per agent cycle.
contract MockVenicePayee {
    IERC20 public immutable usdc;
    uint256 public totalReceived;

    constructor(address usdc_) {
        usdc = IERC20(usdc_);
    }

    function receivePayment(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        totalReceived += amount;
    }
}
