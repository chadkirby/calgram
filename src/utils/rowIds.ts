/**
 * Deterministic row ids for copied data.
 *
 * A row's id is a UUID built from SHA-256 over a calgram namespace, the owning Jazz 2
 * account id and the entry's source id. Migration and import insert with this fixed id,
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
 * The row id for `sourceId` in `accountId`'s data. Same inputs, same UUID; a different
 * account gives a different UUID. Version bits are 5 (name-based) and the variant is RFC 4122.
 */
export async function rowId(accountId: string, sourceId: string): Promise<string> {
  const bytes = (await sha256(`${ROW_ID_NAMESPACE}|${accountId}|${sourceId}`)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
