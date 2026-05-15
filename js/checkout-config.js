/* Order API base URL (no trailing slash).
 *
 * Resolves the checkout API endpoint depending on where the site is running:
 *   - localhost / 127.0.0.1  -> local dev API on port 4242
 *   - anything else (live)   -> PRODUCTION_API below
 *
 * >>> AFTER you create the Render API service, set PRODUCTION_API to its URL <<<
 * e.g. "https://eyenoon-api.onrender.com" or "https://api.eyenoon.com"
 */
(function () {
  if (typeof window.EYE_NOON_CHECKOUT_API !== "undefined") return;

  /* EDIT THIS once the Render API service exists: */
  var PRODUCTION_API = "https://eyenoon-api.onrender.com";

  var host = location.hostname;
  var isLocal =
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "" /* file:// */;

  if (isLocal) {
    var apiPort = "4242";
    var onCombinedServer =
      (location.protocol === "http:" || location.protocol === "https:") &&
      String(location.port) === apiPort;
    /* Combined server (`npm start` in /server) serves site + API on 4242;
       otherwise (Live Server :5500, file://) the API is still on 4242. */
    window.EYE_NOON_CHECKOUT_API = onCombinedServer
      ? location.origin.replace(/\/$/, "")
      : "http://127.0.0.1:" + apiPort;
  } else {
    window.EYE_NOON_CHECKOUT_API = PRODUCTION_API.replace(/\/$/, "");
  }
})();
