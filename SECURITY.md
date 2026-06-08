# Security Policy

## Supported versions

Only the latest release is actively supported.

## Reporting a vulnerability

Please report security issues privately by emailing the maintainer or opening a minimal GitHub security advisory if available.

Do not include real contact files in public issues. Reduce any reproduction to a synthetic `.vcf` fixture with fake names, addresses, phone numbers, and email addresses.

## Security posture

VCF Contacts Viewer is read-only. It reads `.vcf` files through the vault API and renders local DOM views. It does not send vault content to external services, does not use runtime network APIs, does not use the system clipboard, and does not write `.vcf` files back to disk.

The plugin never renders remote `PHOTO` URLs and never imports embedded PHOTO data. PHOTO fields are shown as metadata and warnings only.

The plugin does not create contact notes, does not export contacts, and does not launch click-to-call, mailto, FaceTime, Contacts.app, or other external app actions.
