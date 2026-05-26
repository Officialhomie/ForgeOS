// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { Script, console2 } from "forge-std/Script.sol";
import { OSKernel } from "../src/OSKernel.sol";

contract DeployKernel is Script {
    function run() external {
        vm.startBroadcast();
        OSKernel kernel = new OSKernel(msg.sender);
        vm.stopBroadcast();
        console2.log("OSKernel", address(kernel));
    }
}
