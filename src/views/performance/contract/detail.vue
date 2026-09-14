<template>
  <div class="contract-detail-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 顶部信息栏 -->
      <div class="detail-header">
        <div class="header-left">
          <el-button icon="ArrowLeft" @click="goBack">返回</el-button>
          <div class="contract-info">
            <span class="info-label">合同号：</span>
            <span class="info-value contract-no">{{ contractNo }}</span>
            <el-tag v-if="contractInfo.bizType" size="small" class="info-tag">{{ contractInfo.bizType }}</el-tag>
          </div>
        </div>
        <div class="header-right">
          <span class="info-item">期间：<b>{{ period }}</b></span>
          <span class="info-item">口径：<b>新签业绩（应收）</b></span>
          <span class="info-item">签约时间：<b>{{ formatDateTime(contractInfo.businessDate) }}</b></span>
          <span class="info-item">房源地址：<b>{{ contractInfo.propertyAddress || '—' }}</b></span>
        </div>
      </div>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <span class="summary-text">
          涉及 <b>{{ employeeCount }}</b> 人 ·
          <b>{{ detailList.length }}</b> 条明细
        </span>
        <span class="summary-amount">
          应收合计：
          <b :class="{ 'amount-negative': totalAmount < 0 }">{{ formatAmount(totalAmount) }}</b>
        </span>
      </div>

      <!-- 明细列表（扁平表格，无展开） -->
      <el-table border class="data-table" :data="detailList">
        <el-table-column label="门店/组别" align="left" min-width="120" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.deptPath || '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" align="center" width="100">
          <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" align="center" width="120">
          <template #default="scope">
            <span class="person-name">{{ scope.row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" width="110">
          <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
        </el-table-column>
        <el-table-column :label="'应收金额'" align="right" width="120">
          <template #default="scope">
            <span class="amount" :class="{ 'amount-redink': scope.row.amount < 0 }">{{ formatAmount(scope.row.amount) }}</span>
            <el-tag v-if="scope.row.amount < 0" type="danger" size="small" effect="plain" class="redink-tag">红冲</el-tag>
          </template>
        </el-table-column>
        <!-- 操作列：明细级业绩调整（经纪人无权限） -->
        <el-table-column v-if="!isBroker" label="操作" align="center" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="openAdjustDialog(scope.row)">调整</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无明细数据" />
        </template>
      </el-table>
    </el-card>

    <!-- 业绩调整弹窗 -->
    <el-dialog
      v-model="adjustDialog.visible"
      title="明细业绩调整"
      width="480px"
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
        <el-form-item v-if="adjustForm.adjustType === 'AMOUNT'" label="调整金额" prop="deltaAmount">
          <el-input-number
            v-model="adjustForm.deltaAmount"
            :precision="2"
            :step="100"
            style="width: 100%"
            placeholder="正数调增，负数调减"
          />
          <div class="form-tip">正数调增业绩，负数调减业绩</div>
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
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageRow } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useUserStore } from '@/store/modules/user';

const router = useRouter();
const route = useRoute();

const userStore = useUserStore();
const isBroker = computed(() => userStore.roles.includes('agent'));

// ==================== 路由参数 ====================
const contractNo = ref(String(route.query.contractNo || ''));
const period = ref(String(route.query.period || ''));

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

// 统计
const employeeCount = computed(() => new Set(detailList.value.map(r => r.employeeId)).size);
const totalAmount = computed(() => detailList.value.reduce((sum, r) => sum + num(r.amount), 0));

// ==================== 工具 ====================
const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
});
const adjustForm = reactive({
  adjustType: 'AMOUNT',
  deltaAmount: undefined as number | undefined,
  targetDeptId: undefined as string | undefined,
  reason: '',
});
const adjustRules = {
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  deltaAmount: [
    {
      validator: (_rule: unknown, value: number | undefined, callback: (err?: Error) => void) => {
        if (adjustForm.adjustType === 'AMOUNT' && (value === undefined || value === null)) {
          callback(new Error('请输入调整金额'));
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
  adjustForm.adjustType = 'AMOUNT';
  adjustForm.deltaAmount = undefined;
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
      deltaAmount: adjustForm.deltaAmount,
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
  }
}

.data-table {
  width: 100%;

  .person-name {
    font-weight: 600;
    color: #303133;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #909399;
  }
  .amount-redink {
    color: #f56c6c;
  }
  .redink-tag {
    margin-left: 4px;
    transform: scale(0.85);
    transform-origin: left center;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
