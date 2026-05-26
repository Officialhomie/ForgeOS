// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAgentTreasury } from "./interfaces/IAgentTreasury.sol";
import { IOSKernel } from "./interfaces/IOSKernel.sol";

/// @title AgentTreasury
/// @notice USDC treasury for agent x402 payments with ERC-7710 delegation proof validation.
contract AgentTreasury is IAgentTreasury, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PLATFORM_FEE_BPS = 500;
    uint256 public constant REFILL_BPS = 1500;
    uint256 public constant USER_BPS = 8000;

    IERC20 private immutable _usdc;
    IOSKernel public immutable kernel;
    address public platformFeeRecipient;

    uint256 public totalBalance;
    uint256 public refillPool;
    mapping(bytes32 => uint256) public agentBudgets;
    mapping(bytes32 => uint256) public agentSpend;

    constructor(address usdc_, address kernel_, address platformFeeRecipient_, address initialOwner)
        Ownable(initialOwner)
    {
        _usdc = IERC20(usdc_);
        kernel = IOSKernel(kernel_);
        platformFeeRecipient = platformFeeRecipient_;
    }

    /// @inheritdoc IAgentTreasury
    function fund(uint256 amount) external nonReentrant {
        _usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalBalance += amount;
        emit TreasuryFunded(msg.sender, amount);
    }

    /// @inheritdoc IAgentTreasury
    function executePayment(address payee, uint256 amount, bytes32 agentId, bytes calldata proof)
        external
        onlyOwner
        nonReentrant
    {
        bytes32 delegationHash = abi.decode(proof, (bytes32));
        if (!kernel.isDelegationActive(delegationHash)) revert InvalidDelegationProof();

        uint256 budget = agentBudgets[agentId];
        if (budget > 0 && agentSpend[agentId] + amount > budget) {
            revert BudgetExceeded(agentId, agentSpend[agentId] + amount, budget);
        }
        if (totalBalance < amount) revert InsufficientBalance(amount, totalBalance);

        uint256 platformShare = (amount * PLATFORM_FEE_BPS) / 10_000;
        uint256 refillShare = (amount * REFILL_BPS) / 10_000;
        uint256 userShare = (amount * USER_BPS) / 10_000;

        totalBalance -= amount;
        agentSpend[agentId] += amount;
        refillPool += refillShare;

        _usdc.safeTransfer(payee, amount - platformShare);
        if (platformShare > 0) {
            _usdc.safeTransfer(platformFeeRecipient, platformShare);
        }

        emit PaymentExecuted(payee, amount, agentId);
        emit RevenueDistributed(userShare, refillShare, platformShare);
    }

    /// @inheritdoc IAgentTreasury
    function setAgentBudget(bytes32 agentId, uint256 budget) external onlyOwner {
        agentBudgets[agentId] = budget;
        emit AgentBudgetSet(agentId, budget);
    }

    /// @inheritdoc IAgentTreasury
    function getBalance() external view returns (uint256 balance) {
        return totalBalance;
    }

    /// @inheritdoc IAgentTreasury
    function getAgentBudget(bytes32 agentId) external view returns (uint256 budget) {
        return agentBudgets[agentId];
    }

    /// @inheritdoc IAgentTreasury
    function getAgentSpend(bytes32 agentId) external view returns (uint256 spent) {
        return agentSpend[agentId];
    }

    /// @inheritdoc IAgentTreasury
    function usdc() external view returns (address) {
        return address(_usdc);
    }
}
