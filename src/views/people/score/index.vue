<template>
  <div class="p-2 app-container people-score-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="工号" prop="employeeCode">
          <el-input
            v-model="queryParams.employeeCode"
            placeholder="请输入工号"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="姓名" prop="employeeName">
          <el-input
            v-model="queryParams.employeeName"
            placeholder="请输入姓名"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/组别" prop="deptId">
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
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="积分期间">
          <el-date-picker
            v-model="period"
            type="month"
            value-format="YYYY-MM"
            :clearable="false"
            placeholder="请选择期间"
            style="width: 140px"
            @change="handlePeriodChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 积分汇总列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Performance Score Monthly</span>
            <h3>绩效积分汇总</h3>
            <p>共 {{ total }} 条记录，一员工一月一行；来自积分日报导入聚合，平均分 = 总积分 / 出勤天数。</p>
          </div>
          <div class="toolbar-actions">
            <div class="approval-bar">
              <!-- 期间以筛选区「积分期间」为准，此处只展示该期间的审批状态与动作 -->
              <el-tooltip
                :disabled="approvalInfo.status !== 'REJECTED'"
                :content="approvalInfo.rejectReason"
                placement="top"
              >
                <el-tag :type="approvalTagType">{{ approvalTagLabel }}</el-tag>
              </el-tooltip>
              <!-- 通过/驳回已收敛到「我的待办」（score_approval 工作流，总监24h未审自动通过） -->
              <el-button
                v-if="approvalInfo.status !== 'SUBMITTED' && approvalInfo.status !== 'APPROVED'"
                type="warning"
                plain
                icon="Position"
                :loading="approvalLoading"
                @click="handleSubmitApproval"
              >
                提交审批
              </el-button>
              <el-button
                v-if="approvalInfo.status === 'SUBMITTED'"
                link
                type="primary"
                @click="openApprovalDetail"
              >
                查看审批单
              </el-button>
            </div>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="scoreList">
        <el-table-column label="积分月份" align="center" prop="scoreMonth" width="110" />
        <el-table-column label="工号" align="center" prop="employeeCode" width="100" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
        <el-table-column label="门店/组别" align="center" prop="deptName" min-width="150" show-overflow-tooltip />
        <el-table-column label="总积分" align="center" prop="totalPoints" width="90" />
        <el-table-column label="出勤(天)" align="center" prop="attendDays" width="80" />
        <el-table-column label="平均积分" align="center" prop="avgPoints" width="90">
          <template #default="{ row }">{{ row.avgPoints ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="绩效等级" align="center" prop="grade" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.grade" :type="gradeTagType(row.grade)" effect="plain">{{ row.grade }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="提成扣点" align="center" prop="deductRate" width="90">
          <template #default="{ row }">
            <span v-if="row.deductRate != null">{{ (Number(row.deductRate) * 100).toFixed(0) }}%</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        class="pagination-wrap"
        layout="total, sizes, prev, pager, next, jumper"
        @pagination="getList"
      />
    </el-card>

    <!-- 审批单详情（提交后可自查扣点行；也从「我的待办」跳转进入） -->
    <el-dialog v-model="approvalDetailVisible" title="积分月度审批详情" width="960px" append-to-body destroy-on-close>
      <ScoreApprovalDetail v-if="approvalDetailId" :business-id="approvalDetailId" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance } from 'element-plus';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreApproval, ScoreQuery, ScoreRecord } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import ScoreApprovalDetail from '@/components/WorkflowHandle/details/ScoreApprovalDetail.vue';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useDeptScope } from '@/hooks/useDeptScope';

// ==================== 查询 ====================
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const scoreList = ref<ScoreRecord[]>([]);
const total = ref(0);

// 门店/组别筛选：全系统统一数据权限口径（useDeptScope：默认本部门、树裁剪为子树、不可清空）
const { deptLocked, defaultDeptId, deptTreeData, loadDeptTree } = useDeptScope();

/** 积分期间（yyyy-MM，单月必选）：列表查询与审批状态共用同一期间 */
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const period = ref<string>(currentPeriod());

const queryParams = reactive<ScoreQuery>({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: defaultDeptId(),
  monthStart: undefined,
  monthEnd: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    // 单月期间：起止都传所选月 1 日
    const monthFirst = `${period.value}-01`;
    const res = await scoreApi.list({
      ...queryParams,
      monthStart: monthFirst,
      monthEnd: monthFirst
    });
    scoreList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询积分汇总失败');
  } finally {
    loading.value = false;
  }
};

/** 切换期间：列表与审批状态联动刷新 */
const handlePeriodChange = () => {
  queryParams.pageNum = 1;
  getList();
  loadApproval();
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  period.value = currentPeriod();
  queryParams.deptId = defaultDeptId();
  handlePeriodChange();
};

// ==================== 绩效等级展示 ====================
const gradeTagType = (grade: string): 'success' | 'warning' | 'danger' => {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'warning';
  return 'danger';
};

// ==================== 积分审批 ====================
const approvalInfo = ref<ScoreApproval>({ period: period.value });
const approvalLoading = ref(false);

const APPROVAL_TAG: Record<string, { label: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { label: '待提交', type: 'info' },
  SUBMITTED: { label: '审批中', type: 'warning' },
  APPROVED: { label: '总监已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' }
};

const approvalTagLabel = computed(() => APPROVAL_TAG[approvalInfo.value.status ?? 'DRAFT']?.label ?? '待提交');
const approvalTagType = computed(() => APPROVAL_TAG[approvalInfo.value.status ?? 'DRAFT']?.type ?? 'info');

const loadApproval = async () => {
  try {
    const res = await scoreApi.getApproval(period.value);
    approvalInfo.value = res.data ?? { period: period.value };
  } catch {
    approvalInfo.value = { period: period.value };
  }
};

const handleSubmitApproval = async () => {
  try {
    await modal.confirm(`确认将 ${period.value} 积分提交总监审批？提交后该期间积分将锁定，总监通过（或 24 小时未审自动通过）后方可进入算薪。`);
  } catch {
    return;
  }
  approvalLoading.value = true;
  try {
    const res = await scoreApi.submitApproval(period.value);
    modal.msgSuccess(res.msg || '已提交总监审批');
    await loadApproval();
  } catch (e: any) {
    modal.msgError(e?.message || '提交失败');
  } finally {
    approvalLoading.value = false;
  }
};

// ==================== 审批单详情（工作流办理/跳转共用） ====================
const approvalDetailVisible = ref(false);
const approvalDetailId = ref<string | number>('');

const openApprovalDetail = () => {
  if (!approvalInfo.value.id) return;
  approvalDetailId.value = approvalInfo.value.id;
  approvalDetailVisible.value = true;
};

// 「我的待办 → 查看业务表单」跳转到本页时，按 query.id 自动打开审批单详情
const route = useRoute();
const openFromWorkflow = () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  approvalDetailId.value = id;
  approvalDetailVisible.value = true;
};
useWorkflowRouteOpen('/people/score', openFromWorkflow);

onMounted(() => {
  getList();
  loadDeptTree();
  loadApproval();
});
</script>

<style lang="scss" scoped>
.people-score-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .toolbar-shell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .table-heading {
    h3 {
      margin: 2px 0 4px;
      font-size: 16px;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .panel-kicker {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--el-color-primary);
  }

  .approval-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-right: 12px;
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
