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
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row as PayrollBatch)">明细</el-button>
              <!-- 审批通过/驳回/锁定已收敛到「我的待办」（payroll_batch 工作流节点办理），
                   业务页仅保留算薪/提交/发放动作，按状态平铺 -->
              <el-button v-if="canCalc(row.status)" link type="primary" @click="doAction(row as PayrollBatch, 'calculate')">算薪</el-button>
              <el-button v-if="row.status === 'CALCULATED'" link type="success" @click="doAction(row as PayrollBatch, 'submit')">提交审批</el-button>
              <el-button v-if="row.status === 'LOCKED'" link type="warning" @click="doAction(row as PayrollBatch, 'pay')">标记发放</el-button>
            </div>
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
          <span class="scope-text">全部门店</span>
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
import { attendanceApi } from '@/api/panjia/attendance';
import { scoreApi } from '@/api/panjia/score';
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
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger';
const STATUS_TAG: Record<string, TagType> = {
  DRAFT: 'info', CALCULATING: 'warning', CALCULATED: 'primary', FAILED: 'danger',
  REVIEWING: 'warning', APPROVED: 'success', LOCKED: 'success', PAID: 'success',
};

const statusLabel = (s: string) => STATUS_LABEL[s] || s;
const statusTag = (s: string): TagType => STATUS_TAG[s] || 'info';
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
    // 无考勤/无积分确认：该月无记录时对应扣款/扣点按默认值（考勤扣款 0、积分默认 A 不扣点），
    // 防人事漏导考勤或积分日报导致算薪口径失真
    const approvalRes: any = await attendanceApi.getApproval(createForm.value.period);
    if (approvalRes.data?.dataExists === false) {
      const confirmed = await ElMessageBox.confirm(
        `${createForm.value.period} 无考勤数据，考勤扣款将为 0。可能是人事漏导考勤，确认继续创建批次？`,
        '无考勤确认',
        { type: 'warning', confirmButtonText: '继续创建', cancelButtonText: '取消' }
      ).then(() => true).catch(() => false);
      if (!confirmed) return;
    }
    const scoreRes: any = await scoreApi.getApproval(createForm.value.period);
    if (scoreRes.data?.dataExists === false) {
      const confirmed = await ElMessageBox.confirm(
        `${createForm.value.period} 无积分数据，绩效等级将默认 A（不扣点）。可能是人事漏导积分日报，确认继续创建批次？`,
        '无积分确认',
        { type: 'warning', confirmButtonText: '继续创建', cancelButtonText: '取消' }
      ).then(() => true).catch(() => false);
      if (!confirmed) return;
    }
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
  const labelMap: Record<string, string> = { calculate: '算薪', submit: '提交审核', pay: '标记发放' };
  const label = labelMap[action];
  if (action === 'pay') {
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
    const moneyProps = ['commissionIncome', 'teamIncome', 'guaranteeFill', 'storeIncome', 'baseSalary', 'mentorBonus', 'bonus', 'gross', 'socialFee', 'housingFund', 'attendanceFee', 'commercialInsurance', 'otherDeduct', 'deduct', 'tax', 'net'];
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

.table-actions {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.scope-text {
  color: var(--el-text-color-regular);
}
</style>
