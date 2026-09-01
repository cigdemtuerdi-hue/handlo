(function (global) {
  const CATALOG = [
    { name: "KitchenAid mixer", category: "Kitchen", vendor: 8900, bag: 1, co2kg: 45 },
    { name: "IKEA Hemnes dresser", category: "Home", vendor: 12000, bag: 1, co2kg: 55 },
    { name: "Trek FX 2 bicycle", category: "Sports", vendor: 35000, bag: 1, co2kg: 120 },
    { name: "Nintendo Switch OLED", category: "Electronics", vendor: 22000, bag: 1, co2kg: 70 },
    { name: "Levi's 501 jeans", category: "Clothing", vendor: 2500, bag: 3, co2kg: 12 },
    { name: "Dyson V8 vacuum", category: "Home", vendor: 18000, bag: 1, co2kg: 50 },
    { name: "Instant Pot 6qt", category: "Kitchen", vendor: 4500, bag: 1, co2kg: 28 },
    { name: "Herman Miller Aeron", category: "Office", vendor: 40000, bag: 1, co2kg: 90 },
    { name: "Canon EOS Rebel T7", category: "Electronics", vendor: 28000, bag: 1, co2kg: 85 },
    { name: "Yeti Rambler 26oz", category: "Sports", vendor: 2200, bag: 2, co2kg: 3 },
  ];

  const SELLERS = ["Nora K.", "James P.", "Aisha R.", "Ben T.", "Maya L.", "Chris D."];

  function hoursFromNow(h) {
    return Date.now() + h * 3600000;
  }

  function seedAuctions() {
    const rows = [
      ["KitchenAid mixer", 1, 11900, 14900, 20, "Nora K."],
      ["KitchenAid mixer", 1, 12500, 15500, 30, "James P."],
      ["KitchenAid mixer", 1, 11000, 12900, 8, "Aisha R."],
      ["IKEA Hemnes dresser", 1, 14000, 17500, 18, "Ben T."],
      ["IKEA Hemnes dresser", 1, 15000, 19000, 40, "Maya L."],
      ["Trek FX 2 bicycle", 1, 42000, 49900, 36, "Chris D."],
      ["Trek FX 2 bicycle", 1, 39000, 45000, 14, "Nora K."],
      ["Nintendo Switch OLED", 1, 24000, 27900, 11, "James P."],
      ["Nintendo Switch OLED", 1, 25000, 28900, 22, "Aisha R."],
      ["Nintendo Switch OLED", 1, 23000, 25500, 4, "Ben T."],
      ["Levi's 501 jeans", 2, 3800, 4900, 16, "Maya L."],
      ["Levi's 501 jeans", 1, 2200, 2800, 9, "Chris D."],
      ["Dyson V8 vacuum", 1, 20000, 23900, 28, "Nora K."],
      ["Instant Pot 6qt", 1, 5200, 6900, 7, "James P."],
      ["Instant Pot 6qt", 1, 5000, 6200, 19, "Aisha R."],
      ["Herman Miller Aeron", 1, 48000, 56000, 32, "Ben T."],
      ["Canon EOS Rebel T7", 1, 31000, 36500, 15, "Maya L."],
      ["Yeti Rambler 26oz", 2, 3600, 4400, 12, "Chris D."],
      ["Yeti Rambler 26oz", 1, 1900, 2400, 3, "Nora K."],
    ];

    return rows.map(([name, qty, start, buy, hours, seller]) => {
      const item = CATALOG.find((c) => c.name === name);
      return {
        id: `seed_${name.replace(/\W+/g, "_")}_${seller.replace(/\W+/g, "_")}_${hours}`,
        name,
        category: item.category,
        qty,
        vendor: item.vendor,
        startBid: start,
        currentBid: 0,
        buyout: buy,
        bidder: "",
        seller,
        owner: seller,
        duration: hours >= 24 ? 48 : hours >= 12 ? 24 : 12,
        postedAt: Date.now() - 3600000,
        expireAt: hoursFromNow(hours),
        deposit: global.HandloAH.depositCents(item.vendor * qty, hours >= 24 ? 48 : hours >= 12 ? 24 : 12),
        status: "live",
      };
    });
  }

  function seedBag() {
    return CATALOG.map((item) => ({
      name: item.name,
      category: item.category,
      vendor: item.vendor,
      qty: item.bag,
    }));
  }

  global.HandloData = { CATALOG, SELLERS, seedAuctions, seedBag };
})(window);
