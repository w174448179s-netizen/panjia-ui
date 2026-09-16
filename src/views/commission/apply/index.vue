<template>
  <div class="commission-apply-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件 -->
      <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="期间">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            clearable
            style="width: 150px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/组别">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="全部门店/组别"
            clearable
            check-strictly
            style="width: 210px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
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
            共 <b>{{ summary.contractCount }}</b> 个合同 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.detailCount }}</b> 条明细
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">结佣合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
          <el-button v-if="checkPermi(['commission:apply:add'])" type="primary" icon="Plus" :loading="batchCreating" @click="openBatchCreate">
            批量发起{{ queryParams.period ? `（${queryParams.period}）` : '' }}
          </el-button>
          <el-upload
            v-if="checkPermi(['commission:apply:batch'])"
            :show-file-list="false"
            :auto-upload="true"
            :http-request="handleBatchInitiateUpload"
            accept=".xlsx,.xls"
          >
            <el-button type="primary" plain icon="Upload">Excel批量发起</el-button>
          </el-upload>
          <!-- 批量审批入口按权限码收口（能否批哪张单仍由引擎按节点判权） -->
          <el-upload
            v-if="checkPermi(['commission:apply:batch'])"
            :show-file-list="false"
            :auto-upload="true"
            :http-request="handleBatchApproveUpload"
            accept=".xlsx,.xls"
          >
            <el-button type="success" plain icon="DocumentChecked">Excel批量审批</el-button>
          </el-upload>
        </div>
      </div>

      <!-- 合同维度表格 -->
      <el-table border class="data-table" :data="contractList">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <!-- 无论是否已发起单据，都允许点击：未发起 → 跳合同业绩详情；已发起 → 打开结佣申请详情 -->
            <el-button type="primary" link class="contract-link" @click="viewDetail(row)">
              {{ contractOrOrderNo(row) }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="实收(结佣)" align="right" width="120" fixed="left">
          <template #default="{ row }">
            <span class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="应收" align="right" width="120">
          <template #default="{ row }">
            <span class="amount amount-expected">¥{{ formatAmount(row.expectedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="差异/节点" align="center" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.aligned" type="success" size="small">已对齐</el-tag>
            <el-tag v-else-if="hasDiff(row)" type="danger" size="small">有差异</el-tag>
            <el-tag v-else-if="row.currentNode" type="warning" size="small">{{ nodeLabel(row.currentNode) }}</el-tag>
            <span v-else>—</span>
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
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ row.applicantId === 0 ? '系统' : (applicantName(row.applicantId) || '—') }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="220" fixed="right">
          <template #default="{ row }">
            <!-- ≤3 个按钮平铺；white-space:nowrap 防重叠，超过 3 个才收「更多」下拉 -->
            <div class="table-actions">
              <!-- 详情：未发起跳合同业绩详情页；已发起打开结佣申请详情对话框 -->
              <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
              <!-- 提交：未发起 = 发起并提交（一步）；草稿/驳回 = 送审，3 字统称 -->
              <el-button
                v-if="canOriginate(row) || row.status === 'DRAFT' || row.status === 'REJECTED'"
                link type="warning"
                :loading="submittingMap[row.applicationId || row.contractNo]"
                @click="onSubmit(row as CommissionContractVO)">提交</el-button>
              <el-button v-if="(row.status === 'DRAFT' || row.status === 'SUBMITTED') && canCancel(row)" link type="info" @click="cancel(row)">作废</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无可结佣合同' : '请选择期间'" />
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

    <!-- 详情弹窗：复用 WorkflowHandle/details/CommissionApplyDetail（与实收详情同款容器、字段、样式） -->
    <el-dialog v-model="showDetail" title="结佣明细详情" width="1100px" top="5vh" append-to-body destroy-on-close>
      <CommissionApplyDetail v-if="showDetail" :business-id="detailApplicationId!" />
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { commissionApi, type CommissionContractVO } from '@/api/panjia/commission';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { checkPermi } from '@/utils/permission';
import { useUserStore } from '@/store/modules/user';
import CommissionApplyDetail from '@/components/WorkflowHandle/details/CommissionApplyDetail.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** 是否可以作废：超管全部可操作，普通用户只能操作自己发起的单据 */
const canCancel = (row: CommissionContractVO): boolean => {
  if (userStore.roles.includes('admin') || userStore.roles.includes('superadmin')) return true;
  return String(row.applicantId) === String(userStore.userId);
};

const loading = ref(false);
const contractList = ref<CommissionContractVO[]>([]);
const total = ref(0);

// 当前月份（YYYY-MM）
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: currentPeriod(),
  deptId: undefined as string | undefined,
  status: '' as string,
  keyword: '' as string,
});

// 汇总统计（按合同维度）
const summary = computed(() => {
  const list = contractList.value;
  const totalAmount = list.reduce((s, r) => s + num(r.amount), 0);
  const detailCount = list.reduce((s, r) => s + (r.detailCount || 0), 0);
  return {
    contractCount: list.length,
    detailCount,
    employeeCount: 0,
    totalAmount,
  };
});

// 数字安全转换
const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

// 金额格式化
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 合同号/订单号合并展示
const contractOrOrderNo = (row: CommissionContractVO): string => {
  if (row.bizType === '一手房') {
    return row.orderNo || row.contractNo || '—';
  }
  return row.contractNo || row.orderNo || '—';
};

// 部门树（用于顶部门店筛选；详情弹窗的归属门店翻译在 CommissionApplyDetail 内自处理）
const deptTreeData = ref<DeptNode[]>([]);

const loadDeptTree = async () => {
  try {
    const res: any = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch { /* ignore */ }
};

// 员工姓名映射（String key：19 位雪花 ID 超出 JS 安全整数，Number() 会丢精度）
const employeeMap = new Map<string, string>();
const employeeName = (empId: number | string | undefined) => {
  if (empId == null || String(empId) === '') return '—';
  return employeeMap.get(String(empId)) ?? `员工#${empId}`;
};

// 发起人姓名（从员工映射取）
const applicantName = (applicantId: number | string | undefined) => {
  if (applicantId == null || String(applicantId) === '') return '—';
  return employeeMap.get(String(applicantId)) ?? `用户#${applicantId}`;
};

const loadEmployeeMap = async () => {
  try {
    const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
    const rows = res.data?.rows ?? [];
    for (const e of rows) {
      if (e.employeeId != null) employeeMap.set(String(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
    }
  } catch { /* ignore */ }
};

// 状态映射
const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '草稿', SUBMITTED: '已提交', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    NONE: 'info', DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'primary', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

// 可发起：未发起 / 已作废（作废时明细已冲销，事实释放可重新发起）；净额为 0 的合同无可入账事实
const canOriginate = (row: CommissionContractVO) =>
  (row.status === 'NONE' || row.status === 'CANCELLED') && num(row.amount) !== 0;

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.listContracts({
      period: queryParams.period || currentPeriod(),
      deptId: queryParams.deptId || undefined,
      status: queryParams.status || undefined,
      keyword: queryParams.keyword || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = res.data;
    contractList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
  } catch {
    contractList.value = [];
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
  Object.assign(queryParams, {
    period: currentPeriod(), deptId: undefined, status: '', keyword: '', pageNum: 1,
  });
  getList();
};

// 发起 → 提交一步到位：按合同当月实收拉取明细生成草稿后立即送审
// 后端契约：POST /commission/apply 返回 R<Long>，拦截器给到的是 R 包装对象，取 .data 拿 applicationId，
// 再 submitApplication(id) 走工作流；若 submit 失败最坏后果是单据停在草稿，用户重试/单独点提交即可兜底（与 Excel 批量发起同款路径）
const submittingMap = reactive<Record<string, boolean>>({});
const originateAndSubmit = async (row: CommissionContractVO) => {
  const no = contractOrOrderNo(row);
  try {
    await ElMessageBox.confirm(
      `确认为合同「${no}」${row.period} 月发起结佣并提交审批？将按该合同当月实收业绩生成明细并直接进入审批流。`,
      '发起并提交', { type: 'info' },
    );
  } catch {
    return;
  }
  submittingMap[row.contractNo] = true;
  try {
    // request 拦截器返回的是 R 包装对象（{code,msg,data}），data 才是 applicationId；
    // 雪花 ID 由后端 BigNumberSerializer 以字符串下发，禁止 Number() 转换（19 位超出 JS 安全整数会丢精度）
    const res: any = await commissionApi.createApplication({ period: row.period, contractNo: row.contractNo });
    const applicationId = res?.data ?? res;
    if (applicationId) {
      await commissionApi.submitApplication(applicationId);
    }
    ElMessage.success('发起并提交成功');
    getList();
  } catch { /* 拦截器处理（含部分失败提示） */ } finally {
    submittingMap[row.contractNo] = false;
  }
};

// 批量发起
const batchCreating = ref(false);
const openBatchCreate = async () => {
  const period = queryParams.period || currentPeriod();
  const scope = queryParams.deptId ? '当前选中门店（含下级）范围内' : '全部门店';
  try {
    await ElMessageBox.confirm(
      `确认为${scope}${period} 月所有「未发起」合同批量创建结佣明细？`,
      '批量发起结佣', { type: 'info' },
    );
  } catch {
    return;
  }
  batchCreating.value = true;
  try {
    const res: any = await commissionApi.batchCreateApplications({
      period,
      deptId: queryParams.deptId || undefined,
    });
    ElMessage.success(res?.msg || '批量发起完成');
    getList();
  } catch { /* 拦截器处理（含部分失败提示） */ } finally {
    batchCreating.value = false;
  }
};

// 提交（草稿/驳回后送审）
const submit = async (row: CommissionContractVO) => {
  try {
    await ElMessageBox.confirm(`确认提交申请单「${row.applyNo}」？提交后进入审批流程。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  submittingMap[row.applicationId] = true;
  try {
    await commissionApi.submitApplication(row.applicationId);
    ElMessage.success('已提交');
    getList();
  } catch { /* 拦截器处理 */ } finally {
    submittingMap[row.applicationId] = false;
  }
};

// 审批节点中文名
const nodeLabel = (node?: string) => node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—');

// 是否有差异（实收 vs 应收，均有值时比较）
const hasDiff = (row: CommissionContractVO) =>
  row.expectedAmount !== undefined && row.expectedAmount !== null
  && num(row.amount) !== num(row.expectedAmount);

// Excel 批量发起上传
const handleBatchInitiateUpload = async (options: any) => {
  const period = queryParams.period || currentPeriod();
  try {
    const res: any = await commissionApi.batchInitiate(options.file as File, period);
    const r = res?.data;
    if (r && r.failedRows?.length) {
      ElMessageBox.alert(
        `成功 ${r.successCount} 条，失败 ${r.failedRows.length} 条：\n`
        + r.failedRows.slice(0, 20).map((f: any) => `· ${f.contractNo}：${f.reason}`).join('\n'),
        '批量发起结果', { confirmButtonText: '知道了' },
      );
    } else {
      ElMessage.success(`批量发起完成，成功 ${r?.successCount ?? 0} 条`);
    }
    getList();
  } catch { /* 拦截器处理 */ }
};

// Excel 批量审批上传
const handleBatchApproveUpload = async (options: any) => {
  const period = queryParams.period || currentPeriod();
  try {
    const res: any = await commissionApi.batchApprove(options.file as File, period);
    const r = res?.data;
    if (r && r.failedRows?.length) {
      ElMessageBox.alert(
        `成功 ${r.successCount} 条，失败 ${r.failedRows.length} 条：\n`
        + r.failedRows.slice(0, 20).map((f: any) => `· ${f.contractNo}：${f.reason}`).join('\n'),
        '批量审批结果', { confirmButtonText: '知道了' },
      );
    } else {
      ElMessage.success(`批量审批完成，成功 ${r?.successCount ?? 0} 条`);
    }
    getList();
  } catch { /* 拦截器处理 */ }
};

// 作废
const cancel = async (row: CommissionContractVO) => {
  try {
    await ElMessageBox.confirm(`确认作废申请单「${row.applyNo}」？作废后不可恢复。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(row.applicationId);
    ElMessage.success('已作废');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 详情
const showDetail = ref(false);
// 传给 CommissionApplyDetail 的业务 ID（已发起行才设；未发起行走 router 跳转合同业绩详情）
const detailApplicationId = ref<number | string | null>(null);

const viewDetail = async (row: CommissionContractVO) => {
  // 未发起：跳合同业绩详情页，看合同金额/累计结佣/业绩构成
  if (!row.applicationId) {
    router.push({
      name: 'PerformanceContractDetail',
      query: { contractNo: row.contractNo, period: row.period }
    }).catch(() => { /* 重复跳转忽略 */ });
    return;
  }
  // 已发起：打开结佣申请详情对话框（复用 WorkflowHandle/details/CommissionApplyDetail，与实收详情同款）
  detailApplicationId.value = row.applicationId;
  showDetail.value = true;
};

// 提交按钮统一入口：未发起 = 发起并提交；草稿/驳回 = 送审；统一 3 字「提交」文案
const onSubmit = async (row: CommissionContractVO) => {
  if (canOriginate(row)) {
    await originateAndSubmit(row);
  } else {
    await submit(row);
  }
};

// 工作流跳转：根据 query 参数打开详情（查看态；审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  // 复用 CommissionApplyDetail，详情数据由组件内部按 businessId 自取
  detailApplicationId.value = id;
  showDetail.value = true;
};

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/performance/apply', openFromWorkflow);

onMounted(() => {
  loadDeptTree();
  loadEmployeeMap();
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

  .contract-link {
    font-weight: 600;
    padding: 0;
  }

  .table-actions {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }

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
  .amount-expected {
    color: #909399;
  }
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
