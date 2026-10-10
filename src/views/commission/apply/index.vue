<template>
  <div class="commission-apply-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件 -->
      <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="门店/组别">
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            width="210px"
            @change="handleDeptChange"
          />
        </el-form-item>
        <el-form-item v-if="!isAgent" label="员工" prop="employeeId">
          <EmployeeSelect
            v-model="queryParams.employeeId"
            :dept-id="queryParams.deptId"
            width="230px"
            placeholder="姓名/工号搜索"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="类型" prop="bizType">
          <el-select
            v-model="queryParams.bizType"
            placeholder="全部类型"
            clearable
            filterable
            style="width: 160px"
            @change="handleQuery"
          >
            <el-option v-for="t in bizTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="queryParams.keyword"
            placeholder="合同号/订单号/房源"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <div class="summary-left">
          <span class="summary-text">
            共 <b>{{ summary.contractCount }}</b> 个可发起合同 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.detailCount }}</b> 条明细
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">结佣合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
          <el-button v-if="checkPermi(['commission:apply:add'])" type="primary" icon="Plus" @click="showBatchApply = true">
            批量发起
          </el-button>
        </div>
      </div>

      <!-- 合同维度表格 -->
      <el-table border class="data-table" :data="contractList" :empty-text="emptyText">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <span class="contract-text">{{ contractOrOrderNo(row as CommissionContractVO) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结佣业绩" align="right" width="180" fixed="left">
          <template #default="{ row }">
            <el-tooltip
              v-if="num(row.amount) === 0"
              content="新签业绩缺失，请先导入或补录该合同新签"
              placement="top"
            >
              <span class="amount amount-zero">¥0.00</span>
            </el-tooltip>
            <span v-else class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="150">
          <template #default="{ row }">
            <span class="amount amount-ink">¥{{ formatAmount(row.convertedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="100">
          <template #default="{ row }">{{ row.bizType || '—' }}</template>
        </el-table-column>
        <el-table-column label="房源地址" align="left" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
        </el-table-column>
        <el-table-column label="签约/认购时间" align="center" width="170">
          <template #default="{ row }">{{ formatDateTime(row.businessDate) }}</template>
        </el-table-column>
        <el-table-column label="涉及人数" align="center" width="80">
          <template #default="{ row }">{{ row.employeeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="明细条数" align="center" width="80">
          <template #default="{ row }">{{ row.detailCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                link type="warning"
                :loading="submittingMap[contractOrOrderNo(row as CommissionContractVO)]"
                @click="onSubmit(row as CommissionContractVO)"
              >发起</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该条件下暂无可发起合同" />
        </template>
      </el-table>

      <!-- 分页 -->
      <div class="pager-bar">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          @size-change="handleQuery"
          @current-change="getList"
        />
      </div>
    </el-card>

    <!-- 批量发起弹窗：录入合同号 → 等待处理完成 → 展示结果 -->
    <el-dialog v-model="showBatchApply" title="批量发起结佣" width="560px" @close="resetBatchApply">
      <div v-if="batchApplyLoading" class="batch-waiting">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="waiting-text">正在批量发起，请耐心等待...</p>
        <p class="waiting-sub">共 {{ batchApplyForm.parsedCount }} 个合同号，逐张处理中</p>
      </div>

      <div v-else-if="batchApplyResult" class="batch-result">
        <el-result :icon="batchApplyResult.failed > 0 ? 'warning' : 'success'" :title="batchApplySummary">
        </el-result>
        <div class="result-detail">
          <div v-if="batchApplyResult.successContracts.length" class="result-section">
            <div class="result-label success">成功（{{ batchApplyResult.success }}）</div>
            <div class="contract-list">{{ batchApplyResult.successContracts.join('、') }}</div>
          </div>
          <div v-if="batchApplyResult.skippedContracts.length" class="result-section">
            <div class="result-label skip">跳过（{{ batchApplyResult.skipped }}）</div>
            <div class="contract-list">{{ batchApplyResult.skippedContracts.join('、') }}</div>
          </div>
          <div v-if="batchApplyResult.failedContracts.length" class="result-section">
            <div class="result-label fail">失败（{{ batchApplyResult.failed }}）</div>
            <div class="contract-list">{{ batchApplyResult.failedContracts.join('、') }}</div>
          </div>
        </div>
      </div>

      <template v-else>
        <el-form label-width="80px">
          <el-form-item label="结佣期间" required>
            <el-date-picker
              v-model="batchApplyForm.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="请选择结佣月份"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="合同号" required>
            <el-input
              v-model="batchApplyForm.contractNosText"
              type="textarea"
              :rows="10"
              placeholder="每行一个合同号/订单号（以列表展示的编号为准），或用逗号/空格分隔"
            />
          </el-form-item>
          <div class="batch-hint">
            将按所选结佣期间为每个合同号发起结佣申请并提交审批（结佣期间不按实收日期，历史实收审批通过且未结佣的均可发起）。已有未完结单的合同会跳过。
          </div>
        </el-form>
      </template>

      <template #footer>
        <el-button v-if="!batchApplyResult && !batchApplyLoading" @click="showBatchApply = false">取消</el-button>
        <el-button v-if="!batchApplyResult && !batchApplyLoading" type="primary" @click="doBatchApply">开始发起</el-button>
        <el-button v-if="batchApplyResult" type="primary" @click="closeBatchApply">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { commissionApi, type CommissionContractVO, type BatchResultDTO } from '@/api/panjia/commission';
import { performanceApi } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import { useDeptScope } from '@/hooks/useDeptScope';
import { checkPermi } from '@/utils/permission';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();
/** 经纪人：本人口径（后端强制按本人 employeeId 过滤），不展示员工筛选 */
const isAgent = computed(() => userStore.roles.includes('agent'));

const loading = ref(false);
const contractList = ref<CommissionContractVO[]>([]);
const total = ref(0);

// 发起页无期间概念：查全部实收审批通过且未结佣的合同
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  deptId: undefined as string | undefined,
  employeeId: undefined as string | undefined,
  bizType: undefined as string | undefined,
  keyword: '' as string,
});

// 汇总统计：后端按过滤后全集返回（跨页全局，不随分页变化）
const emptySummary = () => ({ contractCount: 0, employeeCount: 0, detailCount: 0, totalAmount: 0 });
const summary = ref(emptySummary());

// 数字安全转换
const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

// 金额格式化
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 合同号/订单号合并展示：一手房、房产金融、家装荐客以订单号为准，其它以合同号为准（空则回退）
const contractOrOrderNo = (row: CommissionContractVO): string =>
  resolveBizNo(row.bizType, row.contractNo, row.orderNo) || '—';

// 部门口径（全系统统一：所有用户查本部门及以下；详情弹窗的归属门店翻译在 CommissionApplyDetail 内自处理）
const { deptLocked, defaultDeptId } = useDeptScope();

// 类型下拉选项：随部门数据范围实时变化（与列表同权限口径）
const bizTypeOptions = ref<string[]>([]);
const loadBizTypes = async () => {
  try {
    const res = await performanceApi.listSearchBizTypes({
      deptId: isAgent.value ? undefined : queryParams.deptId,
      employeeId: isAgent.value ? undefined : queryParams.employeeId,
    });
    bizTypeOptions.value = res.data ?? [];
  } catch { bizTypeOptions.value = []; }
};

/** 门店/组别变化：原选中员工可能不在新部门范围内，清空员工筛选后再按新范围查询 */
const handleDeptChange = () => {
  queryParams.employeeId = undefined;
  loadBizTypes().then(handleQuery);
};

// 列表
const getList = async () => {
  // 必须录入关键字，避免全表扫描
  if (!queryParams.keyword?.trim()) {
    contractList.value = [];
    total.value = 0;
    summary.value = emptySummary();
    return;
  }
  loading.value = true;
  try {
    const res: any = await commissionApi.listAvailableContracts({
      deptId: queryParams.deptId || undefined,
      employeeId: queryParams.employeeId || undefined,
      bizType: queryParams.bizType || undefined,
      keyword: queryParams.keyword || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = res.data;
    contractList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
    summary.value = {
      contractCount: num(data?.summary?.contractCount) || total.value,
      employeeCount: num(data?.summary?.employeeCount),
      detailCount: num(data?.summary?.detailCount),
      totalAmount: num(data?.summary?.totalAmount),
    };
  } catch {
    contractList.value = [];
    total.value = 0;
    summary.value = emptySummary();
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

/** 空态提示：引导用户录入关键字查询 */
const emptyText = computed(() => {
  if (!queryParams.keyword?.trim()) {
    return '请录入合同号/订单号/房源关键字查询';
  }
  return '该条件下暂无可发起合同';
});

const resetQuery = () => {
  Object.assign(queryParams, {
    deptId: defaultDeptId(), employeeId: undefined, bizType: undefined, keyword: '', pageNum: 1,
  });
  loadBizTypes().then(getList);
};

// 按钮 loading 状态（以 contractNo 为 key）
const submittingMap = reactive<Record<string, boolean>>({});

// 批量发起（按合同号）
const showBatchApply = ref(false);
const batchApplyLoading = ref(false);
const batchApplyResult = ref<BatchResultDTO | null>(null);
const batchApplyForm = reactive({
  period: '',
  contractNosText: '',
  parsedCount: 0,
});
const batchApplySummary = computed(() => {
  const r = batchApplyResult.value;
  if (!r) return '';
  return `成功 ${r.success} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`;
});
const resetBatchApply = () => {
  batchApplyForm.period = '';
  batchApplyForm.contractNosText = '';
  batchApplyForm.parsedCount = 0;
  batchApplyLoading.value = false;
  batchApplyResult.value = null;
};
const closeBatchApply = () => {
  showBatchApply.value = false;
  resetBatchApply();
  getList();
};
const doBatchApply = async () => {
  if (!batchApplyForm.period) {
    ElMessage.warning('请选择结佣期间');
    return;
  }
  const contractNos = batchApplyForm.contractNosText
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (contractNos.length === 0) {
    ElMessage.warning('请输入至少一个合同号');
    return;
  }
  batchApplyForm.parsedCount = contractNos.length;
  batchApplyLoading.value = true;
  try {
    // 传发起人选择的结佣期间；实收事实跨期查找，不按实收月归属
    const res: any = await commissionApi.batchApplyByContract(batchApplyForm.period, contractNos);
    batchApplyResult.value = res.data;
  } catch { /* 拦截器处理 */ } finally {
    batchApplyLoading.value = false;
  }
};

// 发起并提交一步到位：后端 POST /commission/apply 一次完成发起+提交
const onSubmit = async (row: CommissionContractVO) => {
  const no = contractOrOrderNo(row);
  if (!no || no === '—') {
    ElMessage.warning('该合同缺少合同号/订单号，无法发起');
    return;
  }
  // 提交中拦截：防止连点重复弹出确认框/重复提交
  if (submittingMap[no]) return;
  try {
    await ElMessageBox.confirm(
      `确认为合同「${no}」发起结佣？发起后需选择结佣期间并提交审批。`,
      '发起结佣', { type: 'info' },
    );
  } catch {
    return;
  }
  // 发起时需要选择结佣期间，这里弹出选择对话框
  try {
    const { value: period } = await ElMessageBox.prompt(
      '请选择结佣期间（YYYY-MM）',
      '发起结佣',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^\d{4}-\d{2}$/,
        inputErrorMessage: '格式应为 YYYY-MM，如 2026-10',
      },
    );
    if (!period) return;
    submittingMap[no] = true;
    try {
      await commissionApi.createApplication({ period, contractNo: no });
      ElMessage.success('发起成功');
      await getList();
    } catch { /* 拦截器处理 */ } finally {
      submittingMap[no] = false;
    }
  } catch { /* 用户取消 */ }
};

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

onMounted(() => {
  queryParams.deptId = defaultDeptId();
  loadBizTypes();
  getList();
});
</script>

<style lang="scss" scoped>
.commission-apply-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.filter-form {
  margin-bottom: 4px;
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  flex-wrap: wrap;

  .summary-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    flex-wrap: wrap;
  }

  .summary-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .summary-text {
    font-size: 13px;
    color: #606266;

    b {
      color: #303133;
      margin: 0 2px;
    }
  }

  .summary-amount {
    font-size: 13px;
    color: #606266;

    b {
      color: #f56c6c;
      font-size: 15px;
      margin-left: 4px;
    }
  }
}

.data-table {
  width: 100%;

  .contract-text {
    font-weight: 600;
    color: #303133;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-red {
    color: #f56c6c;
  }
  .amount-zero {
    color: #c0c4cc;
    cursor: help;
    border-bottom: 1px dashed #c0c4cc;
  }
  .amount-ink {
    color: #303133;
  }
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.batch-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
  padding-left: 80px;
}

.batch-waiting {
  text-align: center;
  padding: 40px 0;

  .waiting-text {
    font-size: 15px;
    font-weight: 500;
    margin-top: 16px;
  }
  .waiting-sub {
    font-size: 13px;
    color: #909399;
    margin-top: 8px;
  }
}

.batch-result {
  .result-detail {
    margin-top: 8px;
  }

  .result-section {
    margin-bottom: 12px;
  }

  .result-label {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;

    &.success { color: #67c23a; }
    &.skip { color: #909399; }
    &.fail { color: #f56c6c; }
  }

  .contract-list {
    font-size: 12px;
    color: #606266;
    line-height: 1.6;
    word-break: break-all;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    padding: 8px 10px;
    max-height: 120px;
    overflow-y: auto;
  }
}
</style>
