// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Script, console2 } from "forge-std/Script.sol";
import { OSKernel } from "../src/OSKernel.sol";

contract DeployKernel is Script {
    address internal constant DEFAULT_DEPLOYER =
        0x9aC2d5a0A0E88D459Ecfb68Bcbb94DFD7cdF1f09;

    function run() external {
        vm.startBroadcast();
        address deployer = vm.envOr("DEPLOYER_ADDRESS", DEFAULT_DEPLOYER);
        OSKernel kernel = new OSKernel(deployer);
        vm.stopBroadcast();
        console2.log("OSKernel", address(kernel));
    }
}
