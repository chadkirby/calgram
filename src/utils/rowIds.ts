/**
 * Deterministic row ids for copied data (KTD5).
 *
 * A row's id is a UUID built from SHA-256 over a calgram namespace, the owning Jazz 2
 * account id and the entry's source key. Migration and import insert with this fixed id,
 * so re-running either never adds a copy.
 *
 * The construction below is a stored-data format: changing it would give every existing
 * row a new id. It matches the one verified in `spikes/jazz2/tests/classic-read.mjs`.
 */

const ROW_ID_NAMESPACE = "calgram/rows/v1";

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The row id for `sourceKey` in `accountId`'s data. Same inputs, same UUID; a different
 * account gives a different UUID. Version bits are 5 (name-based) and the variant is RFC 4122.
 */
export async function rowId(accountId: string, sourceKey: string): Promise<string> {
  const bytes = (await sha256(`${ROW_ID_NAMESPACE}|${accountId}|${sourceKey}`)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Source key for an imported entry that carries no source id: a hash of the entry's
 * canonical content plus its occurrence index among identical entries in the same file.
 * The `content:` prefix keeps it from ever equalling a Classic CoValue id.
 */
export async function contentSourceKey(
  canonicalContent: string,
  occurrence: number,
): Promise<string> {
  return `content:${toHex(await sha256(canonicalContent))}:${occurrence}`;
}
