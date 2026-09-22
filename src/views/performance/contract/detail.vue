<template>
  <div class="contract-detail-page" :class="{ embedded }">
    <el-card class="page-card" v-loading="loading">
      <!-- 顶部信息栏 -->
      <div class="detail-header">
        <div class="header-left">
          <el-button v-if="!embedded" icon="ArrowLeft" @click="goBack">返回</el-button>
          <div class="contract-info">
            <span class="info-label">合同号：</span>
            <span class="info-value contract-no">{{ contractNo }}</span>
            <el-tag v-if="contractInfo.bizType" size="small" class="info-tag">{{ contractInfo.bizType }}</el-tag>
          </div>
        </div>
        <div class="header-right">
          <span class="info-item">期间：<b>{{ period }}</b></span>
          <span class="info-item">口径：<b>新签业绩（应收）</b></span>
          <span class="info-item">签约/认购时间：<b>{{ formatDateTime(contractInfo.businessDate) }}</b></span>
          <span class="info-item">房源地址：<b>{{ contractInfo.propertyAddress || '—' }}</b></span>
          <!-- 合同级作废/恢复：整张合同业绩一次性操作（不区分人员/角色） -->
          <el-button v-if="canVoid && detailList.length > 0" type="danger" link size="small" @click="handleVoidContract">作废合同业绩</el-button>
        </div>
      </div>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <span class="summary-text">
          涉及 <b>{{ employeeCount }}</b> 人 ·
          <b>{{ detailList.length }}</b> 条明细
        </span>
        <span class="summary-amount">
          <!-- 存在已调整明细时，合计按「原合计 → 调整后合计」展示，与明细列同形式 -->
          <template v-if="hasAdjustRow">
            新签业绩合计：
            <b class="summary-struck">{{ formatAmount(totalOriginalAmount) }}</b>
            <span class="summary-arrow">→</span>
            <b :class="{ 'amount-negative': totalAmount < 0 }">{{ formatAmount(totalAmount) }}</b>
            <span class="summary-sep">|</span>
            折算后：
            <b class="summary-struck">{{ formatAmount(totalOriginalConvertedAmount) }}</b>
            <span class="summary-arrow">→</span>
            <b :class="{ 'amount-negative': totalConvertedAmount < 0 }">{{ formatAmount(totalConvertedAmount) }}</b>
          </template>
          <template v-else>
            新签业绩合计：
            <b :class="{ 'amount-negative': totalAmount < 0 }">{{ formatAmount(totalAmount) }}</b>
            <span class="summary-sep">|</span>
            折算后：
            <b :class="{ 'amount-negative': totalConvertedAmount < 0 }">{{ formatAmount(totalConvertedAmount) }}</b>
          </template>
        </span>
      </div>

      <!-- 明细列表（扁平表格，无展开） -->
      <el-table border class="data-table" :data="detailList">
        <el-table-column label="门店/组别" align="left" min-width="150">
          <template #default="scope">
            <span v-if="scope.row.deptPath" class="dept-wrap" :title="scope.row.deptPath">
              <span class="dept-store">{{ deptStore(scope.row.deptPath) }}</span>
              <span v-if="deptGroup(scope.row.deptPath)" class="dept-group"> · {{ deptGroup(scope.row.deptPath) }}</span>
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="工号" align="center" width="100">
          <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" align="center" min-width="110">
          <template #default="scope">
            <span class="person-name">{{ scope.row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" min-width="100">
          <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
        </el-table-column>
        <!-- 新签业绩：已调整时在原值后追加「→ 调整后业绩」，未调整不展示调整后值 -->
        <el-table-column label="新签业绩" align="right" width="200">
          <template #default="scope">
            <template v-if="isAdjusted(scope.row)">
              <span class="amount-strike">{{ formatAmount(scope.row.originalAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount" :class="{ 'amount-redink': scope.row.amount < 0 }">{{ formatAmount(scope.row.amount) }}</span>
              <el-tag v-if="scope.row.amount < 0" type="danger" size="small" effect="plain" class="redink-tag">红冲</el-tag>
            </template>
            <span v-else class="amount-original">{{ formatAmount(scope.row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="180">
          <template #default="scope">
            <template v-if="isAdjusted(scope.row)">
              <span class="amount-strike">{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-ink">{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
            <span v-else class="amount amount-ink">{{ formatAmount(scope.row.convertedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.factStatus === 'VOIDED'" type="info" size="small">已作废</el-tag>
            <el-tag v-else type="success" size="small">有效</el-tag>
          </template>
        </el-table-column>
        <!-- 操作列：明细级业绩调整（作废/恢复为合同级操作，在页头；已作废行不可调整） -->
        <el-table-column v-if="!isBroker" label="操作" align="center" width="90" fixed="right">
          <template #default="scope">
            <el-button v-if="scope.row.factStatus !== 'VOIDED'" type="primary" link @click="openAdjustDialog(scope.row as PerformanceManageRow)">调整</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无明细数据" />
        </template>
      </el-table>
    </el-card>

    <!-- 业绩调整弹窗（append-to-body：嵌入父级弹窗时避免被裁切） -->
    <el-dialog
      v-model="adjustDialog.visible"
      title="明细业绩调整"
      width="480px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="adjustFormRef"
        :model="adjustForm"
        :rules="adjustRules"
        label-width="90px"
      >
        <el-form-item label="调整范围">
          <el-tag type="info">明细级（单条调整）</el-tag>
        </el-form-item>
        <el-form-item label="员工">
          <span>{{ adjustDialog.employeeName }}</span>
        </el-form-item>
        <el-form-item label="调整类型">
          <el-select v-model="adjustForm.adjustType" style="width: 100%">
            <el-option label="金额调整" value="AMOUNT" />
            <el-option label="业绩冲销" value="VOID" />
            <el-option label="部门划转" value="TRANSFER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'AMOUNT'" label="调整后业绩" prop="targetAmount">
          <el-input-number
            v-model="adjustForm.targetAmount"
            :precision="2"
            :step="100"
            :min="0"
            style="width: 100%"
            placeholder="请输入调整后的目标金额"
          />
          <div class="form-tip">
            当前：¥{{ formatAmount(adjustDialog.amount) }} → 调整后：¥{{ formatAmount(adjustForm.targetAmount ?? 0) }}
          </div>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'TRANSFER'" label="目标部门">
          <el-tree-select
            v-model="adjustForm.targetDeptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="选择目标部门"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input
            v-model="adjustForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入调整原因（审批必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitting" @click="submitAdjust">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageRow } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useUserStore } from '@/store/modules/user';
import { checkPermi } from '@/utils/permission';

const router = useRouter();
const route = useRoute();

// 嵌入模式：由父级弹窗通过 props 传入合同号/期间；独立页面时取路由 query
const props = defineProps<{
  embedded?: boolean;
  contractNo?: string;
  period?: string;
}>();

const userStore = useUserStore();
const isBroker = computed(() => userStore.roles.includes('agent'));
const canVoid = computed(() => checkPermi(['perf:fact:void']));

// ==================== 路由参数 / 嵌入 props ====================
const contractNo = ref(String(props.contractNo || route.query.contractNo || ''));
const period = ref(String(props.period || route.query.period || ''));

// ==================== 数据 ====================
const loading = ref(false);
const detailList = ref<PerformanceManageRow[]>([]);
const deptTreeData = ref<DeptNode[]>([]);

// 合同汇总信息（从明细首行提取）
const contractInfo = computed(() => {
  const first = detailList.value[0];
  return {
    bizType: first?.bizType || '',
    businessDate: first?.businessDate || '',
    propertyAddress: first?.propertyAddress || '',
  };
});

// 统计（仅 ACTIVE 行，已作废不计入合计）
const activeList = computed(() => detailList.value.filter(r => r.factStatus !== 'VOIDED'));
const employeeCount = computed(() => new Set(activeList.value.map(r => r.employeeId)).size);
const totalAmount = computed(() => activeList.value.reduce((sum, r) => sum + num(r.amount), 0));
const totalOriginalAmount = computed(() => activeList.value.reduce((sum, r) => sum + num(r.originalAmount), 0));
const totalConvertedAmount = computed(() => activeList.value.reduce((sum, r) => sum + num(r.convertedAmount), 0));
const totalOriginalConvertedAmount = computed(() => activeList.value.reduce((sum, r) => sum + num(r.originalConvertedAmount), 0));
// 存在已调整的行时，合计与明细列均按「原值 → 调整后」展示；未调整时不展示调整后值
const hasAdjustRow = computed(() => activeList.value.some(r => r.originalAmount != null && num(r.amount) !== num(r.originalAmount)));

// ==================== 工具 ====================
const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * 是否已调整：originalAmount 为 null 表示从未被调整，不算已调整；
 * originalAmount 非空且与 amount 不等时才算已调整。
 */
const isAdjusted = (row: { amount?: number | string | null; originalAmount?: number | string | null }): boolean =>
  row.originalAmount != null && num(row.amount) !== num(row.originalAmount);

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toFixed(2);
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// ==================== 门店/组别 拆分展示 ====================
// deptPath 形如「集团-门店-组别」（2~3 段）：门店取倒数第二段（无上级时取首段），组别取最后一段
const deptParts = (path: string): string[] => path.split('-').map((s) => s.trim()).filter(Boolean);
const deptStore = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '—');
};
const deptGroup = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
};

// ==================== 返回 ====================
const goBack = () => {
  router.back();
};

// ==================== 加载明细 ====================
const loadDetails = async () => {
  if (!contractNo.value || !period.value) {
    ElMessage.warning('参数缺失：合同号或期间');
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManageContractDetails({
      period: period.value,
      factType: 'PERF_EXPECT',
      contractNos: contractNo.value,
    });
    detailList.value = res.data ?? [];
  } catch (e) {
    console.error('[contract-detail] 明细加载失败', e);
  } finally {
    loading.value = false;
  }
};

// ==================== 合同级作废（整张合同业绩一次性作废，不区分人员/角色；恢复从主列表操作） ====================
const handleVoidContract = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      `将作废合同「${contractNo.value}」本期全部有效明细（共 ${detailList.value.length} 条，不区分人员/角色），作废后不参与算薪/结佣。`,
      '作废合同业绩',
      {
        confirmButtonText: '确定作废',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '必填，如：录入错误、重复录入等',
        inputValidator: (v) => !!v?.trim() || '请输入作废原因',
      },
    );
    await performanceApi.voidByContract(period.value, 'PERF_EXPECT', contractNo.value, value.trim());
    ElMessage.success('已作废');
    await loadDetails();
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e?.message || '作废失败');
    }
  }
};

const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[contract-detail] 部门树加载失败', e);
  }
};

// ==================== 业绩调整弹窗 ====================
const adjustFormRef = ref();
const adjustSubmitting = ref(false);
const adjustDialog = reactive({
  visible: false,
  factId: '',
  employeeId: '',
  employeeName: '',
  amount: 0,
});
const adjustForm = reactive({
  adjustType: 'AMOUNT',
  targetAmount: undefined as number | undefined,
  targetDeptId: undefined as string | undefined,
  reason: '',
});
const adjustRules = {
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  targetAmount: [
    {
      validator: (_rule: unknown, value: number | undefined, callback: (err?: Error) => void) => {
        if (adjustForm.adjustType === 'AMOUNT' && (value === undefined || value === null)) {
          callback(new Error('请输入调整后业绩'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  targetDeptId: [
    {
      validator: (_rule: unknown, value: string | undefined, callback: (err?: Error) => void) => {
        if (adjustForm.adjustType === 'TRANSFER' && !value) {
          callback(new Error('请选择目标部门'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
};

const openAdjustDialog = (row: PerformanceManageRow) => {
  adjustDialog.factId = String(row.id);
  adjustDialog.employeeId = String(row.employeeId);
  adjustDialog.employeeName = row.employeeName || '—';
  adjustDialog.amount = row.amount ?? 0;
  adjustForm.adjustType = 'AMOUNT';
  adjustForm.targetAmount = undefined;
  adjustForm.targetDeptId = undefined;
  adjustForm.reason = '';
  adjustDialog.visible = true;
};

const submitAdjust = async () => {
  await adjustFormRef.value?.validate();
  adjustSubmitting.value = true;
  try {
    await performanceApi.createAdjust({
      factId: adjustDialog.factId,
      period: period.value,
      employeeId: adjustDialog.employeeId,
      adjustType: adjustForm.adjustType,
      adjustScope: 'DETAIL',
      factType: 'PERF_EXPECT',
      targetAmount: adjustForm.targetAmount,
      targetDeptId: adjustForm.targetDeptId,
      reason: adjustForm.reason.trim(),
    } as any);
    ElMessage.success('调整单已提交审批');
    adjustDialog.visible = false;
    loadDetails();
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    adjustSubmitting.value = false;
  }
};

onMounted(async () => {
  await Promise.all([loadDeptTree(), loadDetails()]);
});
</script>

<style lang="scss" scoped>
.contract-detail-page {
  padding: 16px;
}

.contract-detail-page.embedded {
  padding: 0;
}

.page-card {
  border-radius: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
  flex-wrap: wrap;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .contract-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .info-label {
    font-size: 13px;
    color: #909399;
  }

  .info-value {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .contract-no {
    color: #409eff;
  }

  .info-tag {
    margin-left: 4px;
  }

  .info-item {
    font-size: 13px;
    color: #606266;

    b {
      color: #303133;
      font-weight: 600;
    }
  }
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  flex-wrap: wrap;

  .summary-text {
    font-size: 13px;
    color: #606266;

    b {
      color: #303133;
      margin: 0 2px;
    }

    .unsettled {
      color: #e6a23c;
    }
  }

  .summary-amount {
    font-size: 14px;
    color: #606266;

    b {
      color: #f56c6c;
      font-size: 16px;
      margin-left: 4px;
    }

    .amount-negative {
      color: #67c23a;
    }

    /* 被调整掉的原合计：置灰 + 删除线，与明细列「原值 → 调整后」同形式 */
    b.summary-struck {
      color: #c0c4cc;
      font-size: 14px;
      text-decoration: line-through;
    }
    .summary-arrow {
      color: #c0c4cc;
      margin: 0 4px;
    }
  }
  .summary-sep {
    color: #dcdfe6;
    margin: 0 8px;
  }
}

.data-table {
  width: 100%;

  .person-name {
    font-weight: 600;
    color: #303133;
  }

  .dept-wrap {
    line-height: 1.5;
    word-break: break-word;
  }

  .dept-store {
    font-weight: 600;
    color: #303133;
  }

  .dept-group {
    color: #909399;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #909399;
  }
  .amount-ink {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    color: #303133;
  }
  .amount-original {
    font-variant-numeric: tabular-nums;
    color: #c0c4cc;
    font-size: 13px;
  }
  /* 「原值 → 调整后」：被调整掉的原值置灰加删除线（同实收详情「应收合计」） */
  .amount-strike {
    color: #c0c4cc;
    font-size: 13px;
    text-decoration: line-through;
    font-variant-numeric: tabular-nums;
  }
  .amount-arrow {
    margin: 0 4px;
    color: #c0c4cc;
  }
  .amount-redink {
    color: #f56c6c;
  }
  .redink-tag {
    margin-left: 0;
    transform: scale(0.85);
    transform-origin: right center;
  }
  .adjust-tag {
    transform: scale(0.85);
    transform-origin: right center;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
