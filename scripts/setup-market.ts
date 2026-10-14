import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [organizer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const marketAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const ticket = await ethers.getContractAt(
    "EventTicket",
    ticketAddress,
    organizer,
  );

  const tx = await ticket.setMarketplace(marketAddress);

  await tx.wait();

  console.log("Marketplace authorized!");

  console.log("Authorized marketplace:", await ticket.marketplace());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
