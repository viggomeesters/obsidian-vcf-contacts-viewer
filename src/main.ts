import {
  Notice,
  Plugin,
  TFile,
  TextFileView,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import { NormalizedContact, ParsedVcf, WarningItem, parseVcf } from "./parser";

const VIEW_TYPE_VCF_CONTACTS_VIEWER = "vcf-contacts-viewer";
const VCF_EXTENSIONS = ["vcf"];

type ViewMode = "cards" | "source";

export default class VcfContactsViewerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_VCF_CONTACTS_VIEWER,
      (leaf) => new VcfContactsViewerView(leaf),
    );
    this.registerExtensions(VCF_EXTENSIONS, VIEW_TYPE_VCF_CONTACTS_VIEWER);

    this.addCommand({
      id: "open-current-vcf-in-viewer",
      name: "Open current VCF file in viewer",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isVcfFile(file)) return false;

        if (!checking) {
          void this.openVcfFile(file);
        }
        return true;
      },
    });
  }

  async openVcfFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: VIEW_TYPE_VCF_CONTACTS_VIEWER,
      state: { file: file.path },
      active: true,
    });
  }
}

class VcfContactsViewerView extends TextFileView {
  private mode: ViewMode = "cards";
  private filterValue = "";
  private selectedIndex = 0;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_VCF_CONTACTS_VIEWER;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "VCF contacts viewer";
  }

  getIcon(): string {
    return "contact";
  }

  setViewData(data: string): void {
    this.data = data;
    this.render();
  }

  getViewData(): string {
    return this.data;
  }

  clear(): void {
    this.data = "";
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("vcf-contacts-viewer");

    const header = container.createDiv({ cls: "vcf-contacts-viewer__header" });
    this.renderTitle(header);
    this.renderToolbar(header);

    if (!this.file) {
      renderMessage(container, "No VCF file is attached to this viewer.");
      return;
    }

    if (!isVcfFile(this.file)) {
      renderMessage(container, "This viewer only supports .vcf files.");
      return;
    }

    const parsed = parseVcf(this.data);
    this.selectedIndex = clampSelectedIndex(this.selectedIndex, parsed.contacts.length);
    renderSummary(container, parsed);
    renderWarnings(container, parsed.warnings);

    if (!this.data.trim()) {
      renderMessage(container, "This file is empty.");
      return;
    }

    if (this.mode === "source") {
      renderSource(container, this.data);
      return;
    }

    renderContacts(container, parsed, this.filterValue, this.selectedIndex, (index) => {
      this.selectedIndex = index;
      this.render();
    });
  }

  private renderTitle(parent: HTMLElement): void {
    const title = parent.createDiv({ cls: "vcf-contacts-viewer__title" });
    title.createDiv({
      cls: "vcf-contacts-viewer__filename",
      text: this.file?.name ?? "VCF file",
    });
    title.createDiv({
      cls: "vcf-contacts-viewer__path",
      text: this.file?.path ?? "",
    });
  }

  private renderToolbar(parent: HTMLElement): void {
    const toolbar = parent.createDiv({ cls: "vcf-contacts-viewer__toolbar" });

    const searchWrap = toolbar.createDiv({ cls: "vcf-contacts-viewer__search" });
    setIcon(searchWrap.createSpan({ cls: "vcf-contacts-viewer__search-icon" }), "search");
    const searchInput = searchWrap.createEl("input", {
      attr: {
        "aria-label": "Search contacts",
        placeholder: "Search contacts",
        spellcheck: "false",
        type: "search",
        value: this.filterValue,
      },
    });
    searchInput.addEventListener("input", () => {
      this.filterValue = searchInput.value;
      this.selectedIndex = 0;
      this.render();
    });

    const modeGroup = toolbar.createDiv({
      cls: "vcf-contacts-viewer__segmented",
      attr: { "aria-label": "View mode" },
    });
    const cardsButton = createTextButton(modeGroup, "Cards");
    const sourceButton = createTextButton(modeGroup, "Source");
    cardsButton.toggleClass("is-active", this.mode === "cards");
    sourceButton.toggleClass("is-active", this.mode === "source");

    cardsButton.addEventListener("click", () => {
      this.mode = "cards";
      this.render();
    });
    sourceButton.addEventListener("click", () => {
      this.mode = "source";
      this.render();
    });

    const refreshButton = createIconButton(toolbar, "refresh-cw", "Refresh file");
    refreshButton.addEventListener("click", () => {
      void this.reloadFile();
    });
  }

  private async reloadFile(): Promise<void> {
    if (!this.file) {
      new Notice("No VCF file to refresh");
      return;
    }

    try {
      this.data = await this.app.vault.read(this.file);
      this.render();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.addClass("vcf-contacts-viewer");
      renderMessage(this.contentEl, `Unable to read file: ${getErrorMessage(error)}`);
    }
  }
}

function renderSummary(parent: HTMLElement, parsed: ParsedVcf): void {
  const summary = parent.createDiv({ cls: "vcf-contacts-viewer__summary" });
  summary.createSpan({
    cls: "vcf-contacts-viewer__pill",
    text: `${parsed.contacts.length} contacts`,
  });
  summary.createSpan({
    cls: "vcf-contacts-viewer__pill",
    text: `${parsed.rawLines.length} lines`,
  });
  summary.createSpan({
    cls: "vcf-contacts-viewer__pill",
    text: parsed.warnings.length > 0 ? `${parsed.warnings.length} warnings` : "no warnings",
  });
}

function renderWarnings(parent: HTMLElement, warnings: WarningItem[]): void {
  if (warnings.length === 0) return;

  const box = parent.createDiv({ cls: "vcf-contacts-viewer__warnings" });
  box.createDiv({ cls: "vcf-contacts-viewer__warnings-title", text: "Import-preflight warnings" });
  warnings.slice(0, 16).forEach((warning) => {
    const scope = typeof warning.cardIndex === "number" ? `Contact ${warning.cardIndex + 1}: ` : "";
    const line = typeof warning.line === "number" ? ` line ${warning.line}` : "";
    box.createDiv({
      cls: "vcf-contacts-viewer__warning",
      text: `${scope}${warning.label}${line} - ${warning.message}`,
    });
  });
  if (warnings.length > 16) {
    box.createDiv({
      cls: "vcf-contacts-viewer__warning-more",
      text: `${warnings.length - 16} additional warnings hidden`,
    });
  }
}

function renderContacts(
  parent: HTMLElement,
  parsed: ParsedVcf,
  query: string,
  selectedIndex: number,
  onSelect: (index: number) => void,
): void {
  if (parsed.contacts.length === 0) {
    renderMessage(parent, "No complete contacts to display. Use Source to inspect the raw file.");
    return;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const contacts = normalizedQuery
    ? parsed.contacts.filter((contact) => contact.searchText.includes(normalizedQuery))
    : parsed.contacts;

  if (contacts.length === 0) {
    renderMessage(parent, "No contacts match the current search.");
    return;
  }

  const selectedContact = contacts.find((contact) => contact.index === selectedIndex) ?? contacts[0];
  const shell = parent.createDiv({ cls: "vcf-contacts-viewer__shell" });
  const list = shell.createDiv({ cls: "vcf-contacts-viewer__list" });
  const detail = shell.createDiv({ cls: "vcf-contacts-viewer__detail" });

  contacts.forEach((contact) => {
    const item = list.createEl("button", {
      cls: "vcf-contacts-viewer__contact",
      attr: { type: "button" },
    });
    item.toggleClass("is-active", contact.index === selectedContact.index);
    item.addEventListener("click", () => onSelect(contact.index));
    item.createDiv({ cls: "vcf-contacts-viewer__contact-name", text: contact.displayName });
    item.createDiv({
      cls: "vcf-contacts-viewer__contact-meta",
      text: [contact.organization, contact.emails[0]?.value, contact.phones[0]?.value]
        .filter(Boolean)
        .join(" / "),
    });
  });

  renderDetail(detail, selectedContact);
}

function renderDetail(parent: HTMLElement, contact: NormalizedContact): void {
  parent.createDiv({ cls: "vcf-contacts-viewer__detail-name", text: contact.displayName });

  const meta = parent.createDiv({ cls: "vcf-contacts-viewer__detail-meta" });
  if (contact.version) meta.createSpan({ text: `vCard ${contact.version}` });
  meta.createSpan({ text: `lines ${contact.rawStartLine}-${contact.rawEndLine}` });

  renderFieldGroup(parent, "Name", [
    ["Full name", contact.displayName],
    ["Given name", contact.givenName],
    ["Family name", contact.familyName],
    ["Organization", contact.organization],
    ["Title", contact.title],
  ]);

  renderMethods(parent, "Phones", contact.phones);
  renderMethods(parent, "Emails", contact.emails);
  renderAddressGroup(parent, contact.addresses);
  renderListGroup(parent, "URLs", contact.urls);
  renderFieldGroup(parent, "Lifecycle", [
    ["Birthday", contact.birthday],
    ["UID", contact.uid],
    ["REV", contact.rev],
  ]);
  renderListGroup(parent, "Categories", contact.categories);
  renderListGroup(parent, "Notes", contact.notes);
  renderPhotos(parent, contact);
  renderPropertyTable(parent, contact);
}

function renderMethods(parent: HTMLElement, title: string, items: { label: string; value: string }[]): void {
  renderFieldGroup(
    parent,
    title,
    items.map((item) => [item.label, item.value]),
  );
}

function renderAddressGroup(parent: HTMLElement, items: { label: string; value: string }[]): void {
  renderFieldGroup(
    parent,
    "Addresses",
    items.map((item) => [item.label, item.value]),
  );
}

function renderFieldGroup(parent: HTMLElement, title: string, rows: Array<[string, string | undefined]>): void {
  const visibleRows = rows.filter(([, value]) => value);
  if (visibleRows.length === 0) return;

  const section = parent.createDiv({ cls: "vcf-contacts-viewer__section" });
  section.createDiv({ cls: "vcf-contacts-viewer__section-title", text: title });
  const table = section.createEl("table", { cls: "vcf-contacts-viewer__field-table" });
  const body = table.createEl("tbody");
  visibleRows.forEach(([label, value]) => {
    const row = body.createEl("tr");
    row.createEl("th", { text: label });
    row.createEl("td", { text: value ?? "" });
  });
}

function renderListGroup(parent: HTMLElement, title: string, values: string[]): void {
  if (values.length === 0) return;
  const section = parent.createDiv({ cls: "vcf-contacts-viewer__section" });
  section.createDiv({ cls: "vcf-contacts-viewer__section-title", text: title });
  const list = section.createEl("ul", { cls: "vcf-contacts-viewer__value-list" });
  values.forEach((value) => list.createEl("li", { text: value }));
}

function renderPhotos(parent: HTMLElement, contact: NormalizedContact): void {
  if (contact.photos.length === 0) return;
  const section = parent.createDiv({ cls: "vcf-contacts-viewer__section" });
  section.createDiv({ cls: "vcf-contacts-viewer__section-title", text: "Photos" });
  contact.photos.forEach((photo) => {
    section.createDiv({
      cls: "vcf-contacts-viewer__photo-note",
      text: `${photo.label}: ${photo.value}`,
    });
  });
}

function renderPropertyTable(parent: HTMLElement, contact: NormalizedContact): void {
  const section = parent.createDiv({ cls: "vcf-contacts-viewer__section" });
  section.createDiv({ cls: "vcf-contacts-viewer__section-title", text: "Raw fields" });
  const table = section.createEl("table", { cls: "vcf-contacts-viewer__field-table" });
  const body = table.createEl("tbody");

  contact.properties
    .filter((property) => property.name !== "BEGIN" && property.name !== "END")
    .forEach((property) => {
      const row = body.createEl("tr");
      row.createEl("th", { text: property.rawName });
      row.createEl("td", { text: property.name === "PHOTO" ? "[PHOTO metadata hidden]" : property.value });
    });
}

function renderSource(parent: HTMLElement, data: string): void {
  const source = parent.createDiv({ cls: "vcf-contacts-viewer__source" });
  const lines = data.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  lines.forEach((line, index) => {
    const row = source.createDiv({ cls: "vcf-contacts-viewer__source-line" });
    row.createSpan({
      cls: "vcf-contacts-viewer__source-number",
      text: String(index + 1),
    });
    row.createSpan({
      cls: "vcf-contacts-viewer__source-text",
      text: line,
    });
  });
}

function renderMessage(parent: HTMLElement, message: string): void {
  parent.createDiv({ cls: "vcf-contacts-viewer__message", text: message });
}

function createTextButton(parent: HTMLElement, label: string): HTMLButtonElement {
  return parent.createEl("button", {
    text: label,
    attr: { type: "button" },
  });
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "vcf-contacts-viewer__icon-button",
    attr: { "aria-label": label, title: label, type: "button" },
  });
  setIcon(button, icon);
  return button;
}

function clampSelectedIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function isVcfFile(file: TFile | null): file is TFile {
  return file?.extension.toLowerCase() === "vcf";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
