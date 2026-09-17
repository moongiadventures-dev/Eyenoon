/**
 * Order pricing shown at checkout.
 *
 * Shipping is a flat fee on every order and no sales tax is charged, so totals
 * no longer depend on the delivery address. Keep SHIPPING_FLAT in sync with the
 * same constant in server/index.js - the server recomputes the total and
 * refuses the payment if the two disagree.
 */
(function (global) {
  var SHIPPING_FLAT = 15;

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function parseZip5(z) {
    var s = String(z || "").replace(/\D/g, "");
    if (s.length >= 5) return s.slice(0, 5);
    return "";
  }


  /** SoCal — free delivery zone (edit to match your policy). */

  /**
   * @param {number} subtotal
   * @param {string} state — 2-letter US state
   * @param {string} zipRaw
   */
  function estimate(subtotal) {
    var sub = round2(subtotal);
    var delivery = SHIPPING_FLAT;
    var grandTotal = round2(sub + delivery);

    return {
      subtotal: sub,
      // Kept at zero so every consumer of this shape keeps working.
      estimatedTax: 0,
      taxLabel: "Sales tax",
      delivery: delivery,
      deliveryLabel: "Shipping (flat rate)",
      grandTotal: grandTotal,
      incompleteShipping: false,
    };
  }

  var US_STATES = [
    ["AL", "Alabama"],
    ["AK", "Alaska"],
    ["AZ", "Arizona"],
    ["AR", "Arkansas"],
    ["CA", "California"],
    ["CO", "Colorado"],
    ["CT", "Connecticut"],
    ["DE", "Delaware"],
    ["DC", "District of Columbia"],
    ["FL", "Florida"],
    ["GA", "Georgia"],
    ["HI", "Hawaii"],
    ["ID", "Idaho"],
    ["IL", "Illinois"],
    ["IN", "Indiana"],
    ["IA", "Iowa"],
    ["KS", "Kansas"],
    ["KY", "Kentucky"],
    ["LA", "Louisiana"],
    ["ME", "Maine"],
    ["MD", "Maryland"],
    ["MA", "Massachusetts"],
    ["MI", "Michigan"],
    ["MN", "Minnesota"],
    ["MS", "Mississippi"],
    ["MO", "Missouri"],
    ["MT", "Montana"],
    ["NE", "Nebraska"],
    ["NV", "Nevada"],
    ["NH", "New Hampshire"],
    ["NJ", "New Jersey"],
    ["NM", "New Mexico"],
    ["NY", "New York"],
    ["NC", "North Carolina"],
    ["ND", "North Dakota"],
    ["OH", "Ohio"],
    ["OK", "Oklahoma"],
    ["OR", "Oregon"],
    ["PA", "Pennsylvania"],
    ["RI", "Rhode Island"],
    ["SC", "South Carolina"],
    ["SD", "South Dakota"],
    ["TN", "Tennessee"],
    ["TX", "Texas"],
    ["UT", "Utah"],
    ["VT", "Vermont"],
    ["VA", "Virginia"],
    ["WA", "Washington"],
    ["WV", "West Virginia"],
    ["WI", "Wisconsin"],
    ["WY", "Wyoming"],
  ];

  function populateUsStateSelect(selectEl) {
    if (!selectEl || selectEl.options.length > 1) return;
    for (var i = 0; i < US_STATES.length; i++) {
      var o = document.createElement("option");
      o.value = US_STATES[i][0];
      o.textContent = US_STATES[i][1];
      selectEl.appendChild(o);
    }
  }

  global.EyeNoonCheckoutTaxDelivery = {
    parseZip5: parseZip5,
    estimate: estimate,
    populateUsStateSelect: populateUsStateSelect,
  };
})(window);
