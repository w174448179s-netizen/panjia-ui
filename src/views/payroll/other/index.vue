<template>
  <div class="payroll-other" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">其他收支录入</h3>
        <div class="flex items-center gap-3">
          <el-date-picker
            v-model="period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择归属月"
            clearable
            @change="load"
            @keydown.enter.prevent="load"
          />
          <el-button type="primary" @click="openAdd">+ 新增</el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <!-- 其他收入 -->
        <el-tab-pane label="其他收入" name="INCOME">
          <el-table v-loading="loading" :data="incomeList" stripe border>
            <el-table-column label="归属月" prop="period" width="110" />
            <el-table-column label="员工" min-width="160">
              <template #default="{ row }">{{ empDisplay(row.employeeId) }}</template>
            </el-table-column>
            <el-table-column label="子类型" prop="subType" width="120">
              <template #default="{ row }">{{ row.subType || '—' }}</template>
            </el-table-column>
            <el-table-column label="金额" prop="amount" width="130" align="right">
              <template #default="{ row }"><b class="text-success">¥{{ fmt(row.amount) }}</b></template>
            </el-table-column>
            <el-table-column label="事由" prop="reason" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }">
                <el-button link type="danger" @click="remove(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无其他收入记录" /></template>
          </el-table>
          <div v-if="incomeList.length" class="total-bar">
            <span>共 {{ incomeList.length }} 条，合计：</span>
            <b class="text-success">¥{{ fmt(incomeTotal) }}</b>
          </div>
        </el-tab-pane>

        <!-- 其他支出 -->
        <el-tab-pane label="其他支出" name="EXPENSE">
          <el-table v-loading="loading" :data="expenseList" stripe border>
            <el-table-column label="归属月" prop="period" width="110" />
            <el-table-column label="员工" min-width="160">
              <template #default="{ row }">{{ empDisplay(row.employeeId) }}</template>
            </el-table-column>
            <el-table-column label="子类型" prop="subType" width="120">
              <template #default="{ row }">{{ row.subType || '—' }}</template>
            </el-table-column>
            <el-table-column label="金额" prop="amount" width="130" align="right">
              <template #default="{ row }"><b class="text-danger">¥{{ fmt(row.amount) }}</b></template>
            </el-table-column>
            <el-table-column label="事由" prop="reason" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }">
                <el-button link type="danger" @click="remove(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无其他支出记录" /></template>
          </el-table>
          <div v-if="expenseList.length" class="total-bar">
            <span>共 {{ expenseList.length }} 条，合计：</span>
            <b class="text-danger">¥{{ fmt(expenseTotal) }}</b>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新增弹窗 -->
    <el-dialog v-model="showAdd" :title="`新增${dialogTypeLabel}`" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.itemType" @change="onTypeChange">
            <el-radio-button value="OTHER_INCOME">其他收入</el-radio-button>
            <el-radio-button value="OTHER_DEDUCT">其他支出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="归属月" prop="period">
          <el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            placeholder="搜索员工姓名/工号"
            filterable
            remote
            :remote-method="searchEmployee"
            :loading="empLoading"
            style="width:100%"
          >
            <el-option
              v-for="emp in empOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="子类型">
          <el-input v-model="form.subType" placeholder="如：补贴、报销等（选填）" />
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" :step="100" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="事由" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请输入事由" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { payrollApi, type ManualItem } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';

const period = ref(new Date().toISOString().slice(0, 7));
const list = ref<ManualItem[]>([]);
const loading = ref(false);
const activeTab = ref('INCOME');

const showAdd = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const empOptions = ref<Employee[]>([]);
const empLoading = ref(false);
const empCache = ref<Map<string, Employee>>(new Map());

const form = ref<any>({
  period: '',
  employeeId: null as string | null,
  itemType: 'OTHER_INCOME',
  subType: '',
  amount: 0,
  reason: '',
});

const rules = {
  period: [{ required: true, message: '请选择归属月', trigger: 'change' }],
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入事由', trigger: 'blur' }],
};

const STATUS_MAP: Record<string, string> = {
  PENDING: '待审批', APPROVED: '已审批', REJECTED: '已驳回', ACTIVE: '生效', CANCELLED: '已取消',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', ACTIVE: 'success', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const incomeList = computed(() => list.value.filter((r) => r.itemType === 'OTHER_INCOME'));
const expenseList = computed(() => list.value.filter((r) => r.itemType === 'OTHER_DEDUCT'));
const incomeTotal = computed(() => incomeList.value.reduce((s, r) => s + (Number(r.amount) || 0), 0));
const expenseTotal = computed(() => expenseList.value.reduce((s, r) => s + (Number(r.amount) || 0), 0));

const dialogTypeLabel = computed(() =>
  form.value.itemType === 'OTHER_INCOME' ? '其他收入' : '其他支出'
);

const empDisplay = (id: number) => {
  const emp = empCache.value.get(String(id));
  return emp ? `${emp.employeeName}（${emp.employeeCode}）` : String(id);
};

const onTabChange = (name: string) => {
  activeTab.value = name;
};

const onTypeChange = () => { /* form.itemType updated by v-model */ };

const load = async () => {
  if (!period.value) {
    list.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await payrollApi.listManual(period.value);
    list.value = (res as any).data ?? [];
    await preloadEmployees();
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
};

const preloadEmployees = async () => {
  const ids = [...new Set(list.value.map((r) => String(r.employeeId)))];
  const missing = ids.filter((id) => !empCache.value.has(id));
  if (!missing.length) return;
  try {
    const res = await employeeApi.list({ pageSize: 100 });
    const rows = (res as any).data?.rows ?? [];
    rows.forEach((emp: Employee) => empCache.value.set(emp.employeeId, emp));
  } catch { /* ignore */ }
};

const searchEmployee = (keyword: string) => {
  if (!keyword) {
    empOptions.value = [];
    return;
  }
  empLoading.value = true;
  setTimeout(async () => {
    try {
      const res = await employeeApi.list({ employeeName: keyword, pageSize: 20 });
      empOptions.value = (res as any).data?.rows ?? [];
      empOptions.value.forEach((emp) => empCache.value.set(emp.employeeId, emp));
    } finally {
      empLoading.value = false;
    }
  }, 300);
};

const openAdd = () => {
  form.value = {
    period: period.value,
    employeeId: null,
    itemType: activeTab.value === 'INCOME' ? 'OTHER_INCOME' : 'OTHER_DEDUCT',
    subType: '',
    amount: 0,
    reason: '',
  };
  empOptions.value = [];
  showAdd.value = true;
};

const submit = async () => {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await payrollApi.createManual({
      ...form.value,
      employeeId: form.value.employeeId,
    });
    ElMessage.success('已保存');
    showAdd.value = false;
    load();
  } finally {
    submitting.value = false;
  }
};

const remove = async (row: ManualItem) => {
  try {
    await ElMessageBox.confirm('确认删除该记录？', '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await payrollApi.deleteManual(row.id);
    ElMessage.success('已删除');
    load();
  } catch { /* 拦截器处理 */ }
};

onMounted(load);
</script>

<style scoped>
.total-bar {
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.text-success { color: var(--el-color-success); }
.text-danger { color: var(--el-color-danger); }
</style>
