<template>
  <div class="commission-adjust" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">结佣调整</h3>
      </div>

      <!-- 筛选 -->
      <el-form :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="期间">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            clearable
            style="width: 160px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="queryParams.adjustType" placeholder="全部类型" clearable style="width: 140px" @change="handleQuery">
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请单ID">
          <el-input
            v-model="queryParams.applicationId"
            placeholder="申请单ID"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="adjustList" stripe border>
        <el-table-column label="调整单号" prop="adjustNo" min-width="180" show-overflow-tooltip />
        <el-table-column label="申请单ID" prop="applicationId" width="120" />
        <el-table-column label="明细ID" prop="itemId" width="120">
          <template #default="{ row }">{{ row.itemId || '—' }}</template>
        </el-table-column>
        <el-table-column label="期间" prop="period" width="100">
          <template #default="{ row }">{{ row.period || '—' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.adjustType)" size="small">{{ typeLabel(row.adjustType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="调整前" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.originalAmount != null">¥{{ fmt(row.originalAmount) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="调整后" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.newAmount != null" class="text-ink">¥{{ fmt(row.newAmount) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="差额" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.diffAmount != null" :class="amountClass(row.diffAmount)">¥{{ fmt(row.diffAmount) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" align="center" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无调整单" /></template>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleQuery"
          @current-change="getList"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="调整单详情" width="560px">
      <el-descriptions v-if="detailData" :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detailData.adjustNo }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag :type="typeTagType(detailData.adjustType)" size="small">{{ typeLabel(detailData.adjustType) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请单ID">{{ detailData.applicationId }}</el-descriptions-item>
        <el-descriptions-item label="明细ID">{{ detailData.itemId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailData.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="范围">
          {{ detailData.adjustScope === 'CONTRACT' ? '合同级' : detailData.adjustScope === 'DETAIL' ? '明细级' : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="调整前金额" v-if="detailData.originalAmount != null">¥{{ fmt(detailData.originalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="调整后金额" v-if="detailData.newAmount != null">
          <span class="text-ink">¥{{ fmt(detailData.newAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="调整差额" v-if="detailData.diffAmount != null">
          <span :class="amountClass(detailData.diffAmount)">¥{{ fmt(detailData.diffAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发起人ID">{{ detailData.applicantId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ detailData.createTime }}</el-descriptions-item>
        <el-descriptions-item label="原因" :span="2">{{ detailData.reason || '—' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <!-- 审批统一由「我的待办」弹窗办理（工作流任务接口），本页只提供查看 -->
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const loading = ref(false);
const adjustList = ref<CommissionAdjust[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  adjustType: '' as string,
  status: '' as string,
  applicationId: '' as string,
});

const TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整', VOID: '业绩冲销', TRANSFER: '部门划转',
  DISCOUNT: '折扣', DIFF: '差额补发',
};
const typeOptions = Object.entries(TYPE_MAP).map(([value, label]) => ({ value, label }));
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = {
    AMOUNT: 'primary', VOID: 'danger', TRANSFER: 'warning',
    DISCOUNT: 'warning', DIFF: 'primary',
  };
  return (map as any)[t] || 'info';
};

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交', APPROVED: '已审批', REJECTED: '已拒绝', CANCELLED: '已取消', EXECUTED: '已执行',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'warning', APPROVED: 'primary', REJECTED: 'danger', CANCELLED: 'info', EXECUTED: 'success',
  };
  return (map as any)[s] || 'info';
};

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amountClass = (n: number | undefined) => {
  if (n == null) return '';
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return '';
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res = await commissionApi.listAdjusts({
      period: queryParams.period || undefined,
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      applicationId: queryParams.applicationId || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = (res as any).data;
    adjustList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
  } catch {
    adjustList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  Object.assign(queryParams, { period: '', adjustType: '', status: '', applicationId: '', pageNum: 1 });
  getList();
};

// 详情
const showDetail = ref(false);
const detailData = ref<CommissionAdjust | null>(null);

const viewDetail = async (row: any) => {
  detailData.value = row;
  showDetail.value = true;
  try {
    const res = await commissionApi.getAdjust(row.id);
    detailData.value = (res as any).data ?? row;
  } catch { /* 使用列表数据 */ }
};

// 工作流跳转：查看态打开详情（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  try {
    const res = await commissionApi.getAdjust(id);
    detailData.value = (res as any).data;
    showDetail.value = true;
  } catch {
    ElMessage.error('加载单据失败');
  }
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/commission/adjust', openFromWorkflow);

onMounted(() => {
  getList();
});
</script>

<style scoped>
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
.text-success { color: var(--el-color-success); font-weight: 600; }
.text-danger { color: var(--el-color-danger); font-weight: 600; }
.text-ink {
  color: #303133;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
