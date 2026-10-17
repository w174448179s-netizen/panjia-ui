<template>
  <div class="payroll-manual" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">手工录入项（奖金/其他收入/其他支出）</h3>
        <div class="flex items-center gap-3">
          <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="生效月" @change="load" />
          <el-button type="primary" @click="showAdd = true">+ 新增</el-button>
        </div>
      </div>
      <el-table :data="list" stripe border>
        <el-table-column label="生效区间" width="190" align="center">
          <template #default="{ row }">{{ row.startMonth }} ~ {{ row.endMonth }}</template>
        </el-table-column>
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
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" icon="Delete" @click="remove(row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAdd" title="新增手工项" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="起始月">
          <el-date-picker v-model="form.startMonth" type="month" value-format="YYYY-MM" placeholder="生效起始月" style="width:100%" />
        </el-form-item>
        <el-form-item label="截止月">
          <el-date-picker v-model="form.endMonth" type="month" value-format="YYYY-MM" placeholder="生效截止月" style="width:100%" />
        </el-form-item>
        <el-form-item label="员工">
          <EmployeeSelect v-model="form.employeeId" @change="onEmployeePicked" />
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
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import type { PerformanceEmployeeOption } from '@/api/panjia/performance';

const period = ref(new Date().toISOString().slice(0, 7));
const list = ref<ManualItem[]>([]);
const showAdd = ref(false);
const form = ref<any>({ startMonth: '', endMonth: '', employeeId: null, itemType: 'BONUS', subType: '', amount: 0, reason: '' });

const empCache = new Map<string, string>();

/** 公共员工选择器选中后缓存姓名，供表格列展示 */
const onEmployeePicked = (_id: string | number | undefined, emp: PerformanceEmployeeOption | null) => {
  if (emp) empCache.set(String(emp.employeeId), emp.employeeName);
};

const empName = (id: string | number) => empCache.get(String(id));

const typeLabel = (t: string) => ({ BONUS: '奖金', OTHER_INCOME: '其他收入', OTHER_DEDUCT: '其他支出' }[t] || t);

const load = async () => {
  if (period.value) list.value = ((await payrollApi.listManual(period.value)) as any).data ?? [];
};

const submit = async () => {
  if (!form.value.startMonth || !form.value.endMonth || !form.value.employeeId) {
    ElMessage.warning('请填写生效起止月和选择员工');
    return;
  }
  if (form.value.startMonth > form.value.endMonth) {
    ElMessage.warning('生效起始月不能晚于截止月');
    return;
  }
  await payrollApi.createManual(form.value);
  showAdd.value = false;
  form.value = { startMonth: '', endMonth: '', employeeId: null, itemType: 'BONUS', subType: '', amount: 0, reason: '' };
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
