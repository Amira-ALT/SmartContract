"use strict";

const { ethers } = window;
const RPC_URL = new URL("/rpc", location.href).href;
const METAMASK_RPC = "http://127.0.0.1:8545";
const ROLE_NAMES = ["Organisateur", "Vendeur (démo)", "Acheteur (démo)"];

const $ = (id) => document.getElementById(id);
const state = {
  deployment: null,
  readProvider: null,
  contracts: {},
  iface: null,
  accounts: [],
  account: null,
  signer: null,
  mode: "local",
  organizer: null,
  filter: "all",
  tickets: [],
  busy: false,
};

// ---------- helpers ----------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const fmt = (wei) => `${trimEth(ethers.formatEther(wei))} ETH`;
const trimEth = (s) => {
  const [i, d = ""] = s.split(".");
  const dec = d.slice(0, 5).replace(/0+$/, "");
  return dec ? `${i}.${dec}` : i;
};

function label(addr) {
  const i = state.accounts.findIndex((a) => same(a, addr));
  if (same(addr, state.account)) return `<span class="you">Vous</span> · ${short(addr)}`;
  if (i >= 0 && i < ROLE_NAMES.length) return `${ROLE_NAMES[i]} · ${short(addr)}`;
  if (i >= 0) return `Compte ${i} · ${short(addr)}`;
  return short(addr);
}

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), kind === "err" ? 7000 : 4500);
}

const FRIENDLY = {
  "Resale price too high": "Prix de revente trop élevé (max 110 % du prix initial).",
  "Ticket not for sale": "Ce billet n'est pas en vente.",
  "Cannot buy own ticket": "Vous ne pouvez pas acheter votre propre billet.",
  "Incorrect payment": "Montant envoyé incorrect.",
  "Not ticket owner": "Vous n'êtes pas propriétaire de ce billet.",
  "Market not approved": "Le marché n'est pas autorisé à transférer ce billet.",
  "Ticket already used": "Ce billet a déjà été utilisé.",
  "Transfers only through marketplace": "Les transferts doivent passer par le marché.",
  OwnableUnauthorizedAccount: "Action réservée à l'organisateur.",
  ERC721NonexistentToken: "Ce billet n'existe pas.",
};

function explain(e) {
  let reason = e?.reason || e?.revert?.name;
  const data = e?.data ?? e?.info?.error?.data ?? e?.error?.data;
  if (!reason && typeof data === "string" && data.length >= 10) {
    try { reason = state.iface.parseError(data)?.name; } catch {}
  }
  if (!reason) {
    const m = String(e?.info?.error?.message ?? e?.shortMessage ?? e?.message ?? "");
    reason = Object.keys(FRIENDLY).find((k) => m.includes(k)) ?? m;
  }
  if (e?.code === "ACTION_REJECTED") return "Transaction refusée dans le portefeuille.";
  return FRIENDLY[reason] ?? reason ?? "Erreur inconnue.";
}

async function send(label, fn) {
  if (state.busy) return;
  state.busy = true;
  document.body.style.cursor = "progress";
  document.querySelectorAll("button").forEach((b) => (b.dataset.wasDisabled = b.disabled, (b.disabled = true)));
  try {
    toast(`${label}…`);
    const tx = await fn();
    if (tx?.wait) await tx.wait();
    toast(`${label} : succès ✔`, "ok");
  } catch (e) {
    console.error(e);
    toast(`${label} : ${explain(e)}`, "err");
  } finally {
    state.busy = false;
    document.body.style.cursor = "";
    document.querySelectorAll("button").forEach((b) => (b.disabled = b.dataset.wasDisabled === "true"));
    await refresh();
  }
}

function writeContract(name) {
  const c = state.deployment.contracts[name];
  return new ethers.Contract(c.address, c.abi, state.signer);
}

// ---------- boot ----------

async function boot() {
  try {
    const res = await fetch("deployment.json", { cache: "no-store" });
    if (!res.ok) throw new Error("deployment.json introuvable");
    state.deployment = await res.json();
  } catch {
    setNet(false, "Contrats non déployés — lancez run.bat");
    $("ticketGrid").innerHTML = `<p class="empty">Aucun déploiement trouvé. Lancez <code>run.bat</code>.</p>`;
    return;
  }

  const { chainId, contracts } = state.deployment;
  state.readProvider = new ethers.JsonRpcProvider(RPC_URL, { chainId, name: "hardhat" }, { staticNetwork: true, pollingInterval: 1500 });
  // Combined interface (errors from all contracts) to decode custom revert errors.
  const errors = new Map();
  for (const c of Object.values(contracts)) {
    for (const f of new ethers.Interface(c.abi).fragments) {
      if (f.type === "error") errors.set(f.format(), f);
    }
  }
  state.iface = new ethers.Interface([...errors.values()]);
  for (const [name, c] of Object.entries(contracts)) {
    state.contracts[name] = new ethers.Contract(c.address, c.abi, state.readProvider);
  }

  try {
    state.accounts = (await state.readProvider.send("eth_accounts", [])).map((a) => ethers.getAddress(a));
  } catch {
    setNet(false, "Nœud Hardhat injoignable");
    return;
  }
  state.organizer = await state.contracts.EventTicket.owner();

  const sel = $("accountSelect");
  sel.innerHTML = state.accounts
    .map((a, i) => `<option value="${a}">${esc(i < ROLE_NAMES.length ? ROLE_NAMES[i] : `Compte ${i}`)} — ${short(a)}</option>`)
    .join("");
  $("accountList").innerHTML = state.accounts.map((a, i) => `<option value="${a}">${esc(ROLE_NAMES[i] ?? `Compte ${i}`)}</option>`).join("");

  let saved = null;
  try { saved = localStorage.getItem("billetterie.account"); } catch {}
  await useLocal(state.accounts.find((a) => same(a, saved)) ?? state.accounts[2] ?? state.accounts[0]);

  sel.addEventListener("change", () => useLocal(sel.value));
  $("metamaskBtn").addEventListener("click", connectMetaMask);
  $("filters").addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]")?.dataset.filter;
    if (!f) return;
    state.filter = f;
    document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === f));
    renderTickets();
  });
  $("ticketGrid").addEventListener("click", onTicketAction);
  $("createForm").addEventListener("submit", onCreate);
  $("validateForm").addEventListener("submit", onValidate);

  state.readProvider.on("block", () => { if (!state.busy) refresh(); });
}

async function useLocal(address) {
  state.mode = "local";
  state.account = address;
  state.signer = await state.readProvider.getSigner(address);
  $("accountSelect").value = address;
  $("metamaskBtn").textContent = "🦊 Connecter MetaMask";
  try { localStorage.setItem("billetterie.account", address); } catch {}
  await refresh();
}

async function connectMetaMask() {
  if (!window.ethereum) return toast("MetaMask n'est pas installé dans ce navigateur.", "err");
  const hexId = "0x" + state.deployment.chainId.toString(16);
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      if (e.code !== 4902) throw e;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hexId, chainName: "Hardhat Local", rpcUrls: [METAMASK_RPC], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }],
      });
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    state.signer = await provider.getSigner();
    state.account = await state.signer.getAddress();
    state.mode = "metamask";
    $("metamaskBtn").textContent = "🦊 MetaMask connecté";
    window.ethereum.on?.("accountsChanged", () => connectMetaMask());
    toast("MetaMask connecté.", "ok");
    await refresh();
  } catch (e) {
    toast(`MetaMask : ${explain(e)}`, "err");
  }
}

// ---------- data ----------

let refreshing = null;
function refresh() {
  refreshing ??= load().finally(() => (refreshing = null));
  return refreshing;
}

async function load() {
  const { EventTicket: ticket, TicketMarket: market, EntryValidator: validator } = state.contracts;
  try {
    const [block, total, balance] = await Promise.all([
      state.readProvider.getBlockNumber(),
      ticket.totalTickets(),
      state.readProvider.getBalance(state.account),
    ]);
    setNet(true, `Hardhat local · bloc #${block}`);

    state.tickets = await Promise.all(
      Array.from({ length: Number(total) }, (_, i) => i + 1).map(async (id) => {
        const [owner, price, listing, used, approved, max] = await Promise.all([
          ticket.ownerOf(id),
          ticket.initialPrice(id),
          market.listings(id),
          validator.usedTickets(id),
          ticket.getApproved(id),
          market.maxResalePrice(id),
        ]);
        const listed = listing.active && same(listing.seller, owner);
        return { id, owner, price, listed, listPrice: listing.price, used, approved, max };
      }),
    );

    $("accAddress").textContent = state.account;
    $("accBalance").textContent = fmt(balance);
    const isOrg = same(state.account, state.organizer);
    const role = $("roleBadge");
    role.textContent = isOrg ? "Organisateur" : state.mode === "metamask" ? "MetaMask" : "Participant";
    role.className = `badge ${isOrg ? "badge-accent" : ""}`;
    $("organizerPanel").hidden = !isOrg;

    $("stTotal").textContent = state.tickets.length;
    $("stListed").textContent = state.tickets.filter((t) => t.listed).length;
    $("stUsed").textContent = state.tickets.filter((t) => t.used).length;

    renderTickets();
    await renderActivity();
  } catch (e) {
    console.error(e);
    setNet(false, "Nœud Hardhat injoignable");
  }
}

function setNet(ok, text) {
  $("netPill").className = `pill ${ok ? "pill-on" : "pill-off"}`;
  $("netText").textContent = text;
}

// ---------- render ----------

function renderTickets() {
  const isOrg = same(state.account, state.organizer);
  const list = state.tickets.filter((t) =>
    state.filter === "listed" ? t.listed : state.filter === "mine" ? same(t.owner, state.account) : true,
  );
  if (!list.length) {
    $("ticketGrid").innerHTML = `<p class="empty">${
      state.filter === "mine" ? "Vous ne possédez aucun billet." : state.filter === "listed" ? "Aucun billet en vente." : "Aucun billet émis pour le moment."
    }</p>`;
    return;
  }

  $("ticketGrid").innerHTML = list
    .map((t) => {
      const mine = same(t.owner, state.account);
      const status = t.used
        ? `<span class="badge badge-warn">Utilisé</span>`
        : t.listed
          ? `<span class="badge badge-ok">En vente</span>`
          : `<span class="badge">Détenu</span>`;

      let actions = "";
      if (t.listed && !mine) {
        const fee = (t.listPrice * 200n) / 10000n;
        actions += `<button class="btn btn-primary" data-act="buy" data-id="${t.id}">Acheter · ${fmt(t.listPrice)}</button>
          <p class="t-hint">Vendeur ${fmt(t.listPrice - fee)} · organisateur ${fmt(fee)}</p>`;
      }
      if (mine && t.listed) {
        actions += `<button class="btn btn-danger" data-act="cancel" data-id="${t.id}">Retirer de la vente</button>`;
      }
      if (mine && !t.listed && !t.used) {
        actions += `<div class="t-list">
            <input type="number" min="0" step="0.0001" value="${trimEth(ethers.formatEther(t.max))}" id="price-${t.id}" aria-label="Prix de revente en ETH" />
            <button class="btn btn-ghost btn-sm" data-act="list" data-id="${t.id}">Vendre</button>
          </div>
          <p class="t-hint">Maximum ${fmt(t.max)}</p>`;
      }
      if (isOrg && !t.used) {
        actions += `<button class="btn btn-ghost btn-sm" data-act="validate" data-id="${t.id}">✔ Valider l'entrée</button>`;
      }

      return `<article class="ticket ${mine ? "mine" : ""} ${t.used ? "used" : ""}">
        <div class="t-head"><span class="t-id">#${t.id}</span>${status}</div>
        <div class="t-rows">
          <span>Propriétaire</span><span>${label(t.owner)}</span>
          <span>Prix initial</span><span>${fmt(t.price)}</span>
          ${t.listed ? `<span>Prix revente</span><span><strong>${fmt(t.listPrice)}</strong></span>` : ""}
        </div>
        ${actions ? `<div class="t-actions">${actions}</div>` : ""}
      </article>`;
    })
    .join("");
}

async function renderActivity() {
  const { EventTicket: ticket, TicketMarket: market, EntryValidator: validator } = state.contracts;
  const [created, listed, cancelled, sold, validated] = await Promise.all([
    ticket.queryFilter(ticket.filters.TicketCreated(), 0),
    market.queryFilter(market.filters.Listed(), 0),
    market.queryFilter(market.filters.ListingCancelled(), 0),
    market.queryFilter(market.filters.Sold(), 0),
    validator.queryFilter(validator.filters.TicketValidated(), 0),
  ]);

  const items = [
    ...created.map((e) => ({ e, ic: "✨", text: `Billet #${e.args.tokenId} émis pour ${label(e.args.recipient)} à ${fmt(e.args.price)}` })),
    ...listed.map((e) => ({ e, ic: "🏷️", text: `Billet #${e.args.tokenId} mis en vente par ${label(e.args.seller)} à ${fmt(e.args.price)}` })),
    ...cancelled.map((e) => ({ e, ic: "↩️", text: `Billet #${e.args.tokenId} retiré de la vente` })),
    ...sold.map((e) => ({ e, ic: "💸", text: `Billet #${e.args.tokenId} acheté par ${label(e.args.buyer)} pour ${fmt(e.args.price)} (frais ${fmt(e.args.fee)})` })),
    ...validated.map((e) => ({ e, ic: "✅", text: `Entrée validée — billet #${e.args.tokenId} (${label(e.args.attendee)})` })),
  ].sort((a, b) => b.e.blockNumber - a.e.blockNumber || b.e.index - a.e.index);

  $("activityList").innerHTML = items.length
    ? items
        .slice(0, 30)
        .map((i) => `<li><span class="ic">${i.ic}</span><div>${i.text}<div class="meta">bloc #${i.e.blockNumber}</div></div></li>`)
        .join("")
    : `<li class="meta">Aucune activité.</li>`;
}

// ---------- actions ----------

async function onTicketAction(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const t = state.tickets.find((x) => x.id === id);
  const market = writeContract("TicketMarket");

  if (btn.dataset.act === "buy") {
    await send(`Achat du billet #${id}`, () => market.buy(id, { value: t.listPrice }));
  } else if (btn.dataset.act === "cancel") {
    await send(`Retrait du billet #${id}`, () => market.cancel(id));
  } else if (btn.dataset.act === "list") {
    let price;
    try {
      price = ethers.parseEther($(`price-${id}`).value || "0");
    } catch {
      return toast("Prix invalide.", "err");
    }
    if (price <= 0n) return toast("Le prix doit être positif.", "err");
    if (price > t.max) return toast(FRIENDLY["Resale price too high"], "err");
    await send(`Mise en vente du billet #${id}`, async () => {
      const marketAddr = state.deployment.contracts.TicketMarket.address;
      if (!same(t.approved, marketAddr)) {
        await (await writeContract("EventTicket").approve(marketAddr, id)).wait();
      }
      return market.list(id, price);
    });
  } else if (btn.dataset.act === "validate") {
    await send(`Validation du billet #${id}`, () => writeContract("EntryValidator").validateEntry(id));
  }
}

async function onCreate(e) {
  e.preventDefault();
  const to = $("createTo").value.trim();
  if (!ethers.isAddress(to)) return toast("Adresse du destinataire invalide.", "err");
  let price;
  try {
    price = ethers.parseEther($("createPrice").value || "0");
  } catch {
    return toast("Prix invalide.", "err");
  }
  if (price <= 0n) return toast("Le prix doit être positif.", "err");
  await send("Création du billet", () => writeContract("EventTicket").createTicket(to, price));
}

async function onValidate(e) {
  e.preventDefault();
  const id = Number($("validateId").value);
  if (!Number.isInteger(id) || id < 1) return toast("Numéro de billet invalide.", "err");
  await send(`Validation du billet #${id}`, () => writeContract("EntryValidator").validateEntry(id));
}

boot();
