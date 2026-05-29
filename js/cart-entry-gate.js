/**
 * Shows an IMPORTANT notice once per browser tab session before navigating to the cart.
 * Intercepts same-origin links to cart.html or /cart.
 */
(function () {
  var KEY = "eyenoon_cart_gate_ok_v1";

  function approved() {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function approve() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch (e) {}
  }

  function isCartHref(href) {
    if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return false;
    try {
      var u = new URL(href, window.location.href);
      var p = u.pathname || "";
      return /\/cart(\.html)?$/i.test(p);
    } catch (e) {
      return /cart\.html/i.test(href);
    }
  }

  function samePathAsCurrent(href) {
    try {
      var u = new URL(href, window.location.href);
      var cur = new URL(window.location.href);
      return u.pathname === cur.pathname;
    } catch (e) {
      return false;
    }
  }

  function injectStylesOnce() {
    if (document.getElementById("eyenoon-cart-gate-styles")) return;
    var s = document.createElement("style");
    s.id = "eyenoon-cart-gate-styles";
    s.textContent =
      "#eyenoon-cart-gate-overlay{position:fixed;inset:0;z-index:99999;background:rgba(10,10,10,.55);display:flex;align-items:center;justify-content:center;padding:1.25rem;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif}" +
      "#eyenoon-cart-gate-panel{max-width:32rem;width:100%;max-height:90vh;overflow:auto;background:#fff;border:1px solid rgba(224,17,95,.25);box-shadow:0 20px 50px rgba(0,0,0,.15)}" +
      "#eyenoon-cart-gate-title{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:900;text-transform:uppercase;font-size:1.35rem;color:#0A0A0A;margin:0 0 .75rem}" +
      ".eyenoon-cart-gate-body{font-size:.8125rem;line-height:1.55;color:rgba(10,10,10,.82)}" +
      ".eyenoon-cart-gate-body p{margin:0 0 .85rem}" +
      ".eyenoon-cart-gate-body p:last-child{margin-bottom:0}" +
      "#eyenoon-cart-gate-continue{width:100%;margin-top:1.25rem;padding:.85rem 1rem;border:0;background:#E0115F;color:#fff;font-size:.65rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}" +
      "#eyenoon-cart-gate-continue:hover{opacity:.95}" +
      "#eyenoon-cart-gate-panel .eyenoon-cart-gate-inner{padding:1.5rem}";
    document.head.appendChild(s);
  }

  function showModal(onContinue) {
    injectStylesOnce();
    var old = document.getElementById("eyenoon-cart-gate-overlay");
    if (old) old.remove();

    var overlay = document.createElement("div");
    overlay.id = "eyenoon-cart-gate-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "eyenoon-cart-gate-title");

    var panel = document.createElement("div");
    panel.id = "eyenoon-cart-gate-panel";

    var title = document.createElement("h2");
    title.id = "eyenoon-cart-gate-title";
    title.textContent = "IMPORTANT!";

    var body = document.createElement("div");
    body.className = "eyenoon-cart-gate-body";
    var parts = [
      "YOU ARE REQUIRED TO SEND US YOUR PRESCRIPTION by e-mail, if you are ordering contact lenses for the first time. Without your prescription, your order will automatically be cancelled. (Not applied for returning customers.)",
      "YOU MIGHT BE ASKED TO VERIFY YOUR IDENTITY when you are ordering over $500. We do not share your information with third parties.",
      "Eye:Noon Optical sells products simultaneously through online and offline shops, therefore, the stock list for our products constantly fluctuates and it is subject to change at any given time. Please contact us ahead of placing your order.",
    ];
    for (var i = 0; i < parts.length; i++) {
      var p = document.createElement("p");
      p.textContent = i + 1 + ". " + parts[i];
      body.appendChild(p);
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "eyenoon-cart-gate-continue";
    btn.textContent = "Continue to cart";

    var inner = document.createElement("div");
    inner.className = "eyenoon-cart-gate-inner";
    inner.appendChild(title);
    inner.appendChild(body);
    inner.appendChild(btn);

    panel.appendChild(inner);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    function close() {
      document.body.style.overflow = "";
      overlay.remove();
    }

    btn.addEventListener("click", function () {
      close();
      onContinue();
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        /* click outside does not dismiss — user must acknowledge */
      }
    });

    setTimeout(function () {
      btn.focus();
    }, 0);
  }

  function isOnCartPage() {
    try {
      var p = new URL(window.location.href).pathname || "";
      return /\/cart(\.html)?$/i.test(p);
    } catch (e) {
      return /cart\.html/i.test(window.location.pathname || "");
    }
  }

  function gateDirectCartVisit() {
    if (!isOnCartPage()) return;
    if (approved()) return;
    showModal(function () {
      approve();
    });
  }

  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (a.getAttribute("target") === "_blank") return;
      var href = a.getAttribute("href");
      if (!href || !isCartHref(href)) return;
      if (samePathAsCurrent(href)) return;
      if (approved()) return;
      e.preventDefault();
      e.stopPropagation();
      var dest = a.href;
      showModal(function () {
        approve();
        window.location.href = dest;
      });
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", gateDirectCartVisit);
  } else {
    gateDirectCartVisit();
  }
})();
