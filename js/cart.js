/* Eye Noon — cart (localStorage + session mirror); lens order context. Persists for the same browser & origin (same URL host/port). */
(function () {
  var KEY = "eyenoon_cart_v1";
  var ORDER_CTX_KEY = "eyenoon_lens_order_ctx_v1";

  function storageSet(storage, k, val) {
    try {
      storage.setItem(k, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageGet(storage, k) {
    try {
      return storage.getItem(k);
    } catch (e) {
      return null;
    }
  }

  function getLensOrderContext() {
    var raw = storageGet(localStorage, ORDER_CTX_KEY);
    if (!raw) raw = storageGet(sessionStorage, ORDER_CTX_KEY);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {object} o
   * @param {boolean} [o.existingCustomer]
   * @param {string} [o.name]
   * @param {string} [o.dateOfBirth]
   * @param {string} [o.phone]
   * @param {string} [o.email]
   * @param {{ fileName: string, mimeType: string, base64: string } | null} [o.prescriptionUpload]
   */
  function setLensOrderContext(o) {
    var s = JSON.stringify(o);
    storageSet(localStorage, ORDER_CTX_KEY, s);
    storageSet(sessionStorage, ORDER_CTX_KEY, s);
    document.dispatchEvent(new CustomEvent("eyenoon-lens-order-changed"));
  }

  function clearLensOrderContext() {
    try {
      localStorage.removeItem(ORDER_CTX_KEY);
    } catch (e) {}
    try {
      sessionStorage.removeItem(ORDER_CTX_KEY);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("eyenoon-lens-order-changed"));
  }

  /** @deprecated use getLensOrderContext — subset for prefill */
  function getLensPrescription() {
    var o = getLensOrderContext();
    if (!o || o.existingCustomer) return null;
    return {
      name: o.name || "",
      dateOfBirth: o.dateOfBirth || "",
      phone: o.phone || "",
      email: o.email || "",
    };
  }

  function clearLensPrescription() {
    clearLensOrderContext();
  }

  function normalizeLines(raw) {
    try {
      var lines = JSON.parse(raw || "[]");
      if (!Array.isArray(lines)) return [];
      return lines.map(function (l) {
        if (!l.kind) l.kind = "contact_lens";
        return l;
      });
    } catch (e) {
      return [];
    }
  }

  /**
   * Prefer localStorage when it has items; if it is empty but sessionStorage still
   * has lines (e.g. desync), restore from session — avoids “empty cart” after Back.
   */
  function load() {
    var localLines = normalizeLines(storageGet(localStorage, KEY));
    var sessionLines = normalizeLines(storageGet(sessionStorage, KEY));

    if (localLines.length > 0) {
      storageSet(sessionStorage, KEY, JSON.stringify(localLines));
      return localLines;
    }
    if (sessionLines.length > 0) {
      storageSet(localStorage, KEY, JSON.stringify(sessionLines));
      return sessionLines;
    }
    return [];
  }

  function save(lines) {
    var payload = JSON.stringify(lines);
    storageSet(localStorage, KEY, payload);
    storageSet(sessionStorage, KEY, payload);
    if (!lines.length) clearLensOrderContext();
    document.dispatchEvent(new CustomEvent("eyenoon-cart-changed"));
  }

  function findIndex(lines, slug) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].slug === slug) return i;
    }
    return -1;
  }

  function addItem(item) {
    var lines = load();
    var q = Math.max(1, parseInt(item.qty, 10) || 1);
    var i = findIndex(lines, item.slug);
    if (i >= 0) {
      lines[i].qty += q;
    } else {
      lines.push({
        slug: item.slug,
        name: item.name,
        price: Number(item.price),
        img: item.img,
        qty: q,
        kind: item.kind || "contact_lens",
      });
    }
    save(lines);
  }

  function setQty(slug, qty) {
    var lines = load();
    var i = findIndex(lines, slug);
    if (i < 0) return;
    var q = parseInt(qty, 10);
    if (!isFinite(q) || q < 1) q = 1;
    lines[i].qty = q;
    save(lines);
  }

  function remove(slug) {
    var lines = load().filter(function (l) {
      return l.slug !== slug;
    });
    save(lines);
  }

  function clear() {
    save([]);
  }

  function totalCount() {
    return load().reduce(function (s, l) {
      return s + l.qty;
    }, 0);
  }

  function totalPrice() {
    return load().reduce(function (s, l) {
      return s + l.price * l.qty;
    }, 0);
  }

  function refreshBadge() {
    var el = document.getElementById("cart-count");
    if (!el) return;
    var n = totalCount();
    el.textContent = n > 0 ? String(n) : "";
    el.setAttribute("aria-label", n > 0 ? n + " items in cart" : "Cart empty");
    el.style.visibility = n > 0 ? "visible" : "hidden";
  }

  document.addEventListener("eyenoon-cart-changed", refreshBadge);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshBadge);
  } else {
    refreshBadge();
  }

  /* Other tabs on the same site update localStorage — keep badge and cart UIs in sync */
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY && e.key !== ORDER_CTX_KEY) return;
    refreshBadge();
    document.dispatchEvent(new CustomEvent("eyenoon-cart-changed"));
  });

  /* Same-tab Back/forward (bfcache): badge can be stale until we re-read storage */
  window.addEventListener("pageshow", function () {
    refreshBadge();
  });

  window.EyeNoonCart = {
    load: load,
    addItem: addItem,
    setQty: setQty,
    remove: remove,
    clear: clear,
    totalCount: totalCount,
    totalPrice: totalPrice,
    getLensOrderContext: getLensOrderContext,
    setLensOrderContext: setLensOrderContext,
    clearLensOrderContext: clearLensOrderContext,
    getLensPrescription: getLensPrescription,
    setLensPrescription: function (contact) {
      setLensOrderContext({
        existingCustomer: false,
        name: contact.name,
        dateOfBirth: contact.dateOfBirth,
        phone: contact.phone,
        email: contact.email,
      });
    },
    clearLensPrescription: clearLensPrescription,
  };
})();
