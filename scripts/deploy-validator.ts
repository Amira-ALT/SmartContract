import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [organizer] = await ethers.getSigners();

  const ticketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const validator = await ethers.deployContract(
    "EntryValidator",
    [ticketAddress]
  );

  await validator.waitForDeployment();

  console.log(
    "EntryValidator deployed at:",
    await validator.getAddress()
  );

  console.log(
    "Organizer address:",
    organizer.address
  );

  console.log(
    "Ticket contract:",
    await validator.ticket()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});