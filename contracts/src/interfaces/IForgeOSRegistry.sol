// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title IForgeOSRegistry
/// @notice Immutable on-chain registry for ForgeOS agents.
///         Anyone can register an agent; only the registering owner can deactivate it.
interface IForgeOSRegistry {
    // ─── STRUCTS ──────────────────────────────────────────────────────────────

    struct AgentRecord {
        address owner;         // address that registered the agent
        string name;           // human-readable label
        string endpoint;       // off-chain execution endpoint URL or ENS
        bool active;           // can be deactivated by owner
        uint256 registeredAt;  // block.timestamp at registration
    }

    // ─── EVENTS ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new agent is registered.
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string name
    );

    /// @notice Emitted when an agent is deactivated by its owner.
    event AgentDeactivated(bytes32 indexed agentId);

    // ─── ERRORS ───────────────────────────────────────────────────────────────

    error AgentAlreadyRegistered(bytes32 agentId);
    error AgentNotFound(bytes32 agentId);
    error NotAgentOwner(bytes32 agentId, address caller);
    error AgentAlreadyInactive(bytes32 agentId);
    error EmptyName();

    // ─── FUNCTIONS ────────────────────────────────────────────────────────────

    /// @notice Register a new agent in the registry.
    /// @param name     Human-readable name (must be non-empty).
    /// @param endpoint Off-chain execution endpoint.
    /// @return agentId Keccak256 hash of (owner, name, block.timestamp) — unique ID.
    function registerAgent(string calldata name, string calldata endpoint)
        external
        returns (bytes32 agentId);

    /// @notice Permanently deactivate an agent. Only callable by its owner.
    /// @param agentId The agent to deactivate.
    function deactivateAgent(bytes32 agentId) external;

    /// @notice Return the full record for an agent.
    /// @param agentId The agent to query.
    function getAgent(bytes32 agentId) external view returns (AgentRecord memory);

    /// @notice Return whether an agent is currently active.
    /// @param agentId The agent to query.
    function isActive(bytes32 agentId) external view returns (bool);

    /// @notice Return the owner address of an agent.
    /// @param agentId The agent to query.
    function ownerOf(bytes32 agentId) external view returns (address);
}
