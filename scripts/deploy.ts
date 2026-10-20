import { ethers, artifacts } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying CertificateRegistry with account:", deployer.address);
  console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy contract
  const Factory = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("✅ CertificateRegistry deployed at:", address);

  // Add a demo issuer (only for local/testnet — use deployer as demo issuer)
  const DEMO_ISSUER_NAME = "MIT (Demo)";
  const tx = await registry.addIssuer(deployer.address, DEMO_ISSUER_NAME);
  await tx.wait();
  console.log(`✅ Demo issuer added: ${deployer.address} (${DEMO_ISSUER_NAME})`);

  // Write contract address + ABI to the frontend
  const artifact = await artifacts.readArtifact("CertificateRegistry");
  const outDir = path.join(__dirname, "..", "src", "contracts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const deploymentInfo = {
    address,
    network: (await ethers.provider.getNetwork()).name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(
    path.join(outDir, "CertificateRegistry.json"),
    JSON.stringify({ ...deploymentInfo, abi: artifact.abi }, null, 2)
  );

  console.log("\n📄 Contract info written to src/contracts/CertificateRegistry.json");
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Add to your .env file:");
  console.log(`  VITE_CONTRACT_ADDRESS=${address}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
