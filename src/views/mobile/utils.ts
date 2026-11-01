/** 移动端公共小工具 */

/** 当前月份，格式 YYYY-MM */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 角色占比展示：小数转百分比，空值显示 — */
export function formatRatio(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const pct = num * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** 金额展示：千分位 + 两位小数，空值显示 — */
export function formatMoney(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
