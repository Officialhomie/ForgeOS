// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Script, console2 } from "forge-std/Script.sol";
import { ForgeOSRegistry } from "../src/ForgeOSRegistry.sol";
import { OSKernel } from "../src/OSKernel.sol";
import { AgentTreasury } from "../src/AgentTreasury.sol";

contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");

        // Use vm.startBroadcast() with no args so Foundry picks up the
        // --account <keystore> flag passed on the CLI. msg.sender inside
        // the broadcast block equals the keystore account address.
        vm.startBroadcast();

        address deployer = msg.sender;
        address platform = vm.envOr("PLATFORM_FEE_RECIPIENT", deployer);

        ForgeOSRegistry registry = new ForgeOSRegistry();
        OSKernel kernel = new OSKernel(deployer);
        AgentTreasury treasury =
            new AgentTreasury(usdc, address(kernel), platform, deployer);

        vm.stopBroadcast();

        console2.log("ForgeOSRegistry", address(registry));
        console2.log("OSKernel", address(kernel));
        console2.log("AgentTreasury", address(treasury));
    }
}
