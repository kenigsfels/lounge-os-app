export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

export function validateEmployeeInput(data) {
  const source = data && typeof data === 'object' ? data : {};
  const errors = [];
  const name = normalizeText(source.name);
  const position = normalizeText(source.position);
  const phone = normalizeText(source.phone);
  const status = source.status === undefined || source.status === null || source.status === ''
    ? undefined
    : normalizeText(source.status).toLowerCase();
  const hasRate = source.rate !== undefined && source.rate !== null && source.rate !== '';
  const rate = hasRate ? Number(source.rate) : undefined;

  if (!isNonEmptyString(name)) errors.push('Имя сотрудника обязательно');
  if (!isNonEmptyString(position)) errors.push('Должность сотрудника обязательна');
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    errors.push('Статус должен быть active или inactive');
  }
  if (hasRate && (!Number.isFinite(rate) || rate < 0)) {
    errors.push('Ставка должна быть числом не меньше 0');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      name,
      position,
      phone,
      status,
      rate,
      startDate: normalizeText(source.startDate),
      notes: normalizeText(source.notes)
    }
  };
}
