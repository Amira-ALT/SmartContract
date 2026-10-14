import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [organizer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const ticket = await ethers.getContractAt(
    "EventTicket",
    ticketAddress,
    organizer,
  );

  const price = ethers.parseEther("0.01");

  const tx = await ticket.createTicket(organizer.address, price);

  await tx.wait();

  console.log("Ticket NFT created!");

  console.log("Ticket owner:", await ticket.ownerOf(1));

  console.log(
    "Initial price in wei:",
    (await ticket.initialPrice(1)).toString(),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
