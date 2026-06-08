import assert from "node:assert/strict";
import fs from "node:fs";
import esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/parser.ts"],
  format: "esm",
  outfile: ".tmp-parser-test.mjs",
  platform: "node",
  target: "node20",
});

const { parseVcf } = await import(new URL("../.tmp-parser-test.mjs", import.meta.url));

function readFixture(name) {
  return fs.readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url), "utf8");
}

const v3 = parseVcf(readFixture("vcard-3.vcf"));
assert.equal(v3.contacts.length, 1);
assert.equal(v3.contacts[0].displayName, "Jane Doe");
assert.equal(v3.contacts[0].version, "3.0");
assert.equal(v3.contacts[0].organization, "Example Co / Research");
assert.equal(v3.contacts[0].emails[0].value, "jane@example.com");
assert.equal(v3.contacts[0].phones[0].value, "+1555010101");
assert.equal(v3.contacts[0].addresses[0].value.includes("1 Main Street"), true);
assert.equal(v3.contacts[0].categories.includes("research"), true);

const v4 = parseVcf(readFixture("vcard-4.vcf"));
assert.equal(v4.contacts.length, 1);
assert.equal(v4.contacts[0].version, "4.0");
assert.equal(v4.contacts[0].phones[0].value, "tel:+49-30-123456");

const multi = parseVcf(readFixture("multi-contact.vcf"));
assert.equal(multi.contacts.length, 2);
assert.equal(multi.contacts[1].displayName, "Beta Person");
assert.equal(multi.contacts[1].organization, "Beta Org");

const folded = parseVcf(readFixture("folded-lines.vcf"));
assert.equal(folded.contacts[0].notes[0].includes("folded acrosscontinuation"), true);

const encoded = parseVcf(readFixture("encoded-hints.vcf"));
assert.ok(encoded.warnings.some((warning) => warning.label === "Encoded field"));

const remotePhoto = parseVcf(readFixture("photo-url.vcf"));
assert.equal(remotePhoto.contacts[0].photos[0].kind, "remote");
assert.ok(remotePhoto.warnings.some((warning) => warning.label === "Remote PHOTO blocked"));

const embeddedPhoto = parseVcf(readFixture("photo-data.vcf"));
assert.equal(embeddedPhoto.contacts[0].photos[0].kind, "embedded");
assert.ok(embeddedPhoto.warnings.some((warning) => warning.label === "Embedded PHOTO hidden"));

const malformed = parseVcf(readFixture("malformed-card.vcf"));
assert.equal(malformed.contacts.length, 1);
assert.ok(malformed.warnings.some((warning) => warning.label === "Malformed folded line"));
assert.ok(malformed.warnings.some((warning) => warning.label === "Version mismatch"));
assert.ok(malformed.warnings.some((warning) => warning.label === "Unsupported field"));
assert.ok(malformed.warnings.some((warning) => warning.label === "Malformed property"));
assert.ok(malformed.warnings.some((warning) => warning.label === "Malformed card"));

fs.rmSync(new URL("../.tmp-parser-test.mjs", import.meta.url));
console.log("VCF parser fixture tests passed.");
