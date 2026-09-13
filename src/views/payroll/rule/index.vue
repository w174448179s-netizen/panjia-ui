<template>
  <div class="payroll-rule" style="padding: 12px;">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="职级/提成规则" name="rank">
        <el-table :data="rankList" stripe border>
          <el-table-column label="职级" prop="levelCode" width="100" />
          <el-table-column label="底薪" prop="baseSalary" width="100" />
          <el-table-column label="基础提点" prop="baseRate" width="100" />
          <el-table-column label="保底" prop="minSalary" width="100" />
          <el-table-column label="团队提点" prop="teamRate" width="100" />
          <el-table-column label="个人提点" prop="personalRate" width="100" />
          <el-table-column label="生效日" prop="effectiveFrom" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" @click="editRank(row as RankRule)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="客户政策规则" name="policy">
        <el-table :data="policyList" stripe border>
          <el-table-column label="范围类型" prop="scopeType" width="100" />
          <el-table-column label="范围值" prop="scopeKey" width="120" />
          <el-table-column label="社保基数" prop="baseSocial" width="100" />
          <el-table-column label="规则内容(JSON)">
            <template #default="{ row }">
              <el-input :model-value="row.ruleContent" type="textarea" :rows="3" readonly />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" @click="editPolicy(row as PolicyRule)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="业绩折算规则" name="conversion">
        <el-table :data="conversionList" stripe border>
          <el-table-column label="业务类型" prop="bizType" width="150" />
          <el-table-column label="折算系数" prop="factor" width="120" />
          <el-table-column label="生效日" prop="effectiveFrom" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" @click="editConversion(row as ConversionRule)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 职级编辑弹窗 -->
    <el-dialog v-model="rankDialog.show" title="编辑职级规则" width="500px">
      <el-form :model="rankDialog.form" label-width="90px">
        <el-form-item label="职级"><el-input v-model="rankDialog.form.levelCode" /></el-form-item>
        <el-form-item label="底薪"><el-input-number v-model="rankDialog.form.baseSalary" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="基础提点"><el-input-number v-model="rankDialog.form.baseRate" :min="0" :max="1" :precision="6" /></el-form-item>
        <el-form-item label="保底"><el-input-number v-model="rankDialog.form.minSalary" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="团队提点"><el-input-number v-model="rankDialog.form.teamRate" :min="0" :max="1" :precision="6" /></el-form-item>
        <el-form-item label="个人提点"><el-input-number v-model="rankDialog.form.personalRate" :min="0" :max="1" :precision="6" /></el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="rankDialog.form.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="规则JSON"><el-input v-model="rankDialog.form.ruleContent" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rankDialog.show = false">取消</el-button>
        <el-button type="primary" @click="saveRank">保存</el-button>
      </template>
    </el-dialog>

    <!-- 政策编辑弹窗 -->
    <el-dialog v-model="policyDialog.show" title="编辑政策规则" width="600px">
      <el-form :model="policyDialog.form" label-width="90px">
        <el-form-item label="范围类型"><el-input v-model="policyDialog.form.scopeType" /></el-form-item>
        <el-form-item label="范围值"><el-input v-model="policyDialog.form.scopeKey" /></el-form-item>
        <el-form-item label="社保基数"><el-input-number v-model="policyDialog.form.baseSocial" :precision="2" /></el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="policyDialog.form.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="规则JSON"><el-input v-model="policyDialog.form.ruleContent" type="textarea" :rows="8" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="policyDialog.show = false">取消</el-button>
        <el-button type="primary" @click="savePolicy">保存</el-button>
      </template>
    </el-dialog>

    <!-- 折算编辑弹窗 -->
    <el-dialog v-model="convDialog.show" title="编辑折算规则" width="400px">
      <el-form :model="convDialog.form" label-width="90px">
        <el-form-item label="业务类型"><el-input v-model="convDialog.form.bizType" /></el-form-item>
        <el-form-item label="折算系数"><el-input-number v-model="convDialog.form.factor" :min="0" :max="1" :precision="6" /></el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="convDialog.form.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="convDialog.show = false">取消</el-button>
        <el-button type="primary" @click="saveConversion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { payrollApi, type RankRule, type PolicyRule, type ConversionRule } from '@/api/panjia/payroll';

const activeTab = ref('rank');
const rankList = ref<RankRule[]>([]);
const policyList = ref<PolicyRule[]>([]);
const conversionList = ref<ConversionRule[]>([]);

const rankDialog = ref({ show: false, form: {} as RankRule });
const policyDialog = ref({ show: false, form: {} as PolicyRule });
const convDialog = ref({ show: false, form: {} as ConversionRule });

const load = async () => {
  rankList.value = ((await payrollApi.rankList()) as any).data ?? [];
  policyList.value = ((await payrollApi.policyList()) as any).data ?? [];
  conversionList.value = ((await payrollApi.conversionList()) as any).data ?? [];
};

const editRank = (row: RankRule) => { rankDialog.value = { show: true, form: { ...row } }; };
const saveRank = async () => { await payrollApi.saveRank(rankDialog.value.form); rankDialog.value.show = false; ElMessage.success('已保存'); load(); };

const editPolicy = (row: PolicyRule) => { policyDialog.value = { show: true, form: { ...row } }; };
const savePolicy = async () => { await payrollApi.savePolicy(policyDialog.value.form); policyDialog.value.show = false; ElMessage.success('已保存'); load(); };

const editConversion = (row: ConversionRule) => { convDialog.value = { show: true, form: { ...row } }; };
const saveConversion = async () => { await payrollApi.saveConversion(convDialog.value.form); convDialog.value.show = false; ElMessage.success('已保存'); load(); };

onMounted(load);
</script>
