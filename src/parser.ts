export interface WarningItem {
  cardIndex?: number;
  label: string;
  line?: number;
  message: string;
}

export interface VCardProperty {
  group?: string;
  name: string;
  params: Record<string, string[]>;
  rawName: string;
  rawValue: string;
  value: string;
  line: number;
}

export interface ContactMethod {
  label: string;
  value: string;
}

export interface AddressItem {
  label: string;
  value: string;
}

export interface NormalizedContact {
  index: number;
  displayName: string;
  version?: string;
  familyName?: string;
  givenName?: string;
  organization?: string;
  title?: string;
  phones: ContactMethod[];
  emails: ContactMethod[];
  addresses: AddressItem[];
  urls: string[];
  birthday?: string;
  uid?: string;
  rev?: string;
  categories: string[];
  notes: string[];
  photos: PhotoInfo[];
  properties: VCardProperty[];
  unsupported: VCardProperty[];
  raw: string;
  rawStartLine: number;
  rawEndLine: number;
  searchText: string;
}

export interface PhotoInfo {
  kind: "remote" | "embedded" | "metadata";
  label: string;
  value: string;
}

export interface ParsedVcf {
  contacts: NormalizedContact[];
  warnings: WarningItem[];
  rawLines: string[];
}

const SUPPORTED_FIELDS = new Set([
  "ADR",
  "BDAY",
  "BEGIN",
  "CATEGORIES",
  "EMAIL",
  "END",
  "FN",
  "N",
  "NOTE",
  "ORG",
  "PHOTO",
  "PRODID",
  "REV",
  "SORT-STRING",
  "TEL",
  "TITLE",
  "UID",
  "URL",
  "VERSION",
]);

export function parseVcf(data: string): ParsedVcf {
  const rawLines = splitRawLines(data);
  const warnings: WarningItem[] = [];
  const unfolded = unfoldLines(rawLines, warnings);
  const blocks = collectBlocks(unfolded, warnings, data);
  const contacts = blocks.map((block, index) => normalizeContact(block, index, warnings));

  if (data.trim() && contacts.length === 0) {
    warnings.push({
      label: "No contacts",
      message: "No complete BEGIN:VCARD / END:VCARD blocks were found.",
    });
  }

  return { contacts, warnings, rawLines };
}

interface UnfoldedLine {
  text: string;
  startLine: number;
  endLine: number;
}

interface CardBlock {
  lines: UnfoldedLine[];
  raw: string;
  rawStartLine: number;
  rawEndLine: number;
}

function splitRawLines(data: string): string[] {
  if (!data) return [];
  return data.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function unfoldLines(rawLines: string[], warnings: WarningItem[]): UnfoldedLine[] {
  const unfolded: UnfoldedLine[] = [];

  rawLines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^[ \t]/.test(line)) {
      const previous = unfolded[unfolded.length - 1];
      if (!previous) {
        warnings.push({
          label: "Malformed folded line",
          line: lineNumber,
          message: "The file starts with a folded continuation line.",
        });
        unfolded.push({
          text: line.trimStart(),
          startLine: lineNumber,
          endLine: lineNumber,
        });
        return;
      }
      previous.text += line.slice(1);
      previous.endLine = lineNumber;
      return;
    }

    unfolded.push({
      text: line,
      startLine: lineNumber,
      endLine: lineNumber,
    });
  });

  return unfolded;
}

function collectBlocks(
  lines: UnfoldedLine[],
  warnings: WarningItem[],
  originalData: string,
): CardBlock[] {
  const blocks: CardBlock[] = [];
  let current: UnfoldedLine[] = [];
  let inCard = false;

  lines.forEach((line) => {
    const parsed = parseProperty(line);
    const name = parsed?.name.toUpperCase();
    const value = parsed?.value.toUpperCase();

    if (name === "BEGIN" && value === "VCARD") {
      if (inCard) {
        warnings.push({
          label: "Nested card",
          line: line.startLine,
          message: "A BEGIN:VCARD appeared before the previous card ended.",
        });
      }
      current = [line];
      inCard = true;
      return;
    }

    if (!inCard) {
      if (line.text.trim()) {
        warnings.push({
          label: "Orphan property",
          line: line.startLine,
          message: "Content outside a VCARD block was ignored.",
        });
      }
      return;
    }

    current.push(line);

    if (name === "END" && value === "VCARD") {
      blocks.push(toBlock(current, originalData));
      current = [];
      inCard = false;
    }
  });

  if (inCard && current.length > 0) {
    warnings.push({
      label: "Malformed card",
      line: current[0].startLine,
      message: "A VCARD block is missing END:VCARD and was ignored.",
    });
  }

  return blocks;
}

function toBlock(lines: UnfoldedLine[], originalData: string): CardBlock {
  const rawStartLine = lines[0]?.startLine ?? 1;
  const rawEndLine = lines[lines.length - 1]?.endLine ?? rawStartLine;
  const raw = sliceRawLines(originalData, rawStartLine, rawEndLine);
  return { lines, raw, rawStartLine, rawEndLine };
}

function sliceRawLines(data: string, startLine: number, endLine: number): string {
  const lines = splitRawLines(data);
  return lines.slice(startLine - 1, endLine).join("\n");
}

function normalizeContact(
  block: CardBlock,
  index: number,
  warnings: WarningItem[],
): NormalizedContact {
  const properties: VCardProperty[] = [];

  block.lines.forEach((line) => {
    const parsed = parseProperty(line);
    if (!parsed) {
      warnings.push({
        cardIndex: index,
        label: "Malformed property",
        line: line.startLine,
        message: "A vCard property has no ':' separator.",
      });
      return;
    }
    properties.push(parsed);
  });

  const versionFields = valuesFor(properties, "VERSION");
  const version = versionFields[0];
  if (!version) {
    warnings.push({
      cardIndex: index,
      label: "Version mismatch",
      message: `Contact ${index + 1} has no VERSION field.`,
    });
  } else if (version !== "3.0" && version !== "4.0") {
    warnings.push({
      cardIndex: index,
      label: "Version mismatch",
      message: `Contact ${index + 1} declares vCard ${version}; only 3.0 and 4.0 are expected.`,
    });
  }
  if (versionFields.length > 1) {
    warnings.push({
      cardIndex: index,
      label: "Version mismatch",
      message: `Contact ${index + 1} has multiple VERSION fields.`,
    });
  }

  const unsupported = properties.filter((property) => !SUPPORTED_FIELDS.has(property.name));
  unsupported.slice(0, 20).forEach((property) => {
    warnings.push({
      cardIndex: index,
      label: "Unsupported field",
      line: property.line,
      message: `${property.rawName} is preserved in raw fields but not normalized.`,
    });
  });

  properties.forEach((property) => {
    const encoding = firstParam(property, "ENCODING")?.toUpperCase();
    const valueType = firstParam(property, "VALUE")?.toUpperCase();
    if (encoding === "QUOTED-PRINTABLE" || encoding === "BASE64" || encoding === "B" || valueType === "BINARY") {
      warnings.push({
        cardIndex: index,
        label: "Encoded field",
        line: property.line,
        message: `${property.rawName} uses ${encoding ?? valueType}; inspect raw source before importing.`,
      });
    }
  });

  const structuredName = splitStructured(valuesFor(properties, "N")[0] ?? "");
  const fullName = valuesFor(properties, "FN")[0];
  const organization = splitStructured(valuesFor(properties, "ORG")[0] ?? "").filter(Boolean).join(" / ");
  const title = valuesFor(properties, "TITLE")[0];
  const birthday = valuesFor(properties, "BDAY")[0];
  const uid = valuesFor(properties, "UID")[0];
  const rev = valuesFor(properties, "REV")[0];
  const categories = valuesFor(properties, "CATEGORIES").flatMap((value) => splitEscaped(value, ","));
  const notes = valuesFor(properties, "NOTE");
  const urls = valuesFor(properties, "URL");
  const photos = properties.filter((property) => property.name === "PHOTO").map((property) => photoInfo(property, warnings, index));

  const displayName =
    fullName ||
    [structuredName[1], structuredName[0]].filter(Boolean).join(" ").trim() ||
    organization ||
    `Contact ${index + 1}`;

  const phones = properties.filter((property) => property.name === "TEL").map(methodInfo);
  const emails = properties.filter((property) => property.name === "EMAIL").map(methodInfo);
  const addresses = properties.filter((property) => property.name === "ADR").map(addressInfo);
  const searchText = [
    displayName,
    organization,
    title,
    birthday,
    uid,
    rev,
    categories.join(" "),
    notes.join(" "),
    urls.join(" "),
    phones.map((phone) => phone.value).join(" "),
    emails.map((email) => email.value).join(" "),
    addresses.map((address) => address.value).join(" "),
    properties.map((property) => `${property.rawName} ${property.value}`).join(" "),
    block.raw,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    index,
    displayName,
    version,
    familyName: structuredName[0],
    givenName: structuredName[1],
    organization,
    title,
    phones,
    emails,
    addresses,
    urls,
    birthday,
    uid,
    rev,
    categories,
    notes,
    photos,
    properties,
    unsupported,
    raw: block.raw,
    rawStartLine: block.rawStartLine,
    rawEndLine: block.rawEndLine,
    searchText,
  };
}

function parseProperty(line: UnfoldedLine): VCardProperty | undefined {
  const separator = line.text.indexOf(":");
  if (separator < 0) return undefined;

  const left = line.text.slice(0, separator);
  const rawValue = line.text.slice(separator + 1);
  const parts = splitPropertyHead(left);
  const rawName = parts.shift() ?? "";
  const dotIndex = rawName.indexOf(".");
  const group = dotIndex > -1 ? rawName.slice(0, dotIndex) : undefined;
  const name = (dotIndex > -1 ? rawName.slice(dotIndex + 1) : rawName).toUpperCase();
  const params: Record<string, string[]> = {};

  parts.forEach((part) => {
    const equals = part.indexOf("=");
    if (equals < 0) {
      params.TYPE = [...(params.TYPE ?? []), ...splitEscaped(part, ",")];
      return;
    }
    const key = part.slice(0, equals).toUpperCase();
    const values = splitEscaped(part.slice(equals + 1).replace(/^"|"$/g, ""), ",");
    params[key] = [...(params[key] ?? []), ...values];
  });

  return {
    group,
    name,
    params,
    rawName,
    rawValue,
    value: decodeTextValue(rawValue),
    line: line.startLine,
  };
}

function splitPropertyHead(head: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of head) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}

function valuesFor(properties: VCardProperty[], name: string): string[] {
  return properties.filter((property) => property.name === name).map((property) => property.value);
}

function methodInfo(property: VCardProperty): ContactMethod {
  return {
    label: labelFor(property),
    value: property.value,
  };
}

function addressInfo(property: VCardProperty): AddressItem {
  return {
    label: labelFor(property),
    value: splitStructured(property.value).filter(Boolean).join(", "),
  };
}

function labelFor(property: VCardProperty): string {
  const types = property.params.TYPE ?? [];
  if (types.length === 0) return "value";
  return types.map((type) => type.toLowerCase()).join(", ");
}

function photoInfo(property: VCardProperty, warnings: WarningItem[], cardIndex: number): PhotoInfo {
  const valueType = firstParam(property, "VALUE")?.toUpperCase();
  const encoding = firstParam(property, "ENCODING")?.toUpperCase();
  const isRemote = valueType === "URI" || /^https?:\/\//i.test(property.rawValue);
  const isEmbedded = encoding === "B" || encoding === "BASE64" || /^[A-Za-z0-9+/=\s]{80,}$/.test(property.rawValue);

  if (isRemote) {
    warnings.push({
      cardIndex,
      label: "Remote PHOTO blocked",
      line: property.line,
      message: "A remote PHOTO URL is shown as metadata only and is never loaded.",
    });
    return { kind: "remote", label: "Remote PHOTO URL", value: property.rawValue };
  }

  if (isEmbedded) {
    warnings.push({
      cardIndex,
      label: "Embedded PHOTO hidden",
      line: property.line,
      message: "Embedded PHOTO data is not rendered or imported.",
    });
    return { kind: "embedded", label: "Embedded PHOTO data", value: `${property.rawValue.length} characters` };
  }

  warnings.push({
    cardIndex,
    label: "PHOTO metadata",
    line: property.line,
    message: "PHOTO content is shown as metadata only.",
  });
  return { kind: "metadata", label: "PHOTO metadata", value: property.rawValue };
}

function firstParam(property: VCardProperty, key: string): string | undefined {
  return property.params[key.toUpperCase()]?.[0];
}

function decodeTextValue(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function splitStructured(value: string): string[] {
  return splitEscaped(value, ";").map((part) => part.trim());
}

function splitEscaped(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === delimiter) {
      parts.push(decodeTextValue(current).trim());
      current = "";
      continue;
    }
    current += char;
  }

  parts.push(decodeTextValue(current).trim());
  return parts.filter((part) => part.length > 0);
}
