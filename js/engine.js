/**
 * Handlo auction rules, modeled on public WotLK 3.3.5 Auction House formulas.
 * Not Blizzard or Auctioneer source code.
 *
 * Faction house (Handlo):
 *   deposit 12/24/48h = 15% / 30% / 60% of vendor value
 *   house cut on sale = 5%
 *   suggested starting bid = 150% of vendor value
 *   next bid = current bid + max(1¢, 5% of current bid)
 *   unsold / cancel: deposit kept by the house, item returned
 *   sold: deposit refunded, seller gets bid minus cut
 */
(function (global) {
  const HOUSE_CUT = 0.05;
  const DEPOSIT_12H = 0.15;
  const SUGGESTED_BID_MULT = 1.5;
  const BID_INCREMENT = 0.05;
  const MIN_COIN = 1;
  const DURATIONS = [12, 24, 48];

  function money(cents) {
    const n = Math.max(0, Math.round(Number(cents) || 0));
    return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function depositCents(vendorCents, hours) {
    const vendor = Math.max(0, Math.round(vendorCents || 0));
    const base = Math.round(vendor * DEPOSIT_12H);
    const mult = hours === 48 ? 4 : hours === 24 ? 2 : 1;
    return Math.max(MIN_COIN, base * mult);
  }

  function suggestedStartBid(vendorCents) {
    const vendor = Math.round(vendorCents || 0);
    if (vendor <= 0) return 100;
    return Math.max(MIN_COIN, Math.round(vendor * SUGGESTED_BID_MULT));
  }

  function minNextBid(auction) {
    const current = auction.currentBid > 0 ? auction.currentBid : 0;
    if (current <= 0) return Math.max(MIN_COIN, auction.startBid);
    const step = Math.max(MIN_COIN, Math.round(current * BID_INCREMENT));
    return current + step;
  }

  function sellerPayout(winningBid) {
    return Math.round(winningBid * (1 - HOUSE_CUT));
  }

  function houseCut(winningBid) {
    return winningBid - sellerPayout(winningBid);
  }

  function timeLeftLabel(expireAt, now) {
    const ms = expireAt - now;
    if (ms <= 0) return "Expired";
    const hours = ms / 3600000;
    if (hours > 12) return "Very Long";
    if (hours > 2) return "Long";
    if (hours > 0.5) return "Medium";
    return "Short";
  }

  function timeLeftClock(expireAt, now) {
    const ms = Math.max(0, expireAt - now);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  global.HandloAH = {
    HOUSE_CUT,
    DURATIONS,
    money,
    depositCents,
    suggestedStartBid,
    minNextBid,
    sellerPayout,
    houseCut,
    timeLeftLabel,
    timeLeftClock,
    newId,
  };
})(window);
