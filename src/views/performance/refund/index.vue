<template>
  <div class="perf-refund-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 汇总 -->
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">冲减新签合计</span>
            <b class="amount-negative">{{ formatAmount(summaryData.expectAmount) }}</b>
          </div>
          <div class="summary-item">
            <span class="summary-label">冲减实收合计</span>
            <b class="amount-negative">{{ formatAmount(summaryData.realAmount) }}</b>
          </div>
          <div class="summary-item">
            <span class="summary-label">冲减结佣合计</span>
            <b class="amount-negative">{{ formatAmount(summaryData.commissionAmount ?? 0) }}</b>
          </div>
          <div class="summary-item">
            <span class="summary-label">已执行退单</span>
            <b>{{ summaryData.refundCount ?? 0 }}</b>
            <span class="summary-sub">笔</span>
          </div>
          <span class="summary-tip">
            退单以合同为单位全额冲退，审批通过后在退单月生成负新签、负实收与已结佣部分的负结佣，退单不可撤销
          </span>
        </div>

        <!-- 筛选 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="退单月份" prop="refundPeriod">
            <el-date-picker
              v-model="queryParams.refundPeriod"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
              style="width: 160px"
              @change="getList"
            />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select
              v-model="queryParams.status"
              placeholder="全部状态"
              clearable
              style="width: 140px"
              @change="getList"
            >
              <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键字" prop="keyword">
            <el-input
              v-model.trim="queryParams.keyword"
              placeholder="退单号/合同号/订单号"
              clearable
              style="width: 240px"
              @keyup.enter="getList"
              @clear="getList"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="getList">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 表格 -->
        <el-table v-loading="loading" border class="data-table" :data="refundList">
          <el-table-column label="退单号" prop="refundNo" width="180" show-overflow-tooltip />
          <el-table-column label="合同号" prop="contractNo" min-width="140" show-overflow-tooltip />
          <el-table-column label="订单号" prop="orderNo" min-width="140" show-overflow-tooltip />
          <el-table-column label="退单月份" prop="refundPeriod" width="100" align="center" />
          <el-table-column label="业务类型" prop="bizType" width="120" align="center" show-overflow-tooltip />
          <el-table-column label="门店/组别" prop="deptName" min-width="120" show-overflow-tooltip />
          <el-table-column label="冲减新签" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-negative">{{ formatAmount(row.expectAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="冲减实收" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-negative">{{ formatAmount(row.realAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="冲减结佣" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-negative">{{ formatAmount(row.commissionAmount ?? 0) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small" effect="plain">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="退单原因" prop="reason" min-width="180" show-overflow-tooltip />
          <el-table-column label="申请人" prop="applicantId" width="170" show-overflow-tooltip />
          <el-table-column label="创建时间" prop="createTime" width="170" align="center" />
          <el-table-column label="执行时间" prop="executeTime" width="170" align="center">
            <template #default="{ row }">{{ row.executeTime || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'SUBMITTED' && String(row.applicantId) === String(currentUserId)"
                size="small"
                link
                type="danger"
                @click="handleWithdraw(row as PerfRefund)"
              >撤回</el-button>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="pageQuery.pageNum"
            v-model:page-size="pageQuery.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="getList"
            @current-change="getList"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { perfRefundApi, withdrawPerfRefund } from '@/api/panjia/refund';
import type { PerfRefund, PerfRefundQuery, PerfRefundSummary } from '@/api/panjia/refund';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'PerfRefund' });

const userStore = useUserStore();
const currentUserId = computed(() => String(userStore.userId ?? ''));

const loading = ref(false);
const refundList = ref<PerfRefund[]>([]);
const total = ref(0);
const summaryData = ref<PerfRefundSummary>({ expectAmount: 0, realAmount: 0, commissionAmount: 0, refundCount: 0 });

const queryParams = reactive<PerfRefundQuery>({
  refundPeriod: '',
  status: '',
  keyword: '',
});

const pageQuery = reactive({ pageNum: 1, pageSize: 20 });

const statusOptions = [
  { label: '审批中', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已执行', value: 'EXECUTED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已撤回', value: 'CANCELLED' },
];

const statusLabel = (status: string) =>
  statusOptions.find((opt) => opt.value === status)?.label ?? status ?? '—';

const statusTagType = (status: string) => {
  switch (status) {
    case 'EXECUTED':
      return 'danger';
    case 'APPROVED':
      return 'success';
    case 'SUBMITTED':
      return 'warning';
    case 'REJECTED':
      return 'info';
    default:
      return 'info';
  }
};

const formatAmount = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0.00';
  const num = Number(value);
  return (num > 0 ? '+' : '') + num.toFixed(2);
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await perfRefundApi.list({ ...queryParams, ...pageQuery });
    refundList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
    summaryData.value = (await perfRefundApi.summary(queryParams.refundPeriod || undefined)).data
      ?? { expectAmount: 0, realAmount: 0, commissionAmount: 0, refundCount: 0 };
  } catch (e: any) {
    ElMessage.error(e?.message || '退单列表加载失败');
  } finally {
    loading.value = false;
  }
};

const resetQuery = () => {
  queryParams.refundPeriod = '';
  queryParams.status = '';
  queryParams.keyword = '';
  pageQuery.pageNum = 1;
  getList();
};

const handleWithdraw = async (row: PerfRefund) => {
  try {
    await ElMessageBox.confirm(
      `确认撤回退单 ${row.refundNo}？撤回后该单据作废，如需退单需重新发起。`,
      '撤回退单',
      { type: 'warning', confirmButtonText: '确认撤回', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await withdrawPerfRefund(row.id);
    ElMessage.success('已撤回');
    getList();
  } catch (e: any) {
    ElMessage.error(e?.message || '撤回失败');
  }
};

onMounted(getList);
</script>

<style scoped lang="scss">
.perf-refund-page {
  .summary-bar {
    display: flex;
    align-items: baseline;
    gap: 32px;
    padding: 12px 14px;
    margin-bottom: 14px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    flex-wrap: wrap;
  }

  .summary-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .summary-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .summary-sub {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .summary-tip {
    flex: 1;
    min-width: 320px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .amount-negative {
    color: var(--el-color-danger);
  }

  .pagination-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
  }
}
</style>
