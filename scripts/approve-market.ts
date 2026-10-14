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

  const tx = await ticket.approve(marketAddress, 1);
  await tx.wait();

  console.log("Market approved for ticket 1!");
  console.log("Approved address:", await ticket.getApproved(1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
