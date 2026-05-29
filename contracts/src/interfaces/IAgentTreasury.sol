// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title IAgentTreasury
/// @notice USDC treasury for ForgeOS agents. Each user's balance is tracked independently.
///         Users can deposit (fund), withdraw their own USDC, and have payments executed
///         on their behalf by the protocol after ERC-7710 delegation proof validation.
///         Revenue split on each payment: 80% stays as user credit, 15% refill pool, 5% platform.
interface IAgentTreasury {
    // ─── EVENTS ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a user deposits USDC into the treasury.
    event TreasuryFunded(address indexed funder, uint256 amount);

    /// @notice Emitted when a user withdraws their USDC from the treasury.
    event TreasuryWithdrawn(address indexed user, uint256 amount);

    /// @notice Emitted when an agent payment is executed on behalf of a user.
    event PaymentExecuted(
        address indexed payee,
        uint256 amount,
        bytes32 indexed agentId,
        address indexed user
    );

    /// @notice Emitted after revenue is split across user credit / refill pool / platform.
    event RevenueDistributed(
        uint256 userShare,
        uint256 refillShare,
        uint256 platformShare
    );

    /// @notice Emitted when an agent's budget cap is updated.
    event AgentBudgetSet(bytes32 indexed agentId, uint256 budget);

    // ─── ERRORS ───────────────────────────────────────────────────────────────

    /// @notice The contract does not hold enough USDC in total.
    error InsufficientBalance(uint256 required, uint256 available);

    /// @notice The specified user does not have enough USDC in their personal balance.
    error InsufficientUserBalance(address user, uint256 required, uint256 available);

    /// @notice The ERC-7710 delegation proof is invalid or inactive.
    error InvalidDelegationProof();

    /// @notice The agent has exceeded its configured budget cap.
    error BudgetExceeded(bytes32 agentId, uint256 spent, uint256 budget);

    /// @notice Caller is not authorized for this operation.
    error Unauthorized();

    // ─── FUNCTIONS ────────────────────────────────────────────────────────────

    /// @notice Deposit USDC into the treasury. Credits the caller's personal balance.
    /// @param amount Amount of USDC (6 decimals) to deposit.
    function fund(uint256 amount) external;

    /// @notice Withdraw USDC back to the caller's wallet. Debits the caller's personal balance.
    /// @param amount Amount of USDC (6 decimals) to withdraw.
    function withdraw(uint256 amount) external;

    /// @notice Execute a payment to a payee on behalf of a user.
    ///         Validates the ERC-7710 delegation proof before transferring.
    ///         Debits the specified user's personal balance.
    ///         Splits revenue: 80% stays as user credit, 15% refill pool, 5% platform.
    /// @param payee    Address to receive USDC.
    /// @param amount   USDC amount (6 decimals).
    /// @param agentId  Registry ID of the executing agent.
    /// @param proof    ABI-encoded ERC-7710 delegation proof (delegation hash).
    /// @param user     Address of the user whose balance is debited.
    function executePayment(
        address payee,
        uint256 amount,
        bytes32 agentId,
        bytes calldata proof,
        address user
    ) external;

    /// @notice Set the maximum budget for a specific agent.
    /// @param agentId Registry ID of the agent.
    /// @param budget  Maximum USDC (6 decimals) the agent can spend in total (0 = unlimited).
    function setAgentBudget(bytes32 agentId, uint256 budget) external;

    /// @notice Return the total USDC held by the contract across all users.
    function getBalance() external view returns (uint256 balance);

    /// @notice Return the USDC balance for a specific user.
    /// @param user Address to query.
    function getUserBalance(address user) external view returns (uint256 balance);

    /// @notice Return the current budget cap for an agent (0 = unlimited).
    function getAgentBudget(bytes32 agentId) external view returns (uint256 budget);

    /// @notice Return total USDC spent by an agent since deployment.
    function getAgentSpend(bytes32 agentId) external view returns (uint256 spent);

    /// @notice Address of the USDC token.
    function usdc() external view returns (address);

    /// @notice Address that receives the 5% platform fee on every payment.
    function platformFeeRecipient() external view returns (address);
}
