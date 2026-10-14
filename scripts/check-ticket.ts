import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const ticket = await ethers.getContractAt("EventTicket", ticketAddress);

  const owner = await ticket.ownerOf(1);
  const price = await ticket.initialPrice(1);

  console.log("Ticket ID:", 1);
  console.log("Owner:", owner);
  console.log("Price in wei:", price.toString());
  console.log("Price in ETH:", ethers.formatEther(price));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
