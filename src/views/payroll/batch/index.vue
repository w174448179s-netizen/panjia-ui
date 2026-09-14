<template>
  <div class="payroll-batch">
    <el-card class="mb-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">工资批次管理</h3>
        <div class="flex items-center gap-3">
          <el-date-picker
            v-model="filterPeriod"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择归属月"
            clearable
            @change="loadBatches"
          />
          <el-button type="primary" @click="showCreate = true">+ 创建批次</el-button>
        </div>
      </div>

      <el-table :data="batches" stripe border>
        <el-table-column label="归属月" prop="period" width="110" />
        <el-table-column label="范围" prop="deptScope" width="90" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人数" prop="employeeCount" width="70" align="center" />
        <el-table-column label="应发合计" prop="grossTotal" width="130" align="right">
          <template #default="{ row }">{{ fmt(row.grossTotal) }}</template>
        </el-table-column>
        <el-table-column label="实发合计" prop="netTotal" width="130" align="right">
          <template #default="{ row }">{{ fmt(row.netTotal) }}</template>
        </el-table-column>
        <el-table-column label="算薪次数" prop="attempt" width="80" align="center" />
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="明细" placement="top">
              <el-button link type="primary" icon="View" @click="viewDetail(row)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="canCalc(row.status)" content="算薪" placement="top">
              <el-button link type="warning" icon="Calculator" @click="doAction(row, 'calculate')"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'CALCULATED'" content="提交" placement="top">
              <el-button link type="primary" icon="Upload" @click="doAction(row, 'submit')"></el-button>
            </el-tooltip>
            <!-- 审批/驳回按权限码收口：payroll:batch:approve / :reject 仅授予总监，
                 财务与店长不显示入口（后端 @SaCheckPermission 同步拦截越权调用） -->
            <el-tooltip v-if="row.status === 'REVIEWING' && checkPermi(['payroll:batch:approve'])" content="通过" placement="top">
              <el-button link type="success" icon="CircleCheck" @click="doAction(row, 'approve')"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'REVIEWING' && checkPermi(['payroll:batch:reject'])" content="驳回" placement="top">
              <el-button link type="danger" icon="CircleClose" @click="doAction(row, 'reject')"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'APPROVED'" content="锁定" placement="top">
              <el-button link type="success" icon="Lock" @click="doAction(row, 'lock')"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'LOCKED'" content="标记发放" placement="top">
              <el-button link type="primary" icon="Money" @click="doAction(row, 'pay')"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 工资明细 -->
    <el-card v-if="currentBatch">
      <template #header>
        <div class="flex items-center justify-between">
          <span>工资明细 — {{ currentBatch.period }}（{{ statusLabel(currentBatch.status) }}）</span>
          <el-button text @click="closeDetail">关闭</el-button>
        </div>
      </template>
      <el-table :data="details" stripe border max-height="600" :summary-method="summaryMethod" show-summary>
        <el-table-column label="工号" width="120">
          <template #default="{ row }">{{ empName(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column label="职级" prop="levelCode" width="70" />
        <el-table-column label="角色" width="80">
          <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
        </el-table-column>
        <el-table-column label="业绩提成" prop="commissionIncome" width="110" align="right">
          <template #default="{ row }">{{ fmt(row.commissionIncome) }}</template>
        </el-table-column>
        <el-table-column label="团队提成" prop="teamIncome" width="100" align="right">
          <template #default="{ row }">{{ fmt(row.teamIncome) }}</template>
        </el-table-column>
        <el-table-column label="保底补足" prop="guaranteeFill" width="100" align="right">
          <template #default="{ row }">{{ fmt(row.guaranteeFill) }}</template>
        </el-table-column>
        <el-table-column label="门店提成" prop="storeIncome" width="100" align="right">
          <template #default="{ row }">{{ fmt(row.storeIncome) }}</template>
        </el-table-column>
        <el-table-column label="底薪" prop="baseSalary" width="90" align="right">
          <template #default="{ row }">{{ fmt(row.baseSalary) }}</template>
        </el-table-column>
        <el-table-column label="招聘奖" prop="mentorBonus" width="90" align="right">
          <template #default="{ row }">{{ fmt(row.mentorBonus) }}</template>
        </el-table-column>
        <el-table-column label="奖金" prop="bonus" width="90" align="right">
          <template #default="{ row }">{{ fmt(row.bonus) }}</template>
        </el-table-column>
        <el-table-column label="应发" prop="gross" width="110" align="right">
          <template #default="{ row }"><b>{{ fmt(row.gross) }}</b></template>
        </el-table-column>
        <el-table-column label="社保" prop="socialFee" width="90" align="right">
          <template #default="{ row }">{{ fmt(row.socialFee) }}</template>
        </el-table-column>
        <el-table-column label="公积金" prop="housingFund" width="80" align="right">
          <template #default="{ row }">{{ fmt(row.housingFund) }}</template>
        </el-table-column>
        <el-table-column label="考勤" prop="attendanceFee" width="80" align="right">
          <template #default="{ row }">{{ fmt(row.attendanceFee) }}</template>
        </el-table-column>
        <el-table-column label="积分" prop="pointsFee" width="70" align="right">
          <template #default="{ row }">{{ fmt(row.pointsFee) }}</template>
        </el-table-column>
        <el-table-column label="商保" prop="commercialInsurance" width="70" align="right">
          <template #default="{ row }">{{ fmt(row.commercialInsurance) }}</template>
        </el-table-column>
        <el-table-column label="其他扣" prop="otherDeduct" width="80" align="right">
          <template #default="{ row }">{{ fmt(row.otherDeduct) }}</template>
        </el-table-column>
        <el-table-column label="支出合计" prop="deduct" width="100" align="right">
          <template #default="{ row }">{{ fmt(row.deduct) }}</template>
        </el-table-column>
        <el-table-column label="个税" prop="tax" width="80" align="right">
          <template #default="{ row }">{{ fmt(row.tax) }}</template>
        </el-table-column>
        <el-table-column label="最终发放" prop="net" width="120" align="right">
          <template #default="{ row }"><b class="text-primary">{{ fmt(row.net) }}</b></template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建批次弹窗 -->
    <el-dialog v-model="showCreate" title="创建工资批次" width="420px">
      <el-form label-width="80px">
        <el-form-item label="归属月">
          <el-date-picker v-model="createForm.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="范围">
          <el-select v-model="createForm.deptScope" style="width:100%">
            <el-option label="全部门店" value="ALL" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createBatch">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { payrollApi, type PayrollBatch, type PayrollDetail } from '@/api/panjia/payroll';
import { checkPermi } from '@/utils/permission';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const batches = ref<PayrollBatch[]>([]);
const details = ref<PayrollDetail[]>([]);
const currentBatch = ref<PayrollBatch | null>(null);
const filterPeriod = ref('');
const showCreate = ref(false);
const creating = ref(false);
const createForm = ref({ period: '', deptScope: 'ALL' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CALCULATING: '计算中', CALCULATED: '已计算', FAILED: '失败',
  REVIEWING: '待审核', APPROVED: '已确认', LOCKED: '已锁定', PAID: '已发放',
};
const STATUS_TAG: Record<string, string> = {
  DRAFT: 'info', CALCULATING: 'warning', CALCULATED: '', FAILED: 'danger',
  REVIEWING: 'warning', APPROVED: 'success', LOCKED: 'success', PAID: 'success',
};

const statusLabel = (s: string) => STATUS_LABEL[s] || s;
const statusTag = (s: string) => STATUS_TAG[s] || 'info';
const canCalc = (s: string) => ['DRAFT', 'CALCULATED', 'FAILED', 'REVIEWING'].includes(s);
const roleLabel = (r: string) => ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r);
const fmt = (n: number | null) => (n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const empName = (id: number) => String(id);

const loadBatches = async () => {
  const res = await payrollApi.listBatches(filterPeriod.value || undefined);
  batches.value = (res as any).data ?? [];
};

const createBatch = async () => {
  if (!createForm.value.period) {
    ElMessage.warning('请选择归属月');
    return;
  }
  creating.value = true;
  try {
    await payrollApi.createBatch(createForm.value);
    showCreate.value = false;
    createForm.value = { period: '', deptScope: 'ALL' };
    ElMessage.success('批次已创建');
    loadBatches();
  } finally {
    creating.value = false;
  }
};

const doAction = async (row: PayrollBatch, action: string) => {
  const labelMap: Record<string, string> = { calculate: '算薪', submit: '提交审核', approve: '审批通过', reject: '驳回', lock: '锁定', pay: '标记发放' };
  const label = labelMap[action];
  if (['approve', 'lock', 'pay'].includes(action)) {
    try {
      await ElMessageBox.confirm(`确认${label}批次「${row.period}」？`, '提示', { type: 'warning' });
    } catch {
      return;
    }
  }
  try {
    await (payrollApi as any)[action](row.id);
    ElMessage.success(`${label}成功`);
    loadBatches();
    if (currentBatch.value?.id === row.id) viewDetail(row);
  } catch (e) {
    /* 拦截器处理 */
  }
};

const viewDetail = async (row: PayrollBatch) => {
  currentBatch.value = row;
  const res = await payrollApi.getDetails(row.id);
  details.value = (res as any).data ?? [];
};

const closeDetail = () => {
  currentBatch.value = null;
  details.value = [];
};

// 工作流跳转：查看态加载批次与明细（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  try {
    const res: any = await payrollApi.getBatch(Number(id));
    currentBatch.value = res.data;
    const detRes = await payrollApi.getDetails(Number(id));
    details.value = (detRes as any).data ?? [];
  } catch {
    ElMessage.error('加载批次失败');
  }
};

const summaryMethod = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    const moneyProps = ['commissionIncome', 'teamIncome', 'guaranteeFill', 'storeIncome', 'baseSalary', 'mentorBonus', 'bonus', 'gross', 'socialFee', 'housingFund', 'attendanceFee', 'pointsFee', 'commercialInsurance', 'otherDeduct', 'deduct', 'tax', 'net'];
    if (moneyProps.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/payroll/batch', openFromWorkflow);

onMounted(() => {
  loadBatches();
});
</script>

<style scoped>
.payroll-batch { padding: 12px; }
</style>
