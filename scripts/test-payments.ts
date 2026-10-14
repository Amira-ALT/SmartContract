import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [organizer, seller, buyer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const marketAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const ticket = await ethers.getContractAt(
    "EventTicket",
    ticketAddress,
    seller,
  );

  const marketAsSeller = await ethers.getContractAt(
    "TicketMarket",
    marketAddress,
    seller,
  );

  const marketAsBuyer = marketAsSeller.connect(buyer);

  const price = ethers.parseEther("0.011");

  // 1. Vérifier que le vendeur possède toujours le ticket
  console.log("Current owner:", await ticket.ownerOf(1));

  // 2. Autoriser le marché à transférer le ticket
  const approvalTx = await ticket.approve(marketAddress, 1);
  await approvalTx.wait();

  // 3. Mettre le ticket en vente
  const listingTx = await marketAsSeller.list(1, price);
  await listingTx.wait();

  // 4. Enregistrer les soldes juste avant l'achat
  const sellerBefore = await ethers.provider.getBalance(seller.address);
  const organizerBefore = await ethers.provider.getBalance(organizer.address);

  // 5. L'acheteur achète le ticket
  const buyTx = await marketAsBuyer.buy(1, { value: price });
  await buyTx.wait();

  // 6. Lire les soldes après la vente
  const sellerAfter = await ethers.provider.getBalance(seller.address);
  const organizerAfter = await ethers.provider.getBalance(organizer.address);

  // 7. Calculer les montants reçus
  const sellerReceived = sellerAfter - sellerBefore;
  const organizerReceived = organizerAfter - organizerBefore;

  console.log("\n--- PAYMENT VERIFICATION ---");
  console.log("Seller received:", ethers.formatEther(sellerReceived), "ETH");
  console.log(
    "Organizer received:",
    ethers.formatEther(organizerReceived),
    "ETH",
  );

  console.log("\n--- EXPECTED AMOUNTS ---");
  console.log("Seller expected: 0.01078 ETH");
  console.log("Organizer expected: 0.00022 ETH");

  console.log("\n--- FINAL OWNER ---");
  console.log("Ticket owner:", await ticket.ownerOf(1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
