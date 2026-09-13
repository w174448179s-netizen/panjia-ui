<template>
  <div class="payroll-manual" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">手工录入项（奖金/其他收入/其他支出）</h3>
        <div class="flex items-center gap-3">
          <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="归属月" @change="load" />
          <el-button type="primary" @click="showAdd = true">+ 新增</el-button>
        </div>
      </div>
      <el-table :data="list" stripe border>
        <el-table-column label="归属月" prop="period" width="110" />
        <el-table-column label="员工" width="160">
          <template #default="{ row }">{{ empName(row.employeeId) || row.employeeId }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ typeLabel(row.itemType) }}</template>
        </el-table-column>
        <el-table-column label="子类型" prop="subType" width="120" />
        <el-table-column label="金额" prop="amount" width="120" align="right">
          <template #default="{ row }">{{ Number(row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" />
        <el-table-column label="状态" prop="status" width="80" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAdd" title="新增手工项" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="归属月">
          <el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" style="width:100%" />
        </el-form-item>
        <el-form-item label="员工">
          <el-select
            v-model="form.employeeId"
            filterable
            remote
            :remote-method="searchEmp"
            :loading="empLoading"
            placeholder="输入姓名/工号搜索"
            style="width:100%"
          >
            <el-option
              v-for="e in empOptions"
              :key="e.employeeId"
              :label="`${e.employeeName}（${e.employeeCode}）`"
              :value="e.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.itemType" style="width:100%">
            <el-option label="奖金" value="BONUS" />
            <el-option label="其他收入" value="OTHER_INCOME" />
            <el-option label="其他支出" value="OTHER_DEDUCT" />
          </el-select>
        </el-form-item>
        <el-form-item label="子类型"><el-input v-model="form.subType" /></el-form-item>
        <el-form-item label="金额"><el-input-number v-model="form.amount" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="form.reason" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { payrollApi, type ManualItem } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';

const period = ref(new Date().toISOString().slice(0, 7));
const list = ref<ManualItem[]>([]);
const showAdd = ref(false);
const form = ref<any>({ period: '', employeeId: null, itemType: 'BONUS', subType: '', amount: 0, reason: '' });

const empOptions = ref<Employee[]>([]);
const empLoading = ref(false);
const empCache = new Map<string, string>();

const searchEmp = async (keyword: string) => {
  if (!keyword) return;
  empLoading.value = true;
  try {
    const res = await employeeApi.list({ employeeName: keyword, pageSize: 20 } as any);
    empOptions.value = (res as any).data?.rows ?? [];
  } finally {
    empLoading.value = false;
  }
};

const empName = (id: string | number) => {
  const cached = empCache.get(String(id));
  if (cached) return cached;
  const found = empOptions.value.find(e => e.employeeId === String(id));
  return found?.employeeName;
};

const typeLabel = (t: string) => ({ BONUS: '奖金', OTHER_INCOME: '其他收入', OTHER_DEDUCT: '其他支出' }[t] || t);

const load = async () => {
  if (period.value) list.value = ((await payrollApi.listManual(period.value)) as any).data ?? [];
};

const submit = async () => {
  if (!form.value.period || !form.value.employeeId) {
    ElMessage.warning('请填写归属月和选择员工');
    return;
  }
  form.value.period = period.value;
  const selectedEmp = empOptions.value.find(e => e.employeeId === form.value.employeeId);
  if (selectedEmp) empCache.set(String(selectedEmp.employeeId), selectedEmp.employeeName);
  await payrollApi.createManual(form.value);
  showAdd.value = false;
  form.value = { period: '', employeeId: null, itemType: 'BONUS', subType: '', amount: 0, reason: '' };
  ElMessage.success('已保存');
  load();
};

const remove = async (row: ManualItem) => {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' });
    await payrollApi.deleteManual(row.id);
    ElMessage.success('已删除');
    load();
  } catch { /* cancel */ }
};

onMounted(load);
</script>
