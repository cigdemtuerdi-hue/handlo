/**
 * Estimated kg CO2e avoided by giving an item a second life instead of buying new.
 * Order-of-magnitude manufacturing estimates, labeled as estimates in the UI.
 */
(function (global) {
  function catalogItem(name) {
    return (global.HandloData.CATALOG || []).find((c) => c.name === name) || null;
  }

  function kgFor(name, qty) {
    const item = catalogItem(name);
    const unit = item && item.co2kg ? item.co2kg : 8;
    return Math.round(unit * Math.max(1, qty || 1) * 10) / 10;
  }

  function formatKg(kg) {
    const n = Number(kg) || 0;
    if (n >= 100) return `${Math.round(n)} kg CO₂e`;
    return `${n.toFixed(1)} kg CO₂e`;
  }

  function livePotential(auctions) {
    return (auctions || [])
      .filter((a) => a.status === "live")
      .reduce((sum, a) => sum + kgFor(a.name, a.qty), 0);
  }

  function reusedKg(history, who) {
    return (history || [])
      .filter((h) => (h.type === "sold" || h.type === "buyout") && (!who || h.buyer === who))
      .reduce((sum, h) => sum + kgFor(h.name, h.qty), 0);
  }

  global.HandloEco = { kgFor, formatKg, livePotential, reusedKg };
})(window);
