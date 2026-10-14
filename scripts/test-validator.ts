import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [organizer] = await ethers.getSigners();

  const validatorAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  const validator = await ethers.getContractAt(
    "EntryValidator",
    validatorAddress,
    organizer,
  );

  const tokenId = 1;

  console.log("--- FIRST VALIDATION ---");

  console.log(
    "Ticket owner:",
    await validator.ticket().then(async (address) => {
      const ticket = await ethers.getContractAt("EventTicket", address);
      return ticket.ownerOf(tokenId);
    }),
  );

  const tx = await validator.validateEntry(tokenId);
  await tx.wait();

  console.log("First validation successful!");
  console.log("Ticket used:", await validator.usedTickets(tokenId));

  console.log("\n--- SECOND VALIDATION ---");

  try {
    await validator.validateEntry.staticCall(tokenId);
    console.log("ERROR: Second validation was accepted!");
  } catch {
    console.log("Success: Second validation rejected!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
