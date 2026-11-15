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
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            width="200px"
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
            <p>共 {{ total }} 条记录，一员工一月一行；来自积分日报导入聚合，平均分 = 总积分 / 考勤出勤天数（已扣除随心假、年假、产假等免考核假期；考勤缺失时回退积分填报天数）。</p>
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
            <el-button
              v-hasPermi="['people:score:add']"
              type="primary"
              plain
              icon="Plus"
              @click="openCreate"
            >
              新增积分
            </el-button>
            <el-button type="success" plain icon="Upload" @click="importOpen = true">导入积分</el-button>
            <el-button
              v-hasPermi="['dingtalk:sync:score']"
              type="primary"
              plain
              icon="Star"
              @click="syncOpen = true"
            >
              钉钉同步
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="scoreList">
        <el-table-column label="积分期间" align="center" prop="scoreMonth" width="110">
          <template #default="{ row }">{{ row.scoreMonth?.slice(0, 7) ?? '—' }}</template>
        </el-table-column>
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
        <el-table-column label="晚提交次数" align="center" prop="lateSubmitCount" width="100">
          <template #default="{ row }">{{ row.lateSubmitCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="积分扣款(元)" align="center" prop="pointsFee" width="110">
          <template #default="{ row }">{{ row.pointsFee ? Number(row.pointsFee).toFixed(2) : '0.00' }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row as ScoreRecord)">
              详情
            </el-button>
            <el-tooltip
              :disabled="!row.locked"
              content="该期间已提交审批或已通过，无法修改"
              placement="top"
            >
              <el-button
                link
                type="primary"
                size="small"
                :disabled="row.locked"
                @click="openEdit(row as ScoreRecord)"
              >
                修改
              </el-button>
            </el-tooltip>
            <el-tooltip
              :disabled="!row.locked"
              content="该期间已提交审批或已通过，无法删除"
              placement="top"
            >
              <el-button
                v-hasPermi="['people:score:remove']"
                link
                type="danger"
                size="small"
                :disabled="row.locked"
                @click="handleDelete(row as ScoreRecord)"
              >
                删除
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        class="pagination-wrap"
        @pagination="getList"
      />
    </el-card>

    <!-- 审批单详情（提交后可自查扣点行；也从「我的待办」跳转进入） -->
    <el-dialog v-model="approvalDetailVisible" title="积分月度审批详情" width="960px" append-to-body destroy-on-close>
      <ScoreApprovalDetail v-if="approvalDetailId" :business-id="approvalDetailId" />
    </el-dialog>

    <!-- 手工新增积分记录（补录/修正）：同员工同月份唯一，导入同步会覆盖 MANUAL 记录 -->
    <el-dialog v-model="createOpen" title="新增积分" width="460px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="员工" required>
          <EmployeeSelect v-model="createForm.employeeId" placeholder="请选择员工" />
        </el-form-item>
        <el-form-item label="积分期间" required>
          <el-date-picker v-model="createForm.scoreMonth" type="month" value-format="YYYY-MM" placeholder="请选择月份" style="width: 100%" />
          <div v-if="createPeriodLocked" class="edit-tip" style="color: var(--el-color-danger)">
            该期间积分已提交审批或已通过，处于锁定状态，不可新增
          </div>
        </el-form-item>
        <el-form-item label="总积分" required>
          <el-input-number v-model="createForm.totalPoints" :min="0" :max="100000" :precision="0" controls-position="right" style="width: 180px" />
        </el-form-item>
        <el-form-item label="出勤天数" required>
          <el-input-number v-model="createForm.attendDays" :min="0" :max="31" :precision="0" controls-position="right" style="width: 180px" />
        </el-form-item>
        <el-form-item label="晚提交次数" required>
          <el-input-number v-model="createForm.lateSubmitCount" :min="0" :max="99" :precision="0" controls-position="right" style="width: 180px" />
          <div class="edit-tip">扣款 = 次数 × 晚提交罚款单价（政策规则可配）</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="createSaving" :disabled="createPeriodLocked" @click="saveCreate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改积分原始事实（总积分/出勤天数/晚提交次数）；平均积分/等级/扣点/扣款由后端实时重算 -->
    <el-dialog v-model="editOpen" title="修改积分记录" width="440px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="工号/姓名">
          <span>{{ editForm.employeeCode }} / {{ editForm.employeeName }}</span>
        </el-form-item>
        <el-form-item label="总积分" required>
          <el-input-number v-model="editForm.totalPoints" :min="0" :max="100000" :precision="0" controls-position="right" style="width: 180px" />
        </el-form-item>
        <el-form-item label="出勤天数" required>
          <el-input-number v-model="editForm.attendDays" :min="0" :max="31" :precision="0" controls-position="right" style="width: 180px" />
        </el-form-item>
        <el-form-item label="晚提交次数" required>
          <el-input-number v-model="editForm.lateSubmitCount" :min="0" :max="99" :precision="0" controls-position="right" style="width: 180px" />
          <div class="edit-tip">经总监同意可调整（豁免处罚）；扣款 = 次数 × 晚提交罚款单价（政策规则可配）</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 积分每日明细：导入/钉钉同步落库的每日数据 -->
    <el-dialog v-model="detailOpen" :title="detailTitle" width="820px" append-to-body destroy-on-close>
      <div v-loading="detailLoading">
        <div class="detail-summary">
          <span>明细天数 <b>{{ detailList.length }}</b></span>
          <span>计入积分 <b>{{ detailSummary.points }}</b></span>
          <span>晚提交 <b>{{ detailSummary.late }}</b></span>
          <span>不计入 <b>{{ detailSummary.invalid }}</b></span>
        </div>
        <el-table
          border
          size="small"
          :data="detailList"
          max-height="460"
          empty-text="该月暂无积分明细（可能未同步或未导入）"
        >
          <el-table-column label="日期" prop="pointDate" width="110" align="center" />
          <el-table-column label="填报时间" width="170" align="center">
            <template #default="{ row }">{{ formatTime(row.submitTime) }}</template>
          </el-table-column>
          <el-table-column label="当日积分" prop="score" width="90" align="center">
            <template #default="{ row }">{{ row.score ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="是否计入" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isValid ? 'success' : 'info'" effect="plain">
                {{ row.isValid ? '计入' : '不计入' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="晚提交" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isLateSubmit" type="warning" effect="plain">晚提交</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="120" align="center">
            <template #default="{ row }">
              <span v-if="!row.isValid">窗口外提交，不计积分（计 0）</span>
              <span v-else-if="row.isLateSubmit">晚提交，计积分并记晚提交</span>
              <span v-else>窗口内提交</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 积分导入入口：整体复用导入页组件（自带归属月/上传/批次管理），关闭后刷新汇总列表 -->
    <el-dialog v-model="importOpen" title="积分数据导入" width="1080px" append-to-body destroy-on-close @closed="getList">
      <ImportScorePage />
    </el-dialog>

    <!-- 钉钉同步入口：默认同步当前筛选的积分期间 -->
    <el-dialog v-model="syncOpen" title="钉钉积分同步" width="1080px" append-to-body destroy-on-close>
      <DingTalkSyncPanel type="SCORE" :default-period="period" embedded @finished="handleSynced" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance } from 'element-plus';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreApproval, ScoreDetail, ScoreQuery, ScoreRecord } from '@/api/panjia/types';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import modal from '@/plugins/modal';
import ScoreApprovalDetail from '@/components/WorkflowHandle/details/ScoreApprovalDetail.vue';
import ImportScorePage from '@/views/import/score/index.vue';
import DingTalkSyncPanel from '@/views/people/dingtalk/components/DingTalkSyncPanel.vue';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useDeptScope } from '@/hooks/useDeptScope';

// ==================== 查询 ====================
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const scoreList = ref<ScoreRecord[]>([]);
const total = ref(0);

/** 积分导入弹窗（内嵌导入页组件） */
const importOpen = ref(false);

/** 钉钉同步弹窗（默认同步当前筛选期间） */
const syncOpen = ref(false);

// 门店/组别筛选：全系统统一数据权限口径（useDeptScope：默认本部门、树裁剪为子树、不可清空）
const { deptLocked, defaultDeptId } = useDeptScope();

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

// ==================== 手工新增 / 删除 ====================
const createOpen = ref(false);
const createSaving = ref(false);
const createForm = reactive({
  employeeId: '' as string | number,
  scoreMonth: currentPeriod(),
  totalPoints: 0,
  attendDays: 0,
  lateSubmitCount: 0
});

const openCreate = () => {
  createForm.employeeId = '';
  createForm.scoreMonth = currentPeriod();
  createForm.totalPoints = 0;
  createForm.attendDays = 0;
  createForm.lateSubmitCount = 0;
  createOpen.value = true;
  checkCreatePeriodLocked();
};

// 期间锁定校验：已提交审批/已通过的期间禁止新增（与修改/删除口径一致）
const createPeriodLocked = ref(false);
const checkCreatePeriodLocked = async () => {
  if (!createForm.scoreMonth) {
    createPeriodLocked.value = false;
    return;
  }
  try {
    const res = await scoreApi.getApproval(createForm.scoreMonth);
    const st = res.data?.status;
    createPeriodLocked.value = st === 'SUBMITTED' || st === 'APPROVED';
  } catch {
    createPeriodLocked.value = false;
  }
};
watch(() => createForm.scoreMonth, checkCreatePeriodLocked);

const saveCreate = async () => {
  if (!createForm.employeeId) {
    modal.msgWarning('请选择员工');
    return;
  }
  if (!createForm.scoreMonth) {
    modal.msgWarning('请选择积分期间');
    return;
  }
  if (createPeriodLocked.value) {
    modal.msgWarning('该期间积分已提交审批或已通过，处于锁定状态，不可新增');
    return;
  }
  if (createForm.attendDays === 0) {
    modal.msgWarning('出勤天数为 0 时平均积分/绩效等级为空，算薪默认 A 级不扣点');
  }
  createSaving.value = true;
  try {
    const res = await scoreApi.create({
      employeeId: createForm.employeeId,
      scoreMonth: createForm.scoreMonth,
      totalPoints: createForm.totalPoints,
      attendDays: createForm.attendDays,
      lateSubmitCount: createForm.lateSubmitCount
    });
    modal.msgSuccess(res.msg || '已新增积分记录');
    createOpen.value = false;
    await getList();
    await loadApproval();
  } catch (e: any) {
    modal.msgError(e?.message || '新增失败');
  } finally {
    createSaving.value = false;
  }
};

const handleDelete = async (row: ScoreRecord) => {
  const ok = await modal.confirm(`确认删除 ${row.employeeName ?? ''}（${row.scoreMonth?.slice(0, 7)}）的积分记录吗？`);
  if (!ok) return;
  try {
    const res = await scoreApi.remove(row.id);
    modal.msgSuccess(res.msg || '已删除积分记录');
    await getList();
    await loadApproval();
  } catch (e: any) {
    modal.msgError(e?.message || '删除失败');
  }
};

// ==================== 修改原始事实（总积分/出勤天数/晚提交次数） ====================
const editOpen = ref(false);
const editSaving = ref(false);
const editForm = reactive({
  id: '' as string | number,
  employeeCode: '',
  employeeName: '',
  totalPoints: 0,
  attendDays: 0,
  lateSubmitCount: 0
});

const openEdit = (row: ScoreRecord) => {
  editForm.id = row.id;
  editForm.employeeCode = row.employeeCode ?? '';
  editForm.employeeName = row.employeeName ?? '';
  editForm.totalPoints = Number(row.totalPoints ?? 0);
  editForm.attendDays = row.attendDays ?? 0;
  editForm.lateSubmitCount = row.lateSubmitCount ?? 0;
  editOpen.value = true;
};

const saveEdit = async () => {
  if (editForm.attendDays === 0) {
    modal.msgWarning('出勤天数为 0 时平均积分/绩效等级为空，算薪默认 A 级不扣点');
  }
  editSaving.value = true;
  try {
    const res = await scoreApi.update(editForm.id, {
      totalPoints: editForm.totalPoints,
      attendDays: editForm.attendDays,
      lateSubmitCount: editForm.lateSubmitCount
    });
    modal.msgSuccess(res.msg || '已修改积分记录');
    editOpen.value = false;
    await getList();
    await loadApproval();
  } catch (e: any) {
    modal.msgError(e?.message || '修改失败');
  } finally {
    editSaving.value = false;
  }
};

// ==================== 每日明细（详情） ====================
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailList = ref<ScoreDetail[]>([]);
const detailTitle = ref('积分明细');

const detailSummary = computed(() => {
  let points = 0;
  let late = 0;
  let invalid = 0;
  for (const item of detailList.value) {
    if (item.isValid) {
      points += Number(item.score ?? 0);
    } else {
      invalid += 1;
    }
    if (item.isLateSubmit) late += 1;
  }
  return { points, late, invalid };
});

const formatTime = (value?: string) => (value ? value.replace('T', ' ').slice(0, 19) : '—');

const openDetail = async (row: ScoreRecord) => {
  const month = row.scoreMonth?.slice(0, 7) ?? '';
  detailTitle.value = `积分明细 · ${row.employeeName ?? ''}（${row.employeeCode ?? '—'}）· ${month}`;
  detailList.value = [];
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const res = await scoreApi.details(row.employeeId, month);
    detailList.value = res.data ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '查询积分明细失败');
  } finally {
    detailLoading.value = false;
  }
};

/** 钉钉同步完成后刷新当前期间的积分列表与审批状态 */
const handleSynced = () => {
  getList();
  loadApproval();
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

  .edit-tip {
    width: 100%;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }

  .detail-summary {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    font-size: 13px;
    color: var(--el-text-color-regular);

    b {
      margin-left: 4px;
      color: var(--el-color-primary);
      font-size: 14px;
    }
  }
}
</style>
