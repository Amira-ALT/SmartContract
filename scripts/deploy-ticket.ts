import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [organizer] = await ethers.getSigners();

  console.log("Organizer address:", organizer.address);

  const ticket = await ethers.deployContract("EventTicket");

  await ticket.waitForDeployment();

  console.log("EventTicket deployed at:", await ticket.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
