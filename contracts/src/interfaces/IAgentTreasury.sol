// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title IAgentTreasury
/// @notice USDC treasury for ForgeOS agents. Receives funds from users,
///         validates ERC-7710 delegation proofs, and distributes revenue
///         according to the 80/15/5 split (user / refill pool / platform).
interface IAgentTreasury {
    // ─── EVENTS ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a user funds the treasury.
    event TreasuryFunded(address indexed funder, uint256 amount);

    /// @notice Emitted when an agent payment is executed.
    event PaymentExecuted(
        address indexed payee,
        uint256 amount,
        bytes32 indexed agentId
    );

    /// @notice Emitted after revenue is split across user / refill / platform.
    event RevenueDistributed(
        uint256 userShare,
        uint256 refillShare,
        uint256 platformShare
    );

    /// @notice Emitted when an agent's budget cap is updated.
    event AgentBudgetSet(bytes32 indexed agentId, uint256 budget);

    // ─── ERRORS ───────────────────────────────────────────────────────────────

    error InsufficientBalance(uint256 required, uint256 available);
    error InvalidDelegationProof();
    error BudgetExceeded(bytes32 agentId, uint256 spent, uint256 budget);
    error Unauthorized();

    // ─── FUNCTIONS ────────────────────────────────────────────────────────────

    /// @notice Deposit USDC into the treasury.
    /// @param amount Amount of USDC (6 decimals) to deposit.
    function fund(uint256 amount) external;

    /// @notice Execute a payment to a payee (e.g. Venice AI endpoint).
    ///         Validates the ERC-7710 delegation proof before transferring.
    ///         Distributes revenue: 80% user balance, 15% refill pool, 5% platform.
    /// @param payee      Address to receive USDC.
    /// @param amount     USDC amount (6 decimals).
    /// @param agentId    Registry ID of the executing agent.
    /// @param proof      ABI-encoded ERC-7710 delegation proof.
    function executePayment(
        address payee,
        uint256 amount,
        bytes32 agentId,
        bytes calldata proof
    ) external;

    /// @notice Set the maximum budget for a specific agent.
    /// @param agentId Registry ID of the agent.
    /// @param budget  Maximum USDC (6 decimals) the agent can spend.
    function setAgentBudget(bytes32 agentId, uint256 budget) external;

    /// @notice Return the current USDC balance of the treasury.
    function getBalance() external view returns (uint256 balance);

    /// @notice Return the current budget cap for an agent (0 = unlimited).
    function getAgentBudget(bytes32 agentId) external view returns (uint256 budget);

    /// @notice Return total USDC spent by an agent since deployment.
    function getAgentSpend(bytes32 agentId) external view returns (uint256 spent);

    /// @notice Address of the USDC token on Base.
    function usdc() external view returns (address);

    /// @notice Address that receives the 5% platform fee.
    function platformFeeRecipient() external view returns (address);
}
