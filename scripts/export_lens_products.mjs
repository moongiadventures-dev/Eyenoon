import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const products = JSON.parse(
  fs.readFileSync(path.join(root, "data", "contact-lenses.json"), "utf8")
);
for (const p of products) {
  if (!p.slug) p.slug = p.img;
}
fs.writeFileSync(path.join(root, "data", "contact-lenses.json"), JSON.stringify(products, null, 2));
fs.writeFileSync(
  path.join(root, "js", "lens-products.js"),
  `window.LENS_PRODUCTS = ${JSON.stringify(products, null, 2)};\n`
);
console.log("synced lens-products.js from data/contact-lenses.json", products.length);
