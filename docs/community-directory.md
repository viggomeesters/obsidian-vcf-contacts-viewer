# Community Directory Notes

## Plugin

- ID: `vcf-contacts-viewer`
- Name: `VCF Contacts Viewer`
- Version: `0.1.0`
- Minimum app version: `1.5.0`
- Repository: `https://github.com/viggomeesters/obsidian-vcf-contacts-viewer`

## Summary

Read-only `.vcf` viewer for contact cards, raw source, search, and import-preflight warnings.

## Review notes

The plugin is intentionally not a contact manager. It does not create markdown contact notes, export contacts, sync contacts, launch contact-related external apps, load remote images, use clipboard APIs, or write `.vcf` files back to disk.

## Obsidian upload compliance

- Root `README.md`, `LICENSE`, and `manifest.json` exist.
- `manifest.json.id` is `vcf-contacts-viewer`, unique-check ready, lowercase/hyphen only, does not contain `obsidian`, and does not end with `plugin`.
- `manifest.json.name` is `VCF Contacts Viewer`, Basic Latin, and does not contain `Obsidian`.
- `manifest.json.version` is `0.1.0`.
- GitHub release tag `0.1.0` matches `manifest.json.version`.
- Release `0.1.0` has loose `main.js`, `manifest.json`, and `styles.css` assets.
- `versions.json` maps `0.1.0` to minimum Obsidian version `1.5.0`.
