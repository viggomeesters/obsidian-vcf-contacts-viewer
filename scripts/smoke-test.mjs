import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const main = fs.readFileSync("src/main.ts", "utf8");
const parser = fs.readFileSync("src/parser.ts", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const forbiddenSourcePatterns = [
  "navigator.clipboard",
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "child_process",
  "spawn(",
  "exec(",
  "eval(",
  "new Function",
];

const assertions = [
  [manifest.id === "vcf-contacts-viewer", "manifest id is vcf-contacts-viewer"],
  [manifest.name === "VCF Contacts Viewer", "manifest display name is VCF Contacts Viewer"],
  [manifest.version === "0.1.0", "manifest version is 0.1.0"],
  [!/obsidian/i.test(manifest.description), "manifest description avoids product name"],
  [main.includes("registerExtensions(VCF_EXTENSIONS"), "vcf extension is registered"],
  [main.includes("type ViewMode = \"cards\" | \"source\""), "cards/source modes exist"],
  [main.includes("renderContacts(container, parsed, this.filterValue"), "contact cards render path exists"],
  [main.includes("renderSource(container, this.data)"), "source view code path exists"],
  [parser.includes("Remote PHOTO blocked"), "remote photo warning exists"],
  [parser.includes("Embedded PHOTO hidden"), "embedded photo warning exists"],
  [parser.includes("Version mismatch"), "version mismatch warning exists"],
  [!styles.includes("!important"), "styles do not use important overrides"],
];

for (const pattern of forbiddenSourcePatterns) {
  assertions.push([
    !main.includes(pattern) && !parser.includes(pattern),
    `source avoids ${pattern}`,
  ]);
}

const failures = assertions.filter(([passes]) => !passes).map(([, label]) => label);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("VCF Contacts Viewer smoke checks passed.");
