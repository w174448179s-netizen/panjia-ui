<template>
  <div class="payroll-rule" style="padding: 12px;">
    <el-tabs v-model="activeTab">
      <!-- ==================== 职级/提成规则 ==================== -->
      <el-tab-pane label="职级/提成规则" name="rank">
        <el-table :data="rankList" stripe border>
          <el-table-column label="职级" prop="levelCode" width="80" align="center" />
          <el-table-column label="底薪" width="100" align="right">
            <template #default="{ row }">{{ fmtMoney(row.baseSalary) }}</template>
          </el-table-column>
          <el-table-column label="基础提点" width="90" align="center">
            <template #default="{ row }">{{ fmtPct(row.baseRate) }}</template>
          </el-table-column>
          <el-table-column label="保底" width="100" align="right">
            <template #default="{ row }">{{ fmtMoney(row.minSalary) }}</template>
          </el-table-column>
          <el-table-column label="团队提点" width="90" align="center">
            <template #default="{ row }">{{ row.teamRate != null ? fmtPct(row.teamRate) : '—' }}</template>
          </el-table-column>
          <el-table-column label="个人提点" width="90" align="center">
            <template #default="{ row }">{{ row.personalRate != null ? fmtPct(row.personalRate) : '—' }}</template>
          </el-table-column>
          <el-table-column label="招聘奖励" min-width="180">
            <template #default="{ row }">
              <span v-if="parseRank(row).mentorBonusMode === 'RATE_ADD'">
                加点 {{ fmtPct(parseRank(row).mentorBonusRateAdd) }} / 上限 {{ fmtPct(parseRank(row).mentorBonusRateCap) }}
              </span>
              <span v-else-if="parseRank(row).mentorBonusMode === 'AMOUNT_RATIO'">
                徒弟结佣 × {{ fmtPct(parseRank(row).mentorBonusAmountRatio) }}
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="生效日" prop="effectiveFrom" width="110" />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editRank(row as RankRule)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ==================== 客户政策规则 ==================== -->
      <el-tab-pane label="客户政策规则" name="policy">
        <div class="policy-toolbar">
          <span class="policy-title">政策参数（全公司统一）</span>
          <el-button type="primary" @click="savePolicyInline" :loading="policySaving">保存</el-button>
        </div>
        <el-form v-if="policyForm.id" :model="policyForm" label-width="110px" class="policy-form">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="范围类型">
                <el-input v-model="policyForm.scopeType" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="社保基数">
                <el-input-number v-model="policyForm.baseSocial" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="生效日">
                <el-date-picker v-model="policyForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider content-position="left">社保个人比例（按职级）</el-divider>
          <el-form-item label="社保比例">
            <div class="social-grid">
              <div v-for="(v, k) in policyJson.socialSettlementRatio" :key="k" class="social-item">
                <span class="social-label">{{ k }}</span>
                <el-input-number v-model="policyJson.socialSettlementRatio[k]" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" />
                <span class="social-pct">{{ fmtPct(policyJson.socialSettlementRatio[k]) }}</span>
              </div>
            </div>
          </el-form-item>

          <el-divider content-position="left">公积金与兼职</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="公积金(个人)">
                <el-input-number v-model="policyJson.housingFund" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="兼职豁免">
                <el-checkbox v-model="policyJson.parttimeExemptSocial">免社保</el-checkbox>
                <el-checkbox v-model="policyJson.parttimeExemptHousing" style="margin-left:16px">免公积金</el-checkbox>
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider content-position="left">考勤规则</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="迟到罚款">
                <el-input-number v-model="policyJson.attendance.lateFee" :min="0" :precision="2" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">元/次</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="旷工罚款">
                <el-input-number v-model="policyJson.attendance.absentNoBaseFee" :min="0" :precision="2" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">元/天</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="旷工倍数">
                <el-input-number v-model="policyJson.attendance.absentWithBaseTimes" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="月计薪天数">
                <el-input-number v-model="policyJson.attendance.workDaysPerMonth" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider content-position="left">积分考核规则</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="处罚费用">
                <el-input-number v-model="policyJson.points.penaltyFee" :min="0" :precision="2" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">元/次</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="A线标准">
                <el-input-number v-model="policyJson.points.gradeA" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="B线标准">
                <el-input-number v-model="policyJson.points.gradeB" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="A级扣点">
                <el-input-number v-model="policyJson.points.deductA" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">{{ fmtPct(policyJson.points.deductA) }}</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="B级扣点">
                <el-input-number v-model="policyJson.points.deductB" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">{{ fmtPct(policyJson.points.deductB) }}</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="C级扣点">
                <el-input-number v-model="policyJson.points.deductC" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">{{ fmtPct(policyJson.points.deductC) }}</span>
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider content-position="left">商业保险与宿舍</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="商业保险">
                <el-input-number v-model="policyJson.commercialInsurance" :min="0" :precision="2" :controls="false" style="width:100%" />
                <span class="form-tip" style="margin-left:8px">元/月</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="宿舍管理费">
                <el-input-number v-model="policyJson.dormitoryFee" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider content-position="left">个税规则</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="个税起征点">
                <el-input-number v-model="policyJson.tax.threshold" :min="0" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="扣除社保">
                <el-switch v-model="policyJson.tax.deductSocial" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="税率阶梯">
            <el-table :data="policyJson.tax.brackets" border size="small" style="width:100%">
              <el-table-column label="下限(元)" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.min" :min="0" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="税率" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.rate" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="速算扣除" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.quick" :min="0" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" @click="policyJson.tax.brackets.splice($index, 1)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button type="primary" plain size="small" style="margin-top:8px" @click="policyJson.tax.brackets.push({ min: 0, rate: 0.03, quick: 0 })">+ 添加税率</el-button>
          </el-form-item>
        </el-form>
        <el-empty v-else description="暂无政策规则数据" />
      </el-tab-pane>

      <!-- ==================== 业绩折算规则 ==================== -->
      <el-tab-pane label="业绩折算规则" name="conversion">
        <el-table :data="conversionList" stripe border>
          <el-table-column label="业务类型" prop="bizType" width="150" />
          <el-table-column label="折算系数" width="120" align="center">
            <template #default="{ row }">{{ fmtPct(row.factor) }}</template>
          </el-table-column>
          <el-table-column label="生效日" prop="effectiveFrom" width="120" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button link type="primary" @click="editConversion(row as ConversionRule)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 职级编辑弹窗 ==================== -->
    <el-dialog v-model="rankDialog.show" title="编辑职级规则" width="560px">
      <el-form :model="rankDialog.form" label-width="100px">
        <el-form-item label="职级">
          <el-input v-model="rankDialog.form.levelCode" />
        </el-form-item>
        <el-form-item label="底薪">
          <el-input-number v-model="rankDialog.form.baseSalary" :min="0" :precision="2" :controls="false" style="width:100%" />
        </el-form-item>
        <el-form-item label="基础提点">
          <el-input-number v-model="rankDialog.form.baseRate" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
          <div class="form-tip">当前值：{{ fmtPct(rankDialog.form.baseRate) }}</div>
        </el-form-item>
        <el-form-item label="保底">
          <el-input-number v-model="rankDialog.form.minSalary" :min="0" :precision="2" :controls="false" style="width:100%" />
        </el-form-item>
        <el-form-item label="团队提点">
          <el-input-number v-model="rankDialog.form.teamRate" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
          <div class="form-tip" v-if="rankDialog.form.teamRate != null">当前值：{{ fmtPct(rankDialog.form.teamRate) }}</div>
        </el-form-item>
        <el-form-item label="个人提点">
          <el-input-number v-model="rankDialog.form.personalRate" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
          <div class="form-tip" v-if="rankDialog.form.personalRate != null">当前值：{{ fmtPct(rankDialog.form.personalRate) }}</div>
        </el-form-item>
        <el-form-item label="生效日">
          <el-date-picker v-model="rankDialog.form.effectiveFrom" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>

        <el-divider content-position="left">招聘奖励</el-divider>
        <el-form-item label="奖励模式">
          <el-select v-model="rankJson.mentorBonusMode" style="width:100%">
            <el-option label="加点模式（每推荐+X%，上限Y%）" value="RATE_ADD" />
            <el-option label="金额比例（徒弟结佣 × X%）" value="AMOUNT_RATIO" />
          </el-select>
        </el-form-item>
        <template v-if="rankJson.mentorBonusMode === 'RATE_ADD'">
          <el-form-item label="每推荐加点">
            <el-input-number v-model="rankJson.mentorBonusRateAdd" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
            <div class="form-tip">当前值：{{ fmtPct(rankJson.mentorBonusRateAdd) }}</div>
          </el-form-item>
          <el-form-item label="累计上限">
            <el-input-number v-model="rankJson.mentorBonusRateCap" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
            <div class="form-tip">当前值：{{ fmtPct(rankJson.mentorBonusRateCap) }}</div>
          </el-form-item>
        </template>
        <template v-else-if="rankJson.mentorBonusMode === 'AMOUNT_RATIO'">
          <el-form-item label="徒弟结佣比例">
            <el-input-number v-model="rankJson.mentorBonusAmountRatio" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
            <div class="form-tip">当前值：{{ fmtPct(rankJson.mentorBonusAmountRatio) }}</div>
          </el-form-item>
        </template>

        <!-- 总监门店提成阶梯 -->
        <template v-if="rankDialog.form.levelCode === 'D'">
          <el-divider content-position="left">门店提成阶梯（总监）</el-divider>
          <el-form-item label="提成阶梯">
            <el-table :data="rankJson.brackets" border size="small" style="width:100%">
              <el-table-column label="下限(元)" width="140">
                <template #default="{ row }">
                  <el-input-number v-model="row.min" :min="0" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="上限(元)" width="140">
                <template #default="{ row }">
                  <el-input-number v-model="row.max" :min="0" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="提成比例" width="140">
                <template #default="{ row }">
                  <el-input-number v-model="row.rate" :min="0" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" @click="rankJson.brackets.splice($index, 1)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button type="primary" plain size="small" style="margin-top:8px" @click="rankJson.brackets.push({ min: 0, max: null, rate: 0.06 })">+ 添加阶梯</el-button>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="rankDialog.show = false">取消</el-button>
        <el-button type="primary" @click="saveRank">保存</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 折算编辑弹窗 ==================== -->
    <el-dialog v-model="convDialog.show" title="编辑折算规则" width="420px">
      <el-form :model="convDialog.form" label-width="100px">
        <el-form-item label="业务类型"><el-input v-model="convDialog.form.bizType" /></el-form-item>
        <el-form-item label="折算系数">
          <el-input-number v-model="convDialog.form.factor" :min="0" :max="1" :precision="6" :step="0.01" :controls="false" style="width:100%" />
          <div class="form-tip">当前值：{{ fmtPct(convDialog.form.factor) }}</div>
        </el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="convDialog.form.effectiveFrom" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="convDialog.show = false">取消</el-button>
        <el-button type="primary" @click="saveConversion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { payrollApi, type RankRule, type PolicyRule, type ConversionRule } from '@/api/panjia/payroll';

const activeTab = ref('rank');
const rankList = ref<RankRule[]>([]);
const policyList = ref<PolicyRule[]>([]);
const conversionList = ref<ConversionRule[]>([]);

// ==================== 工具函数 ====================
const fmtMoney = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : (Number(n) * 100).toFixed(1) + '%';

const safeParse = (s: string): any => {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
};

// ==================== 职级规则 ====================
const rankDialog = ref({ show: false, form: {} as RankRule });
// 编辑时的结构化 JSON 对象
const rankJson = reactive({
  mentorBonusMode: '' as string,
  mentorBonusRateAdd: 0,
  mentorBonusRateCap: 0,
  mentorBonusAmountRatio: 0,
  brackets: [] as Array<{ min: number; max: number | null; rate: number }>,
});

const parseRank = (row: RankRule) => safeParse(row.ruleContent);

const editRank = (row: RankRule) => {
  rankDialog.value = { show: true, form: { ...row } };
  const j = safeParse(row.ruleContent);
  rankJson.mentorBonusMode = j.mentorBonusMode || '';
  rankJson.mentorBonusRateAdd = j.mentorBonusRateAdd ?? 0;
  rankJson.mentorBonusRateCap = j.mentorBonusRateCap ?? 0;
  rankJson.mentorBonusAmountRatio = j.mentorBonusAmountRatio ?? 0;
  rankJson.brackets = (j.brackets ?? []).map((b: any) => ({ ...b }));
};

const saveRank = async () => {
  // 序列化结构化字段回 ruleContent
  const j: any = { mentorBonusMode: rankJson.mentorBonusMode };
  if (rankJson.mentorBonusMode === 'RATE_ADD') {
    j.mentorBonusRateAdd = rankJson.mentorBonusRateAdd;
    j.mentorBonusRateCap = rankJson.mentorBonusRateCap;
  } else if (rankJson.mentorBonusMode === 'AMOUNT_RATIO') {
    j.mentorBonusAmountRatio = rankJson.mentorBonusAmountRatio;
  }
  if (rankDialog.value.form.levelCode === 'D') {
    j.brackets = rankJson.brackets;
  }
  rankDialog.value.form.ruleContent = JSON.stringify(j);
  await payrollApi.saveRank(rankDialog.value.form);
  rankDialog.value.show = false;
  ElMessage.success('已保存');
  load();
};

// ==================== 政策规则（单条记录，页面内直接编辑） ====================
const policyForm = reactive({} as PolicyRule);
const policySaving = ref(false);
// 结构化 JSON 对象
const policyJson = reactive({
  socialSettlementRatio: {} as Record<string, number>,
  parttimeExemptSocial: true,
  parttimeExemptHousing: true,
  housingFund: 0,
  attendance: { lateFee: 0, absentNoBaseFee: 0, absentWithBaseTimes: 0, workDaysPerMonth: 0 },
  points: { penaltyFee: 0, gradeA: 0, gradeB: 0, deductA: 0, deductB: 0, deductC: 0 },
  commercialInsurance: 0,
  dormitoryFee: 0,
  tax: { threshold: 0, deductSocial: true, brackets: [] as Array<{ min: number; rate: number; quick: number }> },
});

const loadPolicy = (row: PolicyRule) => {
  Object.assign(policyForm, row);
  const j = safeParse(row.ruleContent);
  policyJson.socialSettlementRatio = { ...j.socialSettlementRatio };
  policyJson.parttimeExemptSocial = j.parttimeExemptSocial ?? true;
  policyJson.parttimeExemptHousing = j.parttimeExemptHousing ?? true;
  policyJson.housingFund = j.housingFund ?? 0;
  policyJson.attendance = { ...j.attendance };
  policyJson.points = { ...j.points };
  policyJson.commercialInsurance = j.commercialInsurance ?? 0;
  policyJson.dormitoryFee = j.dormitoryFee ?? 0;
  policyJson.tax = {
    threshold: j.tax?.threshold ?? 5000,
    deductSocial: j.tax?.deductSocial ?? true,
    brackets: (j.tax?.brackets ?? []).map((b: any) => ({ ...b })),
  };
};

const savePolicyInline = async () => {
  policySaving.value = true;
  try {
    policyForm.ruleContent = JSON.stringify({
      socialSettlementRatio: policyJson.socialSettlementRatio,
      parttimeExemptSocial: policyJson.parttimeExemptSocial,
      parttimeExemptHousing: policyJson.parttimeExemptHousing,
      housingFund: policyJson.housingFund,
      attendance: policyJson.attendance,
      points: policyJson.points,
      commercialInsurance: policyJson.commercialInsurance,
      dormitoryFee: policyJson.dormitoryFee,
      tax: policyJson.tax,
    });
    await payrollApi.savePolicy(policyForm);
    ElMessage.success('已保存');
  } finally {
    policySaving.value = false;
  }
};

// ==================== 折算规则 ====================
const convDialog = ref({ show: false, form: {} as ConversionRule });
const editConversion = (row: ConversionRule) => { convDialog.value = { show: true, form: { ...row } }; };
const saveConversion = async () => {
  await payrollApi.saveConversion(convDialog.value.form);
  convDialog.value.show = false;
  ElMessage.success('已保存');
  load();
};

// ==================== 加载 ====================
const load = async () => {
  rankList.value = ((await payrollApi.rankList()) as any).data ?? [];
  policyList.value = ((await payrollApi.policyList()) as any).data ?? [];
  conversionList.value = ((await payrollApi.conversionList()) as any).data ?? [];
  if (policyList.value.length > 0) {
    loadPolicy(policyList.value[0]);
  }
};

onMounted(load);
</script>

<style scoped>
.policy-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 4px;
}
.policy-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.policy-form {
  padding: 0 8px;
}
.ratio-tag {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 1px 6px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 3px;
  font-size: 12px;
}
.form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}
.social-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
}
.social-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.social-label {
  width: 28px;
  font-size: 13px;
  color: #606266;
  text-align: right;
}
.social-item :deep(.el-input-number) {
  flex: 1;
}
.social-pct {
  width: 48px;
  font-size: 12px;
  color: #409eff;
}
</style>
