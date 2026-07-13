export function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function monthString() {
  return new Date().toISOString().slice(0, 7);
}
