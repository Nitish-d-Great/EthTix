import hre from "hardhat";

async function main() {
  const platformWallet = process.env.NEXT_PUBLIC_PLATFORM_WALLET;
  if (!platformWallet) {
    throw new Error("NEXT_PUBLIC_PLATFORM_WALLET not set in .env.local");
  }

  const platformFee = BigInt("100000000000000"); // 0.0001 ETH in wei

  console.log("Deploying TicketManager...");
  console.log("Platform wallet:", platformWallet);
  console.log("Platform fee: 0.0001 ETH");

  const ethers = await import("ethers");

  // Try multiple RPCs
  const rpcs = [
    process.env.NEXT_PUBLIC_RPC_URL,
    "https://eth-sepolia.g.alchemy.com/v2/demo",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://1rpc.io/sepolia",
  ].filter(Boolean) as string[];

  let provider: InstanceType<typeof ethers.JsonRpcProvider> | null = null;
  for (const rpc of rpcs) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      await p.getBlockNumber();
      provider = p;
      console.log("Using RPC:", rpc);
      break;
    } catch {
      console.log("RPC failed:", rpc);
    }
  }

  if (!provider) throw new Error("All RPCs failed");

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log("Deployer address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("No Sepolia ETH. Get some from https://sepoliafaucet.com");
  }

  const artifact = await hre.artifacts.readArtifact("TicketManager");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("\nSending deployment transaction...");
  const contract = await factory.deploy(platformWallet, platformFee);
  console.log("TX hash:", contract.deploymentTransaction()?.hash);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✅ TicketManager deployed to:", address);
  console.log("\nUpdate .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log("\nView on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
