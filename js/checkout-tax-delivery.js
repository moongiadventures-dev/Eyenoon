/**
 * Estimates CA sales tax and US shipping from address (configurable).
 */
(function (global) {
  var CA_COMBINED_SALES_TAX = 0.095;
  var SHIPPING_CA_NON_LOCAL = 8.99;
  var SHIPPING_US_NON_CA = 12.99;

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function parseZip5(z) {
    var s = String(z || "").replace(/\D/g, "");
    if (s.length >= 5) return s.slice(0, 5);
    return "";
  }

  function isCaliforniaZip5(zip5) {
    if (!zip5 || zip5.length !== 5) return false;
    var n = parseInt(zip5, 10);
    return n >= 90001 && n <= 96162;
  }

  /** SoCal — free delivery zone (edit to match your policy). */
  function isLocalDeliveryZip(zip5) {
    if (!zip5 || zip5.length !== 5) return false;
    var n = parseInt(zip5, 10);
    return n >= 90001 && n <= 91799;
  }

  /**
   * @param {number} subtotal
   * @param {string} state — 2-letter US state
   * @param {string} zipRaw
   */
  function estimate(subtotal, state, zipRaw) {
    var sub = round2(subtotal);
    var st = String(state || "")
      .trim()
      .toUpperCase();
    var zip5 = parseZip5(zipRaw);
    var hasState = st.length === 2;
    var hasZip = zip5.length === 5;
    var addressComplete = hasState && hasZip;

    var estimatedTax = 0;
    var taxLabel = "Est. sales tax";
    if (st === "CA") {
      estimatedTax = round2(sub * CA_COMBINED_SALES_TAX);
      taxLabel = "Est. sales tax (CA " + (CA_COMBINED_SALES_TAX * 100).toFixed(1) + "%)";
    } else if (hasState) {
      taxLabel = "Sales tax (if applicable)";
    }

    var delivery = 0;
    var deliveryLabel = "Delivery / shipping";
    if (addressComplete) {
      if (st === "CA") {
        if (isCaliforniaZip5(zip5) && isLocalDeliveryZip(zip5)) {
          delivery = 0;
          deliveryLabel = "Delivery (local)";
        } else {
          delivery = SHIPPING_CA_NON_LOCAL;
          deliveryLabel = "Shipping (CA)";
        }
      } else {
        delivery = SHIPPING_US_NON_CA;
        deliveryLabel = "Shipping (US)";
      }
    }

    var grandTotal = round2(sub + estimatedTax + delivery);

    return {
      subtotal: sub,
      estimatedTax: estimatedTax,
      taxLabel: taxLabel,
      delivery: delivery,
      deliveryLabel: deliveryLabel,
      grandTotal: grandTotal,
      incompleteShipping: !addressComplete,
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
