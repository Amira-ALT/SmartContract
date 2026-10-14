import assert from "node:assert/strict";
import { network } from "hardhat";

// End-to-end check of the ticketing flow on an in-process Hardhat chain.
// Run with: npx hardhat run scripts/e2e.ts
const { ethers } = await network.getOrCreate();
const [organizer, seller, buyer, other] = await ethers.getSigners();
const eth = ethers.parseEther;

async function reverts(p: Promise<unknown>, reason: string) {
  await assert.rejects(p, (e: any) => {
    const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? "";
    assert.match(String(msg), new RegExp(reason));
    return true;
  });
}

const ticket = await ethers.deployContract("EventTicket");
const ticketAddress = await ticket.getAddress();
const market = await ethers.deployContract("TicketMarket", [
  ticketAddress,
  organizer.address,
]);
const marketAddress = await market.getAddress();
const validator = await ethers.deployContract("EntryValidator", [
  ticketAddress,
]);

await reverts(
  ticket.connect(other).setMarketplace(marketAddress),
  "OwnableUnauthorizedAccount",
);
await ticket.setMarketplace(marketAddress);
await reverts(ticket.setMarketplace(marketAddress), "Market already set");

// Mint
await reverts(
  ticket.connect(other).createTicket(other.address, eth("0.01")),
  "OwnableUnauthorizedAccount",
);
await reverts(ticket.createTicket(seller.address, 0n), "Price must be positive");
await ticket.createTicket(seller.address, eth("0.01"));
assert.equal(await ticket.ownerOf(1), seller.address);
assert.equal(await ticket.totalTickets(), 1n);

// Direct transfers are blocked
await reverts(
  ticket.connect(seller).transferFrom(seller.address, buyer.address, 1),
  "Transfers only through marketplace",
);

// Listing rules
await reverts(market.connect(buyer).list(1, eth("0.01")), "Not ticket owner");
await reverts(market.connect(seller).list(1, eth("0.01")), "Market not approved");
await ticket.connect(seller).approve(marketAddress, 1);
await reverts(market.connect(seller).list(1, eth("0.012")), "Resale price too high");
await market.connect(seller).list(1, eth("0.011"));

// Cancel + relist
await reverts(market.connect(buyer).cancel(1), "Not the seller");
await market.connect(seller).cancel(1);
await reverts(market.connect(buyer).buy(1, { value: eth("0.011") }), "Ticket not for sale");
await market.connect(seller).list(1, eth("0.011"));

// Buy with fee split
await reverts(market.connect(seller).buy(1, { value: eth("0.011") }), "Cannot buy own ticket");
await reverts(market.connect(buyer).buy(1, { value: eth("0.01") }), "Incorrect payment");

const sellerBefore = await ethers.provider.getBalance(seller.address);
const organizerBefore = await ethers.provider.getBalance(organizer.address);
await market.connect(buyer).buy(1, { value: eth("0.011") });
assert.equal(await ticket.ownerOf(1), buyer.address);
assert.equal(
  (await ethers.provider.getBalance(seller.address)) - sellerBefore,
  eth("0.01078"),
);
assert.equal(
  (await ethers.provider.getBalance(organizer.address)) - organizerBefore,
  eth("0.00022"),
);
assert.equal((await market.listings(1)).active, false);

// Entry validation
await reverts(validator.connect(buyer).validateEntry(1), "OwnableUnauthorizedAccount");
await validator.validateEntry(1);
assert.equal(await validator.usedTickets(1), true);
await reverts(validator.validateEntry(1), "Ticket already used");
await reverts(validator.validateEntry(99), "ERC721NonexistentToken");

console.log("All end-to-end checks passed.");
