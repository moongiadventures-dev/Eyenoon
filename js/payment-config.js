/**
 * Shop payment destinations (edit for production).
 *
 * Checkout builds links after the order is saved:
 *   PayPal: https://www.paypal.com/paypalme/<paypalMe>/<orderTotal>
 * Credit / debit card: phone or in store (see checkout payment panel).
 */
(function () {
  if (typeof window.EYE_NOON_PAYMENT === "undefined") {
    window.EYE_NOON_PAYMENT = {
      paypalMe: "eyenoonoptical",
    };
  }
})();
