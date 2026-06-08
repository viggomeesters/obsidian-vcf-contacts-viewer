# Obsidian Community Submission Checklist

Current release target: `0.1.0`

## Repository

- [x] `README.md` describes what the plugin does and how to use it.
- [x] `LICENSE` exists.
- [x] `manifest.json` exists at repository root.
- [x] `manifest.json.id` is `vcf-contacts-viewer`.
- [x] `manifest.json.id` is lowercase/hyphen only, does not contain `obsidian`, and does not end with `plugin`.
- [x] `manifest.json.name` is short, descriptive, Basic Latin, and does not contain `Obsidian`.
- [x] `manifest.json.version` uses `x.y.z`.
- [x] `versions.json` maps plugin version to minimum app version.
- [x] Privacy posture is documented.
- [x] Read-only non-goals are documented.

## Release

- [x] Public GitHub repository exists.
- [x] `npm run build` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm test` passes.
- [x] GitHub release tag equals `manifest.json.version`.
- [x] Release assets include `main.js`.
- [x] Release assets include `manifest.json`.
- [x] Release assets include `styles.css`.

## Artifact attestations

The repository contains `.github/workflows/release.yml` with `actions/attest-build-provenance@v3`. Release `0.1.0` was created manually with the required loose assets. Manual releases are installable by Obsidian; automated Community review may still show a recommendation about missing artifact attestations until GitHub Actions is enabled and a workflow-built release is published.

## Directory Submission

- [ ] Sign in to https://community.obsidian.md.
- [ ] Link the GitHub account that owns the repository.
- [ ] Open **Plugins -> New plugin**.
- [ ] Submit `https://github.com/viggomeesters/obsidian-vcf-contacts-viewer`.
- [ ] Confirm developer policies and support commitment.
- [ ] Address automated review feedback.

These final steps require the repository owner's account.

Official references:

- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://docs.obsidian.md/Reference/Manifest
- https://github.com/obsidianmd/obsidian-releases
