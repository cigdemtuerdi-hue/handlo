/**
 * Handlo membership — USA only.
 * Static GitHub Pages cannot send real email yet. The verify link is the same
 * URL a mail server would send: verify.html?token=...
 */
(function (global) {
  const MEMBER_KEY = "handlo-member-v1";
  const PENDING_KEY = "handlo-pending-v1";
  const t = (key, vars) => (global.HandloI18n ? HandloI18n.t(key, vars) : key);

  function loadRaw(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveRaw(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function account() {
    return loadRaw(MEMBER_KEY);
  }

  function isVerified() {
    const a = account();
    return !!(a && a.status === "verified" && a.email);
  }

  function isPending() {
    const a = account();
    return !!(a && a.status === "pending");
  }

  function displayName() {
    const a = account();
    if (!a) return "";
    return [a.firstName, a.lastName].filter(Boolean).join(" ");
  }

  function newToken() {
    const bytes = new Uint8Array(16);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function savePendingIntent(intent) {
    if (!intent || !intent.kind) return;
    saveRaw(PENDING_KEY, {
      kind: String(intent.kind),
      id: intent.id || "",
      at: Date.now(),
    });
  }

  function peekIntent() {
    return loadRaw(PENDING_KEY);
  }

  function takeIntent() {
    const intent = peekIntent();
    localStorage.removeItem(PENDING_KEY);
    return intent;
  }

  function joinUrl(intent) {
    if (intent) savePendingIntent(intent);
    const next = "auction.html";
    return "join.html?next=" + encodeURIComponent(next);
  }

  function openJoin(intent) {
    location.href = joinUrl(intent);
  }

  function requireVerified(intent) {
    if (isVerified()) return true;
    openJoin(intent);
    return false;
  }

  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function normalizeEmail(s) {
    return String(s || "").trim().toLowerCase();
  }

  function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(s));
  }

  function validPhone(s) {
    let d = digits(s);
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    return d.length === 10;
  }

  function formatPhone(s) {
    let d = digits(s);
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    if (d.length !== 10) return String(s || "").trim();
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }

  function validZip(s) {
    return /^\d{5}$/.test(String(s || "").trim());
  }

  function validName(s) {
    return String(s || "").trim().length >= 2;
  }

  function validateDraft(draft) {
    if (!validName(draft.firstName) || !validName(draft.lastName)) return "member.badName";
    if (!validEmail(draft.email)) return "member.badEmail";
    if (normalizeEmail(draft.email) !== normalizeEmail(draft.email2)) return "member.mismatch";
    if (!validPhone(draft.phone)) return "member.badPhone";
    if (!validZip(draft.zip) || !String(draft.city || "").trim() || !String(draft.state || "").trim()) {
      return "member.badAddress";
    }
    if (!String(draft.line || "").trim()) return "member.badStreet";
    if (String(draft.country || "US").toUpperCase() !== "US") return "member.badAddress";
    return "";
  }

  function verifyHref(token) {
    const base = location.href.replace(/[^/]*$/, "");
    return base + "verify.html?token=" + encodeURIComponent(token);
  }

  function createPending(draft) {
    const err = validateDraft(draft);
    if (err) return { ok: false, error: err };
    const token = newToken();
    const rec = {
      status: "pending",
      firstName: String(draft.firstName).trim(),
      lastName: String(draft.lastName).trim(),
      email: normalizeEmail(draft.email),
      phone: formatPhone(draft.phone),
      address: {
        line: String(draft.line).trim(),
        city: String(draft.city).trim(),
        state: String(draft.state).trim().toUpperCase(),
        zip: String(draft.zip).trim(),
        country: "US",
        label: String(draft.label || "").trim(),
      },
      token,
      createdAt: Date.now(),
      verifiedAt: 0,
    };
    saveRaw(MEMBER_KEY, rec);
    return { ok: true, account: rec, verifyUrl: verifyHref(token) };
  }

  function verifyToken(token) {
    const a = account();
    if (!a || !token || a.token !== token) return { ok: false, error: "member.invalidLink" };
    a.status = "verified";
    a.verifiedAt = Date.now();
    saveRaw(MEMBER_KEY, a);
    return { ok: true, account: a, intent: peekIntent() };
  }

  function startOver() {
    localStorage.removeItem(MEMBER_KEY);
  }

  function uniqueSuggestions(rows) {
    const seen = new Set();
    return rows.filter((r) => {
      const k = [r.line, r.city, r.state, r.zip].join("|").toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function photonRow(feat) {
    const p = feat.properties || {};
    const country = String(p.countrycode || p.country || "").toUpperCase();
    if (country && country !== "US" && country !== "USA" && country !== "UNITED STATES") return null;
    const zip = String(p.postcode || "").replace(/\D/g, "").slice(0, 5);
    const city = p.city || p.name || p.district || "";
    const state = p.statecode || p.state || "";
    const house = p.housenumber ? p.housenumber + " " : "";
    const street = p.street || (p.osm_value === "post_box" || /po box/i.test(p.name || "") ? p.name : "");
    const line = (house + (street || "")).trim() || (p.name && !city ? p.name : "");
    const st = String(state).length === 2 ? String(state).toUpperCase() : String(state);
    if (!city && !zip && !line) return null;
    const label = [line, city, st, zip].filter(Boolean).join(", ");
    return { label, line, city, state: st, zip, country: "US" };
  }

  const ZIP_FALLBACK = {
    "92880": [
      { city: "Eastvale", state: "CA" },
      { city: "Corona", state: "CA" },
    ],
    "91752": [
      { city: "Jurupa Valley", state: "CA" },
      { city: "Mira Loma", state: "CA" },
    ],
    "92503": [{ city: "Riverside", state: "CA" }],
    "90012": [{ city: "Los Angeles", state: "CA" }],
    "10001": [{ city: "New York", state: "NY" }],
  };

  function zipRows(zip, places) {
    return places.map((p) => ({
      label: p.city + ", " + p.state + " " + zip,
      line: "",
      city: p.city,
      state: p.state,
      zip,
      country: "US",
    }));
  }

  async function zipLookup(zip) {
    if (ZIP_FALLBACK[zip]) return zipRows(zip, ZIP_FALLBACK[zip]);
    const res = await fetch("https://api.zippopotam.us/us/" + zip);
    if (!res.ok) return [];
    const data = await res.json();
    const places = (data.places || []).map((p) => ({
      city: p["place name"],
      state: p["state abbreviation"],
    }));
    return zipRows(data["post code"] || zip, places);
  }

  async function photonLookup(q) {
    const url =
      "https://photon.komoot.io/api/?q=" +
      encodeURIComponent(q) +
      "&limit=8&lang=en";
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map(photonRow).filter(Boolean);
  }

  async function lookupAddress(query) {
    const q = String(query || "").trim();
    if (q.length < 3) return [];
    const zipOnly = /^\d{5}(?:-\d{4})?$/.test(q.replace(/\s/g, ""));
    const zip = (q.match(/\b(\d{5})\b/) || [])[1];
    const out = [];
    try {
      if (zip) {
        const zrows = await zipLookup(zip);
        out.push.apply(out, zrows);
      }
    } catch (_) {}
    if (!zipOnly || out.length === 0) {
      try {
        const prows = await photonLookup(q + (/\bus\b/i.test(q) ? "" : " USA"));
        out.push.apply(out, prows);
      } catch (_) {}
    }
    return uniqueSuggestions(out).slice(0, 8);
  }

  function bindMailbox(input, list, onPick) {
    let timer = null;
    let last = "";
    function hide() {
      list.hidden = true;
      list.innerHTML = "";
    }
    function show(rows) {
      if (!rows.length) {
        list.hidden = false;
        list.innerHTML = "<li class='muted'>" + t("member.noSuggest") + "</li>";
        return;
      }
      list.hidden = false;
      list.innerHTML = rows
        .map(
          (r, i) =>
            "<li><button type='button' data-i='" +
            i +
            "'>" +
            String(r.label)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;") +
            "</button></li>"
        )
        .join("");
      list.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = rows[Number(btn.dataset.i)];
          onPick(row);
          hide();
        });
      });
    }
    input.addEventListener("input", () => {
      const q = input.value.trim();
      last = q;
      clearTimeout(timer);
      if (q.length < 3) {
        hide();
        return;
      }
      list.hidden = false;
      list.innerHTML = "<li class='muted'>" + t("member.searching") + "</li>";
      timer = setTimeout(async () => {
        const rows = await lookupAddress(q);
        if (input.value.trim() !== last) return;
        show(rows);
      }, 280);
    });
    input.addEventListener("blur", () => setTimeout(hide, 180));
  }

  function continueHref() {
    const intent = peekIntent();
    const params = new URLSearchParams();
    params.set("resume", "1");
    if (intent && intent.kind) params.set("intent", intent.kind);
    if (intent && intent.id) params.set("id", intent.id);
    return "auction.html?" + params.toString();
  }

  global.HandloMember = {
    account,
    isVerified,
    isPending,
    displayName,
    requireVerified,
    openJoin,
    joinUrl,
    savePendingIntent,
    peekIntent,
    takeIntent,
    createPending,
    verifyToken,
    startOver,
    lookupAddress,
    bindMailbox,
    validateDraft,
    validEmail,
    validPhone,
    validZip,
    normalizeEmail,
    formatPhone,
    verifyHref,
    continueHref,
  };
})(window);
