import { ethers } from "hardhat";

async function main() {
  const platformWallet = process.env.NEXT_PUBLIC_PLATFORM_WALLET;
  if (!platformWallet) {
    throw new Error("NEXT_PUBLIC_PLATFORM_WALLET not set in .env.local");
  }

  const platformFee = ethers.parseEther("0.0001"); // 0.0001 ETH

  console.log("Deploying TicketManager...");
  console.log("Platform wallet:", platformWallet);
  console.log("Platform fee:", ethers.formatEther(platformFee), "ETH");

  const TicketManager = await ethers.getContractFactory("TicketManager");
  const contract = await TicketManager.deploy(platformWallet, platformFee);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nTicketManager deployed to:", address);
  console.log("\nUpdate .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log("\nVerify on Etherscan:");
  console.log(
    `npx hardhat verify --network sepolia ${address} ${platformWallet} ${platformFee.toString()}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
