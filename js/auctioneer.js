/**
 * Auctioneer-style seller tools for Handlo.
 * Inspired by the public 3.3.5 addon workflow (scan, market, appraiser, deals).
 * Original Auctioneer Lua is not used or copied.
 */
(function (global) {
  function itemKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  function mean(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  function stdev(values) {
    if (values.length < 2) return 0;
    const m = values.reduce((a, b) => a + b, 0) / values.length;
    const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
    return Math.round(Math.sqrt(v));
  }

  function collectPrices(auctions, key) {
    return auctions
      .filter((a) => a.status === "live" && itemKey(a.name) === key && a.buyout > 0)
      .map((a) => Math.round(a.buyout / Math.max(1, a.qty)));
  }

  function marketFor(auctions, name) {
    const key = itemKey(name);
    const unit = collectPrices(auctions, key);
    const seen = auctions.filter((a) => a.status === "live" && itemKey(a.name) === key).length;
    if (!unit.length) {
      return { key, seen, samples: 0, market: 0, mean: 0, stdev: 0, low: 0, high: 0, confidence: 0 };
    }
    const m = median(unit);
    return {
      key,
      seen,
      samples: unit.length,
      market: m,
      mean: mean(unit),
      stdev: stdev(unit),
      low: Math.min(...unit),
      high: Math.max(...unit),
      confidence: Math.min(99, 20 + unit.length * 12),
    };
  }

  function undercut(marketUnit, qty) {
    if (!marketUnit) return 0;
    const stack = marketUnit * Math.max(1, qty);
    return Math.max(1, stack - 1);
  }

  function deals(auctions) {
    return auctions
      .filter((a) => a.status === "live" && a.buyout > 0)
      .map((a) => {
        const stat = marketFor(auctions, a.name);
        const unit = Math.round(a.buyout / Math.max(1, a.qty));
        const pct = stat.market ? Math.round((unit / stat.market) * 100) : 100;
        return { auction: a, stat, unit, pct };
      })
      .filter((row) => row.stat.samples >= 2 && row.pct <= 85)
      .sort((a, b) => a.pct - b.pct);
  }

  function appraise(auctions, name, qty, vendorCents) {
    const q = Math.max(1, qty || 1);
    const stat = marketFor(auctions, name);
    const vendor = Math.round(vendorCents || 0);
    const start = stat.market
      ? Math.round(stat.market * q * 0.85)
      : global.HandloAH.suggestedStartBid(vendor) * q;
    const buy = stat.market ? undercut(stat.market, q) : Math.round(start * 1.25);
    return {
      stat,
      startBid: Math.max(1, start),
      buyout: Math.max(start, buy),
      undercut: stat.market ? undercut(stat.market, q) : 0,
    };
  }

  global.Auctioneer = {
    itemKey,
    marketFor,
    undercut,
    deals,
    appraise,
  };
})(window);
