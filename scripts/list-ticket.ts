import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [organizer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const marketAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const market = await ethers.getContractAt(
    "TicketMarket",
    marketAddress,
    organizer,
  );

  const resalePrice = ethers.parseEther("0.011");

  const tx = await market.list(1, resalePrice);
  await tx.wait();

  const listing = await market.listings(1);

  console.log("Ticket listed successfully!");
  console.log("Seller:", listing.seller);
  console.log("Price in ETH:", ethers.formatEther(listing.price));
  console.log("Active:", listing.active);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
