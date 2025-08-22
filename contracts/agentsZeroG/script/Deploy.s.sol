// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AgentRental} from "../src/AgentRental.sol";
import {UsageTracking} from "../src/UsageTracking.sol";
import {console} from "forge-std/console.sol";
contract Deploy is Script {
    // Addresses to use - can be overridden via command line
    address public constant FEE_RECIPIENT = 0x2D84348941FC1F4303c9cc4839Ac16a79f197D1c;

    function run() public {
        vm.startBroadcast();

        // 1. Deploy AgentRegistry first (no dependencies)
        AgentRegistry agentRegistry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(agentRegistry));

        // 2. Deploy AgentRental (depends on AgentRegistry)
        AgentRental agentRental = new AgentRental(
            address(agentRegistry),
            FEE_RECIPIENT
        );
        console.log("AgentRental deployed at:", address(agentRental));

        // 3. Deploy UsageTracking (depends on both)
        UsageTracking usageTracking = new UsageTracking(
            address(agentRegistry),
            address(agentRental)
        );
        console.log("UsageTracking deployed at:", address(usageTracking));

        vm.stopBroadcast();
    }
}