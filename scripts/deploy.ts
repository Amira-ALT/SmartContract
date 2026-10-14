import hre, { network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Deploys EventTicket + TicketMarket + EntryValidator, wires them together,
// seeds a few demo tickets and writes frontend/deployment.json for the UI.
async function main() {
  const { ethers } = await network.getOrCreate();
  const [organizer, seller] = await ethers.getSigners();

  const ticket = await ethers.deployContract("EventTicket");
  await ticket.waitForDeployment();
  const ticketAddress = await ticket.getAddress();

  const market = await ethers.deployContract("TicketMarket", [
    ticketAddress,
    organizer.address,
  ]);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();

  const validator = await ethers.deployContract("EntryValidator", [
    ticketAddress,
  ]);
  await validator.waitForDeployment();
  const validatorAddress = await validator.getAddress();

  await (await ticket.setMarketplace(marketAddress)).wait();

  console.log("EventTicket    :", ticketAddress);
  console.log("TicketMarket   :", marketAddress);
  console.log("EntryValidator :", validatorAddress);
  console.log("Organizer      :", organizer.address);

  if (process.env.SEED !== "0") {
    const demo = [
      { to: organizer, price: "0.01", resale: "0.011" },
      { to: seller, price: "0.02", resale: "0.022" },
      { to: seller, price: "0.05", resale: null },
      { to: organizer, price: "0.03", resale: null },
    ];

    for (const [i, t] of demo.entries()) {
      const tokenId = i + 1;
      await (
        await ticket.createTicket(t.to.address, ethers.parseEther(t.price))
      ).wait();

      if (t.resale) {
        await (
          await ticket.connect(t.to).approve(marketAddress, tokenId)
        ).wait();
        await (
          await market
            .connect(t.to)
            .list(tokenId, ethers.parseEther(t.resale))
        ).wait();
      }
      console.log(
        `Ticket #${tokenId} -> ${t.to.address} (${t.price} ETH)` +
          (t.resale ? ` listed at ${t.resale} ETH` : ""),
      );
    }
  }

  const { chainId } = await ethers.provider.getNetwork();
  const abi = async (name: string) =>
    (await hre.artifacts.readArtifact(name)).abi;

  const deployment = {
    chainId: Number(chainId),
    organizer: organizer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      EventTicket: { address: ticketAddress, abi: await abi("EventTicket") },
      TicketMarket: { address: marketAddress, abi: await abi("TicketMarket") },
      EntryValidator: {
        address: validatorAddress,
        abi: await abi("EntryValidator"),
      },
    },
  };

  const out = path.join(process.cwd(), "frontend", "deployment.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(deployment, null, 2));
  console.log("Wrote", path.relative(process.cwd(), out));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
