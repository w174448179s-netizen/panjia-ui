/**
 * 工作流列表页"业务单元格"复用逻辑。
 *
 * 待办/已办/我发起的三个列表共享同一套展示语义：
 *   1. 按业务类型 tabs 快捷切换（与 flow_definition.flow_code 对应）
 *   2. 第一列展示「业务类型标签 + 业务标题明细 + 单号」
 *   3. 后端 businessTitle 由各业务模块按「类型｜明细…」格式拼装
 *      前端拆成"类型标签 + 明细"两段，避免整行糊在一起
 */

/** 业务类型快捷切换（与 flow_definition.flow_code 一一对应） */
export const FLOW_TYPE_TABS = [
  { label: '全部', code: '' },
  { label: '结佣审批', code: 'commission_apply' },
  { label: '结佣调整', code: 'commission_adjust' },
  { label: '业绩调整', code: 'perf_adjust' },
  { label: '实收审批', code: 'perf_received' },
  { label: '奖金录入', code: 'bonus_apply' },
  { label: '算薪批次', code: 'payroll_batch' },
  { label: '补发单', code: 'payroll_supplement' }
];

/** el-tag type 联合类型 */
type ElTagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

/** 流程类型 -> 标签配色 */
const TAG_TYPE_MAP: Record<string, ElTagType> = {
  commission_apply: 'primary',
  commission_adjust: 'warning',
  perf_adjust: 'warning',
  perf_received: 'success',
  bonus_apply: 'info',
  payroll_batch: 'danger',
  payroll_supplement: 'danger'
};

/** 流程类型 -> 标签配色 */
export const flowTagType = (flowCode: string): ElTagType => TAG_TYPE_MAP[flowCode] || 'info';

/**
 * 业务扩展标题由后端按「类型｜明细…」格式拼装（见 bizExt.buildBizExt），
 * 这里拆成"类型标签 + 明细"，避免整行糊在一起。
 */
export const splitTitle = (row: any): { type: string; detail: string } => {
  const title = row?.businessTitle as string | undefined;
  if (title && title.includes('｜')) {
    const [head, ...rest] = title.split('｜');
    return { type: head.trim(), detail: rest.join(' · ').trim() };
  }
  return { type: '', detail: title ? title.trim() : '' };
};

/** 第一列主标签：业务标题里的类型，缺省回退流程定义名 */
export const bizType = (row: any): string => splitTitle(row).type || row.flowName || '待办';

/** 第一列副文本：业务标题里的明细，缺省时至少让人看到流程名+业务ID，不留空白 */
export const bizDetail = (row: any): string => {
  const { detail } = splitTitle(row);
  if (detail) return detail;
  return `${row.flowName || '业务单据'}（业务ID ${row.businessId}）`;
};

/** 业务单元格公共样式类名（三个页面共享同一套样式） */
export const BIZ_CELL_STYLES = `
.type-tabs { margin-bottom: 12px; }
.biz-cell { display: flex; align-items: flex-start; gap: 8px; padding: 2px 0; }
.biz-tag { flex: 0 0 auto; margin-top: 2px; }
.biz-body { min-width: 0; }
.biz-detail {
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.biz-no {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.2;
}
`;
