<template>
  <div class="commission-adjust-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="期间" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
              style="width: 160px"
              @change="handleScopeChange"
            />
          </el-form-item>
          <el-form-item label="调整类型" prop="adjustType">
            <el-select
              v-model="queryParams.adjustType"
              placeholder="全部类型"
              clearable
              style="width: 150px"
              @change="handleQuery"
            >
              <el-option
                v-for="opt in typeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select
              v-model="queryParams.status"
              placeholder="全部状态"
              clearable
              style="width: 130px"
              @change="handleQuery"
            >
              <el-option
                v-for="opt in statusOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!isAgent" label="员工" prop="employeeId">
            <EmployeeSelect
              v-model="queryParams.employeeId"
              :dept-id="queryParams.deptId"
              width="220px"
              @change="onEmployeeChange"
            />
          </el-form-item>
          <el-form-item v-if="!isAgent" label="门店/组别" prop="deptId">
            <PanjiaDeptSelect
              v-model="queryParams.deptId"
              :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
              :clearable="!deptLocked"
              width="220px"
              @change="handleDeptChange"
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
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 工具栏 -->
        <div class="toolbar">
          <el-button icon="Refresh" @click="getList">刷新</el-button>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="adjustList"
          :default-sort="{ prop: 'createTime', order: 'descending' }"
        >
          <el-table-column label="期间" align="center" prop="period" width="100">
            <template #default="{ row }">{{ row.period || '—' }}</template>
          </el-table-column>
          <el-table-column label="调整范围" align="center" width="100">
            <template #default="{ row }">
              <el-tag :type="row.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
                {{ row.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="调整对象" align="center" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <el-button link type="primary" class="adjust-object-link" @click="viewDetail(row)">
                {{ row.adjustScope === 'CONTRACT'
                  ? (row.contractNo || '—')
                  : (row.employeeName || row.employeeCode || '—') }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="门店/组别" align="center" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.deptName || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整类型" align="center" width="100">
            <template #default="{ row }">
              {{ typeLabel(row.adjustType) }}
            </template>
          </el-table-column>
          <el-table-column label="结佣业绩" align="right" width="130">
            <template #default="{ row }">
              <span class="origin-amount">{{ formatOrigin(row.originalAmount) }}</span>
              <div v-if="row.adjustType === 'ADD_MEMBER'" class="cell-sub">合同总额</div>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="130">
            <template #default="{ row }">
              <span class="amount-ink">{{ formatOrigin(row.convertedOriginalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整后业绩" align="right" width="140">
            <template #default="{ row }">
              <template v-if="row.adjustType === 'ADD_MEMBER'">
                <span class="amount-positive amount-strong">+{{ formatOrigin(row.newAmount) }}</span>
                <div class="cell-sub">新增角色人</div>
              </template>
              <span v-else class="amount-red">
                {{ formatOrigin(row.newAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="130">
            <template #default="{ row }">
              <span class="amount-ink">{{ formatOrigin(row.convertedNewAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="原因" align="center" prop="reason" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" align="center" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="140" class-name="small-padding fixed-width">
            <template #default="{ row }">
              <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
              <el-button
                v-if="row.status === 'SUBMITTED' && checkPermi(['workflow:task:edit'])"
                link
                type="success"
                :loading="approvalLoading"
                @click="onBizApprove(row.id)"
              >
                审批
              </el-button>
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
      </div>
    </el-card>

    <!-- 详情弹窗：与「我的待办 → 结佣调整审批」共用同一份模板，避免两处口径漂移 -->
    <el-dialog
      v-model="detailDialog.visible"
      title="调整单详情"
      width="1100px"
      top="5vh"
      append-to-body
      destroy-on-close
    >
      <CommissionAdjustDetail v-if="detailDialog.visible" :business-id="detailDialog.businessId" />
      <template #footer>
        <el-button @click="detailDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- 业务明细直接审批弹窗（与「我的待办」共用同一 WorkflowHandle 组件） -->
    <WorkflowHandle ref="workflowHandleRef" @handled="getList" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';
import { performanceApi } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import { useDeptScope } from '@/hooks/useDeptScope';
import { useUserStore } from '@/store/modules/user';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { checkPermi } from '@/utils/permission';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';
import CommissionAdjustDetail from '@/components/WorkflowHandle/details/CommissionAdjustDetail.vue';

const route = useRoute();

const userStore = useUserStore();
/** 经纪人：本人口径（后端强制按本人 employeeId 过滤），不展示门店/组别/员工筛选 */
const isAgent = computed(() => userStore.roles.includes('agent'));
const { deptLocked, defaultDeptId } = useDeptScope();

/** 业务明细直接审批：通过 businessId 查当前用户可办理任务，复用 WorkflowHandle 弹窗 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandle>>();
const { loading: approvalLoading, handleBizApproval } = useBizApproval();
const onBizApprove = (businessId: string | number) =>
  handleBizApproval(businessId, (task) => workflowHandleRef.value?.open(task));

// ==================== 枚举 ====================
const TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整',
  ADD_MEMBER: '增加角色人',
};
const typeOptions = Object.entries(TYPE_MAP).map(([value, label]) => ({ value, label }));
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  EXECUTED: '已执行',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const statusTagType = (s: string): TagType => {
  const map: Record<string, TagType> = {
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'info',
    EXECUTED: 'success',
  };
  return map[s] ?? 'info';
};

// ==================== 筛选 & 分页 ====================
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
});

// ==================== 员工筛选（EmployeeSelect 公共组件，选项受后端部门数据权限约束） ====================
/** 选中/清空员工后：类型可见范围随之变化，先刷新类型选项（顺带剔除失效选中）再查询 */
const onEmployeeChange = () => {
  loadBizTypes().then(handleQuery);
};

/** 清空员工筛选（部门范围变化/重置时调用：原员工可能已不在新部门范围内） */
const clearEmployeeFilter = () => {
  queryParams.employeeId = undefined;
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

// ==================== 列表 ====================
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
const handleScopeChange = () => {
  loadBizTypes().then(handleQuery);
};
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
    pageNum: 1,
  });
  clearEmployeeFilter();
  loadBizTypes().then(handleQuery);
};

// ==================== 工具方法 ====================
/** 原始金额：带 ¥ 前缀；缺失显示 — */
const formatOrigin = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

// ==================== 详情弹窗 ====================
const detailDialog = reactive({
  visible: false,
  businessId: '' as string | number,
});

const viewDetail = (row: any) => {
  detailDialog.businessId = row.id;
  detailDialog.visible = true;
};

// 工作流跳转：查看态打开详情（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  detailDialog.businessId = id;
  detailDialog.visible = true;
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/commission/adjust', openFromWorkflow);

onMounted(() => {
  // 受限角色（店长/总监）默认选中本部门，首屏即按本部门查询
  queryParams.deptId = defaultDeptId();
  loadBizTypes();
  getList();
});
</script>

<style lang="scss" scoped>
.commission-adjust-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.page-content {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .filter-form {
    margin-bottom: 0;
  }

  .toolbar {
    display: flex;
    gap: 8px;
  }

  .data-table {
    width: 100%;
  }

  .origin-amount {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
  }

  .amount-ink {
    color: #303133;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .amount-red {
    color: var(--el-color-danger);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .amount-positive {
    color: var(--el-color-success);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .amount-strong {
    font-size: 15px;
    font-weight: 700;
  }

  .cell-sub {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
  }

  .pagination-wrap {
    display: flex;
    justify-content: flex-end;
  }
}

.adjust-object-link {
  max-width: 100%;
  vertical-align: baseline;
}
</style>
