// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { IForgeOSRegistry } from "./interfaces/IForgeOSRegistry.sol";

/// @title ForgeOSRegistry
/// @notice Immutable on-chain registry for ForgeOS agent metadata.
contract ForgeOSRegistry is IForgeOSRegistry {
    mapping(bytes32 => AgentRecord) private _agents;

    /// @inheritdoc IForgeOSRegistry
    function registerAgent(string calldata name, string calldata endpoint)
        external
        returns (bytes32 agentId)
    {
        if (bytes(name).length == 0) revert EmptyName();

        agentId = keccak256(abi.encode(msg.sender, name, block.timestamp));
        if (_agents[agentId].owner != address(0)) revert AgentAlreadyRegistered(agentId);

        _agents[agentId] = AgentRecord({
            owner: msg.sender,
            name: name,
            endpoint: endpoint,
            active: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(agentId, msg.sender, name);
    }

    /// @inheritdoc IForgeOSRegistry
    function deactivateAgent(bytes32 agentId) external {
        AgentRecord storage record = _agents[agentId];
        if (record.owner == address(0)) revert AgentNotFound(agentId);
        if (record.owner != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        if (!record.active) revert AgentAlreadyInactive(agentId);

        record.active = false;
        emit AgentDeactivated(agentId);
    }

    /// @inheritdoc IForgeOSRegistry
    function getAgent(bytes32 agentId) external view returns (AgentRecord memory) {
        AgentRecord memory record = _agents[agentId];
        if (record.owner == address(0)) revert AgentNotFound(agentId);
        return record;
    }

    /// @inheritdoc IForgeOSRegistry
    function isActive(bytes32 agentId) external view returns (bool) {
        return _agents[agentId].active;
    }

    /// @inheritdoc IForgeOSRegistry
    function ownerOf(bytes32 agentId) external view returns (address) {
        return _agents[agentId].owner;
    }
}
