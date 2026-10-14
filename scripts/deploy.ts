import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contract = await ethers.deployContract("Message");

  await contract.waitForDeployment();

  console.log("Contract address:", await contract.getAddress());
}

main();
