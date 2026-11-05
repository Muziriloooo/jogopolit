/** Existing identifiers are opaque keys. Never trim, rename or partially match them. */
export function orderIdentifier(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (
    typeof value === 'string' &&
    value.length <= 512 &&
    value.trim().length > 0 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
    return value;
  throw new Error(
    'Este atendimento está sem uma identificação legível. Atualize a lista e tente novamente.',
  );
}
export function deletionIdentifiers(values) {
  if (!Array.isArray(values))
    throw new Error(
      'Não foi possível ler a lista de atendimentos para exclusão. Atualize a página e tente novamente.',
    );
  if (values.length > 10000) throw new Error('Exclua no máximo 10.000 rascunhos de cada vez.');
  return [...new Set(values.map(orderIdentifier))];
}
