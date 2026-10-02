import { ref, computed } from 'vue';
import { payrollApi, type PayrollBatch } from '@/api/panjia/payroll';

/**
 * 冻结奖金/收支增删的批次状态（与后端 ManualItemService.FROZEN_BATCH_STATUS 保持一致）。
 * 财务规则：提交审批即定稿——审批中及以后状态一律冻结，驳回退回已计算后自动解冻。
 */
const FROZEN_STATUS = ['CALCULATING', 'REVIEWING', 'APPROVED', 'LOCKED', 'PAID'];

const FREEZE_TIP_MAP: Record<string, string> = {
  CALCULATING: '该期间工资正在计算中，请稍后再操作',
  REVIEWING: '该期间工资批次审批中，奖金与收支已冻结；如需调整请待审批驳回后修改并重算工资',
  APPROVED: '该期间工资已审核通过，奖金与收支已冻结；如需调整请驳回审批后修改并重算工资',
  LOCKED: '该期间工资已锁定封账，奖金与收支已冻结；如需纠错请先在「结佣明细」页解封该期间',
  PAID: '该期间工资已发放，奖金与收支不允许新增或删除',
};

/**
 * 按归属期间查询工资批次冻结状态，供奖金录入/其他收支录入页统一使用。
 * 前端仅作按钮联动与提示，最终以后端校验为准（后端还含期间封账兜底）。
 */
export const useManualItemFreeze = () => {
  const frozenBatch = ref<PayrollBatch | null>(null);

  const frozen = computed(() => frozenBatch.value !== null);
  const freezeTip = computed(() =>
    frozenBatch.value ? FREEZE_TIP_MAP[frozenBatch.value.status] || '该期间工资批次已冻结，不允许新增或删除' : '',
  );

  /** 加载指定期间的批次冻结状态；期间为空时视为不冻结 */
  const refreshFreeze = async (period?: string) => {
    if (!period) {
      frozenBatch.value = null;
      return;
    }
    try {
      const res = await payrollApi.listBatches(period);
      const list = ((res as any).data ?? []) as PayrollBatch[];
      frozenBatch.value = list.find((b) => FROZEN_STATUS.includes(b.status)) ?? null;
    } catch {
      // 查询失败不阻断页面，冻结保护以后端为准
      frozenBatch.value = null;
    }
  };

  return { frozen, freezeTip, frozenBatch, refreshFreeze };
};
