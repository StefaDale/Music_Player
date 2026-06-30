const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "www");
const files = ["index.html", "styles.css", "app.js", "config.js"];
const assetFiles = ["open-music-icon.svg"];

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(path.join(webDir, "assets"), { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(rootDir, file), path.join(webDir, file));
}

for (const file of assetFiles) {
  fs.copyFileSync(path.join(rootDir, "assets", file), path.join(webDir, "assets", file));
}

console.log(`Prepared Capacitor web assets in ${webDir}`);
