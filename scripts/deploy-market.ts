import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [organizer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const market = await ethers.deployContract("TicketMarket", [
    ticketAddress,
    organizer.address,
  ]);

  await market.waitForDeployment();

  console.log("TicketMarket deployed at:", await market.getAddress());

  console.log("Organizer address:", organizer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
