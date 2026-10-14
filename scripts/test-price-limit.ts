import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [organizer] = await ethers.getSigners();

  const marketAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const market = await ethers.getContractAt(
    "TicketMarket",
    marketAddress,
    organizer,
  );

  const excessivePrice = ethers.parseEther("0.012");

  try {
    await market.list.staticCall(1, excessivePrice);
    console.log("ERROR: The excessive price was accepted!");
  } catch (error) {
    console.log("Success: Excessive resale price rejected!");
    console.log("Maximum resale increase: 10%");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
