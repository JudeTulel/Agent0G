const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying AI Agent Marketplace contracts to 0G Chain...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Get account balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Deploy AgentRegistry contract
  console.log("\n1. Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry deployed to:", agentRegistryAddress);
  
  // Deploy AgentRental contract
  console.log("\n2. Deploying AgentRental...");
  const AgentRental = await ethers.getContractFactory("AgentRental");
  const feeRecipient = deployer.address; // Use deployer as initial fee recipient
  const agentRental = await AgentRental.deploy(agentRegistryAddress, feeRecipient);
  await agentRental.waitForDeployment();
  const agentRentalAddress = await agentRental.getAddress();
  console.log("AgentRental deployed to:", agentRentalAddress);
  
  // Deploy UsageTracking contract
  console.log("\n3. Deploying UsageTracking...");
  const UsageTracking = await ethers.getContractFactory("UsageTracking");
  const usageTracking = await UsageTracking.deploy(agentRegistryAddress, agentRentalAddress);
  await usageTracking.waitForDeployment();
  const usageTrackingAddress = await usageTracking.getAddress();
  console.log("UsageTracking deployed to:", usageTrackingAddress);
  
  // Save deployment addresses
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      AgentRegistry: agentRegistryAddress,
      AgentRental: agentRentalAddress,
      UsageTracking: usageTrackingAddress
    },
    deployedAt: new Date().toISOString()
  };
  
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", deploymentInfo.network.name, "(Chain ID:", deploymentInfo.network.chainId, ")");
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("AgentRegistry:", deploymentInfo.contracts.AgentRegistry);
  console.log("AgentRental:", deploymentInfo.contracts.AgentRental);
  console.log("UsageTracking:", deploymentInfo.contracts.UsageTracking);
  console.log("Deployed at:", deploymentInfo.deployedAt);
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const networkName = deploymentInfo.network.name || 'unknown';
  const deploymentFile = path.join(deploymentsDir, `${networkName}-${deploymentInfo.network.chainId}.json`);
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);
  
  // Verify contracts (optional)
  if (process.env.VERIFY_CONTRACTS === 'true') {
    console.log("\n=== Verifying Contracts ===");
    
    try {
      await hre.run("verify:verify", {
        address: agentRegistryAddress,
        constructorArguments: []
      });
      console.log("AgentRegistry verified");
    } catch (error) {
      console.log("AgentRegistry verification failed:", error.message);
    }
    
    try {
      await hre.run("verify:verify", {
        address: agentRentalAddress,
        constructorArguments: [agentRegistryAddress, feeRecipient]
      });
      console.log("AgentRental verified");
    } catch (error) {
      console.log("AgentRental verification failed:", error.message);
    }
    
    try {
      await hre.run("verify:verify", {
        address: usageTrackingAddress,
        constructorArguments: [agentRegistryAddress, agentRentalAddress]
      });
      console.log("UsageTracking verified");
    } catch (error) {
      console.log("UsageTracking verification failed:", error.message);
    }
  }
  
  console.log("\n✅ Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

