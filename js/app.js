(function () {
  const STORE_KEY = "handlo-ah-v1";
  const YOU = "You";
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.HandloI18n ? HandloI18n.t(key, vars) : key);
  const sellerLabel = (name) => (name === YOU ? t("you") : name);

  const defaultState = () => ({
    gold: 50000,
    bag: HandloData.seedBag(),
    auctions: HandloData.seedAuctions(),
    mail: [],
    history: [],
    scan: { ran: false, at: 0, count: 0 },
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      if (!s.auctions || !s.bag) return defaultState();
      return s;
    } catch {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  let state = load();
  let selectedId = "";
  let scanTimer = null;

  function now() {
    return Date.now();
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function addMail(titleKey, bodyKey, vars, gold, item) {
    state.mail.unshift({
      id: HandloAH.newId("mail"),
      titleKey,
      bodyKey,
      vars: vars || {},
      title: t(titleKey, vars),
      body: t(bodyKey, vars),
      gold: gold || 0,
      item: item || null,
      at: now(),
      read: false,
    });
  }

  function expireAuctions() {
    const t = now();
    state.auctions.forEach((a) => {
      if (a.status !== "live" || a.expireAt > t) return;
      if (a.currentBid > 0 && a.bidder) {
        settleSale(a, a.currentBid, a.bidder, "expired");
      } else {
        a.status = "expired";
        if (a.owner === YOU) {
          returnItem(a);
          addMail("mail.expiredT", "mail.expiredB", { name: a.name }, 0, { name: a.name, qty: a.qty });
        }
        state.history.push({
          type: "expired",
          name: a.name,
          qty: a.qty,
          price: 0,
          at: t,
        });
      }
    });
  }

  function returnItem(a) {
    const bag = state.bag.find((b) => b.name === a.name);
    if (bag) bag.qty += a.qty;
    else state.bag.push({ name: a.name, category: a.category, vendor: a.vendor, qty: a.qty });
  }

  function settleSale(a, price, buyer, why) {
    a.status = "sold";
    a.currentBid = price;
    a.bidder = buyer;
    const payout = HandloAH.sellerPayout(price);
    if (a.owner === YOU) {
      state.gold += a.deposit + payout;
      addMail(
        "mail.soldT",
        "mail.soldB",
        { name: a.name, money: HandloAH.money(price), cut: HandloAH.money(HandloAH.houseCut(price)) },
        a.deposit + payout,
        null
      );
    }
    if (buyer === YOU) {
      returnItem(a);
      addMail("mail.wonT", "mail.wonB", { name: a.name, money: HandloAH.money(price) }, 0, {
        name: a.name,
        qty: a.qty,
      });
    }
    state.history.push({
      type: why === "buyout" ? "buyout" : "sold",
      name: a.name,
      qty: a.qty,
      price,
      buyer,
      seller: a.owner,
      at: now(),
    });
  }

  function live() {
    return state.auctions.filter((a) => a.status === "live");
  }

  function selected() {
    return live().find((a) => a.id === selectedId) || null;
  }

  function renderChrome() {
    $("gold").textContent = HandloAH.money(state.gold);
    $("ecoChip").textContent = t("eco.saved", { kg: HandloEco.formatKg(HandloEco.reusedKg(state.history, YOU)) });
    const unread = state.mail.filter((m) => !m.read).length;
    $("mailCount").textContent = String(state.mail.length);
    $("mailCount").dataset.unread = unread ? "1" : "0";
    const loc = window.HandloI18n ? HandloI18n.meta().locale : undefined;
    $("scanStamp").textContent = state.scan.ran
      ? t("ui.lastScan", { n: state.scan.count, time: new Date(state.scan.at).toLocaleTimeString(loc) })
      : t("ui.noScan");
  }

  function renderBrowse() {
    const q = $("search").value.trim().toLowerCase();
    const cat = $("category").value;
    const rows = live()
      .filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!cat || a.category === cat))
      .sort((a, b) => (a.buyout || a.startBid) - (b.buyout || b.startBid));

    $("browseBody").innerHTML = rows
      .map((a) => {
        const bid = a.currentBid || a.startBid;
        const mine = a.owner === YOU;
        const timeKey = HandloAH.timeLeftKey(a.expireAt, now());
        const timeClass = timeKey === "veryLong" ? "very-long" : timeKey;
        const catLabel = t("cat." + a.category) || a.category;
        return `<tr data-id="${a.id}" class="${a.id === selectedId ? "on" : ""}">
          <td><strong>${escapeHtml(a.name)}</strong><div class="sub">${escapeHtml(catLabel)}${mine ? " · " + t("ui.yours") : ""} · ~${HandloEco.formatKg(HandloEco.kgFor(a.name, a.qty))}</div></td>
          <td>${a.qty}</td>
          <td>${escapeHtml(sellerLabel(a.seller))}</td>
          <td>${HandloAH.money(bid)}</td>
          <td>${a.buyout ? HandloAH.money(a.buyout) : "—"}</td>
          <td><span class="pill ${timeClass}">${HandloAH.timeLeftLabel(a.expireAt, now())}</span><div class="sub">${HandloAH.timeLeftClock(a.expireAt, now())}</div></td>
        </tr>`;
      })
      .join("");
  }

  function renderDetail() {
    const a = selected();
    const box = $("detail");
    if (!a) {
      box.innerHTML = `<p class='muted'>${t("ui.select")}</p>`;
      return;
    }
    const next = HandloAH.minNextBid(a);
    const hasBid = a.currentBid > 0 && a.bidder;
    const canBid = a.owner !== YOU && state.gold >= next;
    const canBuy = a.owner !== YOU && a.buyout > 0 && state.gold >= a.buyout;
    const stat = Auctioneer.marketFor(live(), a.name);
    const catLabel = t("cat." + a.category) || a.category;
    box.innerHTML = `
      <h3>${escapeHtml(a.name)}</h3>
      <p class="muted">${t("ui.qtyCat", { qty: a.qty, cat: catLabel })} · ${t("ui.seller", { name: escapeHtml(sellerLabel(a.seller)) })}</p>
      <p class="eco-note">${t("ui.reuseNote", { kg: HandloEco.formatKg(HandloEco.kgFor(a.name, a.qty)) })}</p>
      <dl>
        <div><dt>${hasBid ? t("ui.currentBid") : t("ui.startBid")}</dt><dd>${HandloAH.money(hasBid ? a.currentBid : a.startBid)}</dd></div>
        <div><dt>${hasBid ? t("ui.minNext") : t("ui.firstBid")}</dt><dd>${HandloAH.money(next)}</dd></div>
        <div><dt>${t("th.buyout")}</dt><dd>${a.buyout ? HandloAH.money(a.buyout) : t("ui.none")}</dd></div>
        <div><dt>${t("th.time")}</dt><dd>${HandloAH.timeLeftClock(a.expireAt, now())}</dd></div>
      </dl>
      ${
        state.scan.ran && stat.samples
          ? `<p class="statline">${t("ui.aeMarket", { money: HandloAH.money(stat.market), n: stat.samples, conf: stat.confidence })}</p>`
          : `<p class="statline muted">${t("ui.aeNeed")}</p>`
      }
      <div class="actions">
        <button ${canBid ? "" : "disabled"} id="bidBtn">${t("ui.bid", { money: HandloAH.money(next) })}</button>
        <button class="coral" ${canBuy ? "" : "disabled"} id="buyBtn">${a.buyout ? t("ui.buyout", { money: HandloAH.money(a.buyout) }) : t("ui.noBuy")}</button>
      </div>
    `;
    const bidBtn = $("bidBtn");
    const buyBtn = $("buyBtn");
    if (bidBtn) bidBtn.onclick = () => placeBid(a.id);
    if (buyBtn) buyBtn.onclick = () => buyout(a.id);
  }

  function renderBag() {
    $("bagBody").innerHTML = state.bag
      .filter((b) => b.qty > 0)
      .map(
        (b, i) => `<button class="bag-item" data-i="${i}">
          <strong>${escapeHtml(b.name)}</strong>
          <span>${t("ui.inBag", { qty: b.qty, money: HandloAH.money(b.vendor) })}</span>
        </button>`
      )
      .join("");
  }

  function renderMine() {
    const mine = state.auctions.filter((a) => a.owner === YOU);
    $("mineBody").innerHTML = mine.length
      ? mine
          .map(
            (a) => `<tr>
              <td>${escapeHtml(a.name)} ×${a.qty}</td>
              <td>${HandloAH.money(a.currentBid || a.startBid)}</td>
              <td>${a.buyout ? HandloAH.money(a.buyout) : "—"}</td>
              <td>${t("st." + a.status) || a.status}</td>
              <td>${a.status === "live" ? `<button data-cancel="${a.id}">${t("ui.cancel")}</button>` : ""}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="muted">${t("ui.noAuctions")}</td></tr>`;
  }

  function renderBids() {
    const bids = live().filter((a) => a.bidder === YOU);
    $("bidsBody").innerHTML = bids.length
      ? bids
          .map(
            (a) => `<tr>
              <td>${escapeHtml(a.name)}</td>
              <td>${HandloAH.money(a.currentBid)}</td>
              <td>${a.buyout ? HandloAH.money(a.buyout) : "—"}</td>
              <td>${HandloAH.timeLeftClock(a.expireAt, now())}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="muted">${t("ui.noBids")}</td></tr>`;
  }

  function renderAuctioneer() {
    const liveA = live();
    $("aeMarkets").innerHTML = HandloData.CATALOG.map((item) => {
      const stat = Auctioneer.marketFor(liveA, item.name);
      return `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${stat.seen}</td>
        <td>${stat.samples ? HandloAH.money(stat.market) : "—"}</td>
        <td>${stat.samples ? HandloAH.money(stat.low) + "–" + HandloAH.money(stat.high) : "—"}</td>
        <td>${stat.samples ? stat.confidence + "%" : "—"}</td>
      </tr>`;
    }).join("");

    const dealRows = state.scan.ran ? Auctioneer.deals(liveA) : [];
    $("aeDeals").innerHTML = dealRows.length
      ? dealRows
          .map(
            (d) => `<tr data-id="${d.auction.id}">
              <td>${escapeHtml(d.auction.name)}</td>
              <td>${HandloAH.money(d.auction.buyout)}</td>
              <td>${HandloAH.money(d.stat.market)}</td>
              <td class="deal">${t("ui.ofMarket", { pct: d.pct })}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="muted">${state.scan.ran ? t("ui.noDeals") : t("ui.scanFirst")}</td></tr>`;

    $("aeHistory").innerHTML = state.history.length
      ? state.history
          .slice()
          .reverse()
          .slice(0, 20)
          .map(
            (h) => `<tr>
              <td>${t("st." + h.type) || h.type}</td>
              <td>${escapeHtml(h.name)} ×${h.qty || 1}</td>
              <td>${h.price ? HandloAH.money(h.price) : "—"}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="3" class="muted">${t("ui.noHist")}</td></tr>`;
  }

  function renderImpact() {
    if (!$("impactYou")) return;
    $("impactYou").textContent = HandloEco.formatKg(HandloEco.reusedKg(state.history, YOU));
    $("impactLive").textContent = HandloEco.formatKg(HandloEco.livePotential(live()));
    $("impactSold").textContent = HandloEco.formatKg(HandloEco.reusedKg(state.history));
  }

  function renderMail() {
    $("mailList").innerHTML = state.mail.length
      ? state.mail
          .map(
            (m) => {
              const title = m.titleKey ? t(m.titleKey, m.vars) : m.title;
              const body = m.bodyKey ? t(m.bodyKey, m.vars) : m.body;
              const loc = window.HandloI18n ? HandloI18n.meta().locale : undefined;
              return `<article class="${m.read ? "" : "unread"}">
              <h4>${escapeHtml(title)}</h4>
              <p>${escapeHtml(body)}</p>
              <time>${new Date(m.at).toLocaleString(loc)}</time>
            </article>`;
            }
          )
          .join("")
      : `<p class='muted'>${t("ui.mailEmpty")}</p>`;
    state.mail.forEach((m) => {
      m.read = true;
    });
  }

  function render() {
    expireAuctions();
    renderChrome();
    renderBrowse();
    renderDetail();
    renderBag();
    renderMine();
    renderBids();
    renderAuctioneer();
    renderImpact();
    fillPostSelect();
    save();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function placeBid(id) {
    const a = live().find((x) => x.id === id);
    if (!a || a.owner === YOU) return;
    const next = HandloAH.minNextBid(a);
    if (state.gold < next) return toast(t("toast.noMoney"));
    if (a.buyout && next >= a.buyout) return buyout(id);
    if (a.bidder === YOU) state.gold += a.currentBid;
    else if (a.bidder) {
      addMail("mail.outbidT", "mail.outbidB", { name: a.name, money: HandloAH.money(a.currentBid) }, a.currentBid, null);
      /* gold of previous NPC bidder is not tracked */
    }
    state.gold -= next;
    a.currentBid = next;
    a.bidder = YOU;
    toast(t("toast.bidOk", { money: HandloAH.money(next) }));
    render();
  }

  function buyout(id) {
    const a = live().find((x) => x.id === id);
    if (!a || !a.buyout || a.owner === YOU) return;
    if (state.gold < a.buyout) return toast(t("toast.noMoney"));
    if (a.bidder === YOU) state.gold += a.currentBid;
    else if (a.bidder) {
      addMail("mail.outbidT", "mail.buyOutbidB", { name: a.name, money: HandloAH.money(a.currentBid) }, a.currentBid, null);
    }
    state.gold -= a.buyout;
    settleSale(a, a.buyout, YOU, "buyout");
    toast(t("toast.buyOk"));
    selectedId = "";
    render();
  }

  function cancelAuction(id) {
    const a = live().find((x) => x.id === id);
    if (!a || a.owner !== YOU) return;
    if (a.bidder === YOU) state.gold += a.currentBid;
    else if (a.bidder) {
      addMail("mail.cancelT", "mail.outbidB", { name: a.name, money: HandloAH.money(a.currentBid) }, a.currentBid, null);
    }
    a.status = "cancelled";
    returnItem(a);
    addMail("mail.youCancelT", "mail.youCancelB", { name: a.name }, 0, {
      name: a.name,
      qty: a.qty,
    });
    toast(t("toast.cancelled"));
    render();
  }

  function fillPostSelect() {
    const sel = $("postItem");
    const current = sel.value;
    const opts = state.bag
      .filter((b) => b.qty > 0)
      .map((b) => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)} (${b.qty})</option>`);
    sel.innerHTML = opts.join("") || `<option value="">${t("ui.bagEmpty")}</option>`;
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
    updatePostMath();
  }

  function bagItem(name) {
    return state.bag.find((b) => b.name === name);
  }

  function updatePostMath() {
    const item = bagItem($("postItem").value);
    const qty = Math.max(1, Number($("postQty").value) || 1);
    const hours = Number($("postHours").value);
    if (!item) {
      $("postMath").textContent = t("ui.pickBag");
      return;
    }
    $("postQty").max = item.qty;
    const deposit = HandloAH.depositCents(item.vendor * qty, hours);
    const suggest = HandloAH.suggestedStartBid(item.vendor) * qty;
    const ae = Auctioneer.appraise(live(), item.name, qty, item.vendor);
    $("postMath").innerHTML =
      t("ui.depositLine", { h: hours, dep: `<strong>${HandloAH.money(deposit)}</strong>`, start: `<strong>${HandloAH.money(suggest)}</strong>` }) +
      " " +
      (state.scan.ran && ae.stat.samples
        ? t("ui.aeFill", { money: `<strong>${HandloAH.money(ae.buyout)}</strong>` })
        : t("ui.scanToFill"));
    if (!$("postBid").dataset.touched) $("postBid").value = ((state.scan.ran && ae.stat.samples ? ae.startBid : suggest) / 100).toFixed(2);
    if (!$("postBuy").dataset.touched) $("postBuy").value = ((state.scan.ran && ae.stat.samples ? ae.buyout : Math.round(suggest * 1.25)) / 100).toFixed(2);
  }

  function postAuction(ev) {
    ev.preventDefault();
    const item = bagItem($("postItem").value);
    if (!item) return toast(t("toast.nothing"));
    const qty = Math.max(1, Math.min(item.qty, Number($("postQty").value) || 1));
    const hours = Number($("postHours").value);
    const startBid = Math.round(Number($("postBid").value) * 100);
    const buyRaw = $("postBuy").value;
    const buyoutAmt = buyRaw === "" ? 0 : Math.round(Number(buyRaw) * 100);
    if (startBid < 1) return toast(t("toast.minBid"));
    if (buyoutAmt && buyoutAmt < startBid) return toast(t("toast.buyLow"));
    const deposit = HandloAH.depositCents(item.vendor * qty, hours);
    if (state.gold < deposit) return toast(t("toast.deposit"));
    state.gold -= deposit;
    item.qty -= qty;
    state.auctions.unshift({
      id: HandloAH.newId("ah"),
      name: item.name,
      category: item.category,
      qty,
      vendor: item.vendor,
      startBid,
      currentBid: 0,
      buyout: buyoutAmt,
      bidder: "",
      seller: YOU,
      owner: YOU,
      duration: hours,
      postedAt: now(),
      expireAt: now() + hours * 3600000,
      deposit,
      status: "live",
    });
    $("postBid").dataset.touched = "";
    $("postBuy").dataset.touched = "";
    toast(t("toast.created"));
    showTab("auctions");
    render();
  }

  function runScan() {
    if (scanTimer) return;
    const bar = $("scanBar");
    const label = $("scanLabel");
    let p = 0;
    label.textContent = t("ui.scanning");
    bar.style.width = "0%";
    scanTimer = setInterval(() => {
      p += 8;
      bar.style.width = Math.min(p, 100) + "%";
      if (p >= 100) {
        clearInterval(scanTimer);
        scanTimer = null;
        state.scan = { ran: true, at: now(), count: live().length };
        label.textContent = t("ui.scanDone");
        toast(t("toast.scanFin"));
        render();
      }
    }, 80);
  }

  function showTab(name) {
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.hidden = p.id !== "panel-" + name;
    });
    if (name === "mail") renderMail();
  }

  function resetDemo() {
    localStorage.removeItem(STORE_KEY);
    state = defaultState();
    selectedId = "";
    toast(t("toast.reset"));
    render();
  }

  $("browseBody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    selectedId = tr.dataset.id;
    render();
  });
  $("aeDeals").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    selectedId = tr.dataset.id;
    showTab("browse");
    render();
  });
  $("mineBody").addEventListener("click", (e) => {
    const id = e.target.dataset.cancel;
    if (id) cancelAuction(id);
  });
  $("bagBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".bag-item");
    if (!btn) return;
    const item = state.bag.filter((b) => b.qty > 0)[Number(btn.dataset.i)];
    if (!item) return;
    $("postItem").value = item.name;
    $("postQty").value = "1";
    $("postBid").dataset.touched = "";
    $("postBuy").dataset.touched = "";
    updatePostMath();
    showTab("auctions");
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  $("search").addEventListener("input", renderBrowse);
  $("category").addEventListener("change", renderBrowse);
  $("postForm").addEventListener("submit", postAuction);
  $("postItem").addEventListener("change", () => {
    $("postBid").dataset.touched = "";
    $("postBuy").dataset.touched = "";
    $("postQty").value = "1";
    updatePostMath();
  });
  $("postQty").addEventListener("input", () => {
    $("postBid").dataset.touched = "";
    $("postBuy").dataset.touched = "";
    updatePostMath();
  });
  $("postHours").addEventListener("change", () => {
    $("postBid").dataset.touched = "";
    $("postBuy").dataset.touched = "";
    updatePostMath();
  });
  $("postBid").addEventListener("input", () => {
    $("postBid").dataset.touched = "1";
  });
  $("postBuy").addEventListener("input", () => {
    $("postBuy").dataset.touched = "1";
  });
  $("scanBtn").addEventListener("click", runScan);
  $("resetBtn").addEventListener("click", resetDemo);
  $("fillAe").addEventListener("click", () => {
    const item = bagItem($("postItem").value);
    if (!item) return;
    if (!state.scan.ran) return toast(t("toast.scanFirst"));
    const qty = Math.max(1, Number($("postQty").value) || 1);
    const ae = Auctioneer.appraise(live(), item.name, qty, item.vendor);
    $("postBid").value = (ae.startBid / 100).toFixed(2);
    $("postBuy").value = (ae.buyout / 100).toFixed(2);
    $("postBid").dataset.touched = "1";
    $("postBuy").dataset.touched = "1";
  });

  document.addEventListener("handlo-lang", () => {
    if (window.HandloI18n) HandloI18n.apply();
    render();
    const mailPanel = $("panel-mail");
    if (mailPanel && !mailPanel.hidden) renderMail();
  });

  showTab("browse");
  render();
  setInterval(() => {
    expireAuctions();
    renderBrowse();
    renderDetail();
    renderBids();
    renderChrome();
    save();
  }, 1000);
})();
