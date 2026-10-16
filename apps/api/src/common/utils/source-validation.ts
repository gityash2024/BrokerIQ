/** Source transcriptions must never lose an unrecognised field during parsing.
 * Values may be normalised (for example phone numbers); added defaults are safe.
 * Report paths only, never private source values.
 */
export function assertNoDroppedSourceFields(input: unknown, parsed: unknown, path = 'review'): void {
  if (Array.isArray(input)) {
    if (!Array.isArray(parsed) || parsed.length !== input.length) throw new Error(`Source array changed at ${path}`);
    input.forEach((value, index) => assertNoDroppedSourceFields(value, parsed[index], `${path}[${index}]`));
    return;
  }
  if (!input || typeof input !== 'object') return;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Source object changed at ${path}`);
  for (const [key, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) throw new Error(`Unsupported source field at ${path}.${key}`);
    assertNoDroppedSourceFields(value, (parsed as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/** Only an explicitly reviewed, complete repeated page may bypass approval.
 * A shared phone/address is insufficient: every source group must match.
 */
export function assertRepeatedSourcePage(
  groups: { groupNo: number; transcription: string; ready: boolean }[],
  original: { rowNo: number | null; rawText: string }[],
): void {
  if (!groups.length || groups.length !== original.length || groups.some((group) => group.ready))
    throw new Error('Repeated page must contain all original groups and cannot approve inventory');
  if (groups.some((group) => original.find((entry) => entry.rowNo === group.groupNo)?.rawText !== group.transcription))
    throw new Error('Repeated page does not match the reviewed original source groups');
}
