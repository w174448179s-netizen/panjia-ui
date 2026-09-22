<template>
  <div class="commission-adjust" style="padding: 12px;">
    <el-card>


      <!-- 筛选 -->
      <el-form :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="期间" prop="period">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="全部期间"
            clearable
            style="width: 160px"
            @change="handleScopeChange"
          />
        </el-form-item>
        <el-form-item v-if="!isAgent" label="门店/组别" prop="deptId">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            check-strictly
            style="width: 200px"
            @change="handleDeptChange"
          />
        </el-form-item>
        <el-form-item v-if="!isAgent" label="员工" prop="employeeId">
          <el-select
            v-model="queryParams.employeeId"
            filterable
            remote
            clearable
            :remote-method="searchEmployees"
            :loading="employeeLoading"
            :no-data-text="employeeNoDataText"
            placeholder="姓名/工号搜索"
            style="width: 230px"
            @change="handleEmployeeChange"
            @clear="handleEmployeeClear"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`"
              :value="emp.employeeId"
            />
          </el-select>
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
        <el-form-item label="关键字" prop="keyword">
          <el-input
            v-model.trim="queryParams.keyword"
            placeholder="合同号/订单号/物业地址"
            clearable
            style="width: 260px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item label="调整类型" prop="adjustType">
          <el-select v-model="queryParams.adjustType" placeholder="全部类型" clearable style="width: 140px" @change="handleQuery">
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';
import { performanceApi, type PerformanceEmployeeOption } from '@/api/panjia/performance';
import { useDeptScope } from '@/hooks/useDeptScope';
import { useUserStore } from '@/store/modules/user';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const userStore = useUserStore();
/** 经纪人：本人口径（后端强制按本人 employeeId 过滤），不展示门店/组别/员工筛选 */
const isAgent = computed(() => userStore.roles.includes('agent'));
const { deptLocked, defaultDeptId, deptTreeData, loadDeptTree } = useDeptScope();

const loading = ref(false);
const adjustList = ref<CommissionAdjust[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  deptId: undefined as string | undefined,
  employeeId: undefined as string | undefined,
  bizType: undefined as string | undefined,
  keyword: '' as string,
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

// ==================== 员工筛选（远程搜索，选项受后端部门数据权限约束） ====================
const employeeOptions = ref<PerformanceEmployeeOption[]>([]);
const employeeLoading = ref(false);
/** 是否已发起过搜索（未搜索时提示输入，搜索无结果时提示无匹配） */
const employeeSearched = ref(false);
const employeeNoDataText = computed(() => (employeeSearched.value ? '无匹配员工' : '输入姓名/工号搜索'));

const searchEmployees = async (query: string) => {
  const kw = (query ?? '').trim();
  if (!kw) { employeeOptions.value = []; employeeSearched.value = false; return; }
  employeeLoading.value = true;
  try {
    const res = await performanceApi.searchEmployeeOptions({
      keyword: kw,
      deptId: isAgent.value ? undefined : queryParams.deptId,
    });
    employeeOptions.value = res.data ?? [];
    employeeSearched.value = true;
  } catch {
    employeeOptions.value = [];
  } finally {
    employeeLoading.value = false;
  }
};

/** 员工变化后类型可见范围随之变化，先刷新类型选项（顺带剔除失效选中）再查询 */
const handleEmployeeChange = () => { loadBizTypes().then(handleQuery); };
const handleEmployeeClear = () => {
  employeeOptions.value = [];
  employeeSearched.value = false;
  loadBizTypes().then(handleQuery);
};

/** 清空员工筛选（部门范围变化/重置时调用：原员工可能已不在新部门范围内） */
const clearEmployeeFilter = () => {
  queryParams.employeeId = undefined;
  employeeOptions.value = [];
  employeeSearched.value = false;
};

// ==================== 类型下拉选项（随期间/部门数据范围实时变化） ====================
const bizTypeOptions = ref<string[]>([]);
const loadBizTypes = async () => {
  try {
    const res = await performanceApi.listSearchBizTypes({
      period: queryParams.period,
      deptId: isAgent.value ? undefined : queryParams.deptId,
      employeeId: isAgent.value ? undefined : queryParams.employeeId,
    });
    bizTypeOptions.value = res.data ?? [];
    // 当前选中类型已不在可见范围内时清空，避免带着失效条件查询
    if (queryParams.bizType && !bizTypeOptions.value.includes(queryParams.bizType)) {
      queryParams.bizType = undefined;
    }
  } catch {
    bizTypeOptions.value = [];
  }
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res = await commissionApi.listAdjusts({
      period: queryParams.period || undefined,
      deptId: isAgent.value ? undefined : queryParams.deptId,
      employeeId: isAgent.value ? undefined : queryParams.employeeId,
      bizType: queryParams.bizType,
      keyword: queryParams.keyword || undefined,
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

/** 期间变化：先按新范围刷新类型选项（顺带剔除失效选中），再触发查询 */
const handleScopeChange = () => { loadBizTypes().then(handleQuery); };
/** 门店/组别变化：原选中员工可能不在新部门范围内，清空员工筛选后再按新范围查询 */
const handleDeptChange = () => {
  clearEmployeeFilter();
  handleScopeChange();
};

const resetQuery = () => {
  Object.assign(queryParams, {
    period: '',
    deptId: defaultDeptId(),
    employeeId: undefined,
    bizType: undefined,
    keyword: '',
    adjustType: '',
    status: '',
    applicationId: '',
    pageNum: 1,
  });
  clearEmployeeFilter();
  loadBizTypes().then(handleQuery);
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
  // 受限角色（店长/总监）默认选中本部门，首屏即按本部门查询
  queryParams.deptId = defaultDeptId();
  loadDeptTree();
  loadBizTypes();
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
