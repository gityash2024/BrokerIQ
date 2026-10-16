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
