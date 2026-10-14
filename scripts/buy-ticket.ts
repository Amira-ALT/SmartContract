import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [organizer, buyer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const marketAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const ticket = await ethers.getContractAt(
    "EventTicket",
    ticketAddress,
    organizer,
  );

  const market = await ethers.getContractAt(
    "TicketMarket",
    marketAddress,
    buyer,
  );

  const price = ethers.parseEther("0.011");

  console.log("Buyer address:", buyer.address);
  console.log("Owner before purchase:", await ticket.ownerOf(1));

  const tx = await market.buy(1, { value: price });
  await tx.wait();

  console.log("Purchase successful!");
  console.log("Owner after purchase:", await ticket.ownerOf(1));

  const listing = await market.listings(1);
  console.log("Listing active:", listing.active);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
