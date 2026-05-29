// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentTreasury } from "../src/AgentTreasury.sol";

/// @notice Redeploy AgentTreasury when the existing one was wired to the wrong USDC token.
contract DeployTreasury is Script {
    address internal constant DEFAULT_PLATFORM_FEE_RECIPIENT =
        0x9aC2d5a0A0E88D459Ecfb68Bcbb94DFD7cdF1f09;

    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address kernel = vm.envAddress("OS_KERNEL_ADDRESS");
        address platform =
            vm.envOr("PLATFORM_FEE_RECIPIENT", DEFAULT_PLATFORM_FEE_RECIPIENT);

        vm.startBroadcast();

        address deployer =
            vm.envOr("DEPLOYER_ADDRESS", DEFAULT_PLATFORM_FEE_RECIPIENT);
        AgentTreasury treasury = new AgentTreasury(usdc, kernel, platform, deployer);

        vm.stopBroadcast();

        console2.log("AgentTreasury", address(treasury));
        console2.log("USDC", usdc);
        console2.log("Kernel", kernel);
        console2.log("PlatformFeeRecipient", platform);
    }
}
