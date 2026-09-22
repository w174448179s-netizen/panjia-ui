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

    <!-- 工资明细弹窗（三 sheet 页：工资表 28 列含经纪人+店长 / 店长工资 15 列 / 总监工资 19 列一人多行） -->
    <el-dialog
      v-model="detailVisible"
      :title="`工资明细 — ${currentBatch?.period || ''}（${currentBatch ? statusLabel(currentBatch.status) : ''}）`"
      width="96%"
      top="3vh"
      destroy-on-close
      @closed="closeDetail"
    >
      <div v-if="currentBatch" class="detail-toolbar">
        <el-button :disabled="!details.length" @click="exportExcel">
          <el-icon><Download /></el-icon>&nbsp;导出（三 sheet）
        </el-button>
      </div>
      <el-tabs v-model="detailTab" class="detail-tabs">
        <!-- ══════════ 工资表 sheet（28 列，含经纪人 + 店长） ══════════ -->
        <el-tab-pane label="工资表" name="AGENT">
          <el-table :data="salaryDetails" stripe border max-height="600" :summary-method="summaryMethod" show-summary>
            <el-table-column label="门店" prop="deptName" width="110" fixed="left" />
            <el-table-column label="员工编号" prop="employeeCode" width="90" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="职级" prop="levelCode" width="60" />
            <el-table-column label="职位" width="70">
              <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
            </el-table-column>
            <el-table-column label="当月新签业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.newSignPerformance) }}</template>
            </el-table-column>
            <el-table-column label="新签业绩提成比例" width="130" align="right">
              <template #default="{ row }">{{ row.newSignRate != null ? ratePercent(row.newSignRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="绩效提成扣点" width="110" align="right">
              <template #default="{ row }">{{ row.perfDeduct != null ? ratePercent(row.perfDeduct) : '' }}</template>
            </el-table-column>
            <el-table-column label="个人提点奖励" width="110" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="最终提成比例" width="110" align="right">
              <template #default="{ row }">{{ row.finalRate != null ? ratePercent(row.finalRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="结佣业绩" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionPerformance) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.finalRate != null ? ratePercent(row.finalRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="提成金额" prop="commissionIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionIncome) }}</template>
            </el-table-column>
            <el-table-column label="招聘奖励" prop="mentorBonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="底薪" width="90" align="right">
              <template #default="{ row }">{{ num(baseSalaryOf(row)) }}</template>
            </el-table-column>
            <el-table-column label="绩效" prop="bonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.bonus) }}</template>
            </el-table-column>
            <el-table-column label="考勤扣款" width="90" align="right">
              <template #default="{ row }">{{ neg(row.attendanceFee) }}</template>
            </el-table-column>
            <el-table-column label="积分扣款" prop="pointsFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.pointsFee) }}</template>
            </el-table-column>
            <el-table-column label="应发工资" prop="gross" width="110" align="right">
              <template #default="{ row }"><b>{{ num(row.gross) }}</b></template>
            </el-table-column>
            <el-table-column label="社保扣款" prop="socialFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.socialFee) }}</template>
            </el-table-column>
            <el-table-column label="公积金扣款" prop="housingFund" width="100" align="right">
              <template #default="{ row }">{{ neg(row.housingFund) }}</template>
            </el-table-column>
            <el-table-column label="往月负工资" width="100" align="right">
              <template #default="{ row }">{{ neg(Math.abs(Number(row.negativeCarryover) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="商业保险" prop="commercialInsurance" width="90" align="right">
              <template #default="{ row }">{{ neg(row.commercialInsurance) }}</template>
            </el-table-column>
            <el-table-column label="宿舍管理费" prop="dormitoryFee" width="100" align="right">
              <template #default="{ row }">{{ neg(row.dormitoryFee) }}</template>
            </el-table-column>
            <el-table-column label="工资合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.gross) || 0) - (Number(row.deduct) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="实发工资" prop="net" width="110" align="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
            <el-table-column label="个税扣除" prop="tax" width="90" align="right">
              <template #default="{ row }">{{ neg(row.tax) }}</template>
            </el-table-column>
            <el-table-column label="最终发放" prop="net" width="120" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ══════════ 店长工资 sheet（15 列，底薪计算与补齐依据，对齐天街工资表 店长工资 sheet） ══════════ -->
        <el-tab-pane label="店长" name="MANAGER">
          <el-table :data="managerDetails" stripe border max-height="600" :summary-method="managerSummary" show-summary>
            <el-table-column label="门店" prop="deptName" width="110" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="职级" prop="levelCode" width="60" />
            <el-table-column label="新签团队业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.deptNewSignTotal) }}</template>
            </el-table-column>
            <el-table-column label="社保业绩扣款" width="120" align="right">
              <template #default="{ row }">{{ neg(row.deptEmployerSocialTotal) }}</template>
            </el-table-column>
            <el-table-column label="新签与结佣差额" width="130" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.commissionPerformance) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="团队计薪业绩" width="120" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.deptEmployerSocialTotal) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.teamRate != null ? ratePercent(row.teamRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="团队提成金额" prop="teamIncome" width="120" align="right">
              <template #default="{ row }">{{ num(row.teamIncome) }}</template>
            </el-table-column>
            <el-table-column label="当月个人新签业绩提成" prop="personalNewsignIncome" width="160" align="right">
              <template #default="{ row }">{{ num(row.personalNewsignIncome) }}</template>
            </el-table-column>
            <el-table-column label="合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.teamIncome) || 0) + (Number(row.personalNewsignIncome) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="保底" prop="minSalary" width="90" align="right">
              <template #default="{ row }">{{ num(row.minSalary) }}</template>
            </el-table-column>
            <el-table-column label="补足8000部分" prop="guaranteeFill" width="120" align="right">
              <template #default="{ row }">{{ num(row.guaranteeFill) }}</template>
            </el-table-column>
            <el-table-column label="其他扣款" prop="otherDeduct" width="100" align="right">
              <template #default="{ row }">{{ neg(row.otherDeduct) }}</template>
            </el-table-column>
            <el-table-column label="店长工资" prop="gross" width="110" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(baseSalaryOf(row)) }}</b></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ══════════ 总监工资 sheet（19 列，树形可展开：汇总行+门店明细子行，对齐天街工资表 总监工资 sheet） ══════════ -->
        <el-tab-pane label="总监" name="DIRECTOR">
          <el-table :data="directorTreeData" border max-height="600" :summary-method="directorSummary" show-summary
            row-key="_id" :tree-props="{ children: 'children' }" default-expand-all>
            <el-table-column label="姓名" prop="employeeName" width="90" fixed="left" />
            <el-table-column label="组别" prop="deptName" width="120" fixed="left" />
            <el-table-column label="新签业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.deptNewSignTotal) }}</template>
            </el-table-column>
            <el-table-column label="社保业绩" width="110" align="right">
              <template #default="{ row }">{{ neg(row.deptEmployerSocialTotal) }}</template>
            </el-table-column>
            <el-table-column label="合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.deptEmployerSocialTotal) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.storeRate != null ? ratePercent(row.storeRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="提成金额" prop="storeIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.storeIncome) }}</template>
            </el-table-column>
            <el-table-column label="底薪" prop="baseSalary" width="90" align="right">
              <template #default="{ row }">{{ num(row.baseSalary) }}</template>
            </el-table-column>
            <el-table-column label="全勤" prop="fullAttendance" width="90" align="right">
              <template #default="{ row }">{{ num(row.fullAttendance) }}</template>
            </el-table-column>
            <el-table-column label="绩效" prop="bonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.bonus) }}</template>
            </el-table-column>
            <el-table-column label="结佣业绩" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionPerformance) }}</template>
            </el-table-column>
            <el-table-column label="业绩提成" prop="commissionIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionIncome) }}</template>
            </el-table-column>
            <el-table-column label="招聘提成" prop="mentorBonus" width="100" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="社保" prop="socialFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.socialFee) }}</template>
            </el-table-column>
            <el-table-column label="公积金" prop="housingFund" width="90" align="right">
              <template #default="{ row }">{{ neg(row.housingFund) }}</template>
            </el-table-column>
            <el-table-column label="商业保险" prop="commercialInsurance" width="100" align="right">
              <template #default="{ row }">{{ neg(row.commercialInsurance) }}</template>
            </el-table-column>
            <el-table-column label="应发工资" prop="gross" width="110" align="right">
              <template #default="{ row }"><b>{{ num(row.gross) }}</b></template>
            </el-table-column>
            <el-table-column label="个税" prop="tax" width="90" align="right">
              <template #default="{ row }">{{ neg(row.tax) }}</template>
            </el-table-column>
            <el-table-column label="实发工资" prop="net" width="110" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download } from '@element-plus/icons-vue';
import { payrollApi, type PayrollBatch, type PayrollDetail } from '@/api/panjia/payroll';
import { attendanceApi } from '@/api/panjia/attendance';
import { scoreApi } from '@/api/panjia/score';
import { exportMultiSheet, parseStoreItems } from '../components/payroll-export';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const batches = ref<PayrollBatch[]>([]);
const details = ref<PayrollDetail[]>([]);
const currentBatch = ref<PayrollBatch | null>(null);
const detailVisible = ref(false);
const detailTab = ref<'AGENT' | 'MANAGER' | 'DIRECTOR'>('AGENT');
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
const num = (v: any) => (v == null || v === '' ? '' : Number(v).toFixed(2));
const neg = (v: any) => {
  const n = Number(v) || 0;
  return n === 0 ? '' : (-n).toFixed(2);
};
const ratePercent = (v: any) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return `${(n * 100).toFixed(2)}%`;
};

/** 底薪：经纪人取 baseSalary，店长取 teamIncome + guaranteeFill（保底补足） */
const baseSalaryOf = (row: any): number => {
  if (row.employeeRole === 'MANAGER') {
    return (Number(row.teamIncome) || 0) + (Number(row.guaranteeFill) || 0);
  }
  return Number(row.baseSalary) || 0;
};

// 按角色分流到三 sheet（工资表含经纪人 + 店长，店长工资 sheet 仅用于底薪计算补齐）
const salaryDetails = computed(() => details.value.filter((r) => r.employeeRole === 'AGENT' || r.employeeRole === 'MANAGER'));
const managerDetails = computed(() => details.value.filter((r) => r.employeeRole === 'MANAGER'));
const directorDetails = computed(() => details.value.filter((r) => r.employeeRole === 'DIRECTOR'));

// 总监树形数据：汇总行 + 门店明细子行（可展开收起）
interface DirectorTreeNode extends PayrollDetail {
  children?: PayrollDetail[];
  _id: string;
  _isSummary?: boolean;
}
const directorTreeData = computed<DirectorTreeNode[]>(() => {
  return directorDetails.value.map((dir) => {
    const items = parseStoreItems(dir);
    const children = items.map((it) => ({
      ...dir,
      _id: `${dir.employeeId}-${it.deptId}`,
      employeeName: '',
      deptName: it.deptName || dir.deptName || '',
      deptNewSignTotal: Number(it.newSign) || 0,
      deptEmployerSocialTotal: Number(it.social) || 0,
      storeRate: Number(it.rate) || 0,
      storeIncome: Number(it.income) || 0,
      baseSalary: undefined,
      fullAttendance: undefined,
      bonus: undefined,
      commissionPerformance: undefined,
      commissionIncome: undefined,
      mentorBonus: undefined,
      socialFee: undefined,
      housingFund: undefined,
      commercialInsurance: undefined,
      gross: undefined,
      tax: undefined,
      net: undefined,
    } as DirectorTreeNode));
    return {
      ...dir,
      _id: `${dir.employeeId}`,
      _isSummary: true,
      deptName: items.length > 0 ? '汇总' : (dir.deptName || ''),
      children: children.length > 0 ? children : undefined,
    } as DirectorTreeNode;
  });
});

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
    if (currentBatch.value?.id === row.id && detailVisible.value) viewDetail(row);
  } catch (e) {
    /* 拦截器处理 */
  }
};

const viewDetail = async (row: PayrollBatch) => {
  currentBatch.value = row;
  detailVisible.value = true;
  const res = await payrollApi.getDetails(row.id);
  details.value = (res as any).data ?? [];
};

const closeDetail = () => {
  detailVisible.value = false;
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
    detailVisible.value = true;
  } catch {
    ElMessage.error('加载批次失败');
  }
};

const summaryMethod = ({ columns, data }: any) => {
  const sums: string[] = [];
  // 工资表 sheet：与导出一致，仅对有 prop 的金额列求和
  // 底薪列无 prop（经纪人取 baseSalary，店长取 teamIncome + guaranteeFill），单独处理
  const moneyProps = ['commissionIncome', 'mentorBonus', 'bonus', 'pointsFee', 'gross', 'socialFee', 'housingFund', 'commercialInsurance', 'dormitoryFee', 'net', 'tax'];
  const deductProps = new Set(['pointsFee', 'socialFee', 'housingFund', 'commercialInsurance', 'dormitoryFee', 'tax']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop && moneyProps.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else if (col.label === '底薪') {
      const total = data.reduce((s: number, r: any) => s + baseSalaryOf(r), 0);
      sums[idx] = fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

const managerSummary = ({ columns, data }: any) => {
  const sums: string[] = [];
  // 店长 sheet 金额列（不含 gross：店长工资 = teamIncome + guaranteeFill，不含结佣提成和个人新签递延）
  const moneyProps = ['deptNewSignTotal', 'deptEmployerSocialTotal', 'teamIncome', 'personalNewsignIncome', 'minSalary', 'guaranteeFill', 'otherDeduct'];
  const deductProps = new Set(['deptEmployerSocialTotal', 'otherDeduct']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop === 'gross') {
      // 店长工资 = teamIncome + guaranteeFill（保底补足），不含结佣提成和个人新签递延
      const total = data.reduce((s: number, r: any) => s + (Number(r.teamIncome) || 0) + (Number(r.guaranteeFill) || 0), 0);
      sums[idx] = fmt(total);
    } else if (prop && moneyProps.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

const directorSummary = ({ columns, data }: any) => {
  const sums: string[] = [];
  // 只汇总顶层汇总行（_isSummary），避免子行 double-count
  const topRows = data.filter((r: any) => r._isSummary);
  const moneyProps = ['deptNewSignTotal', 'deptEmployerSocialTotal', 'storeIncome', 'baseSalary', 'fullAttendance', 'bonus', 'commissionPerformance', 'commissionIncome', 'mentorBonus', 'socialFee', 'housingFund', 'commercialInsurance', 'gross', 'tax', 'net'];
  const deductProps = new Set(['deptEmployerSocialTotal', 'socialFee', 'housingFund', 'commercialInsurance', 'tax']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop && moneyProps.includes(prop)) {
      const total = topRows.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

/* ───────────── 导出（xlsx 三 sheet：工资表 28 列含经纪人+店长 / 店长工资 15 列 / 总监工资 19 列一人多行） ───────────── */
const exportExcel = () => {
  if (!details.value.length) return;
  exportMultiSheet(details.value, currentBatch.value?.period || '');
  ElMessage.success('导出成功');
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

.detail-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.text-primary {
  color: var(--el-color-primary);
}
</style>
