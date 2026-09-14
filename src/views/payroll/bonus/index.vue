<template>
  <div class="payroll-bonus" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">奖金录入</h3>
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
          <el-button type="primary" @click="openAdd">+ 新增奖金</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="filteredList" stripe border>
        <el-table-column label="归属月" prop="period" width="110" />
        <el-table-column label="员工" min-width="160">
          <template #default="{ row }">
            {{ empDisplay(row.employeeId) }}
          </template>
        </el-table-column>
        <el-table-column label="子类型" prop="subType" width="120">
          <template #default="{ row }">{{ row.subType || '—' }}</template>
        </el-table-column>
        <el-table-column label="金额" prop="amount" width="130" align="right">
          <template #default="{ row }"><b>¥{{ fmt(row.amount) }}</b></template>
        </el-table-column>
        <el-table-column label="事由" prop="reason" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" icon="Delete" @click="remove(row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无奖金记录" />
        </template>
      </el-table>

      <!-- 合计 -->
      <div v-if="filteredList.length" class="total-bar">
        <span>共 {{ filteredList.length }} 条，合计：</span>
        <b>¥{{ fmt(totalAmount) }}</b>
      </div>
    </el-card>

    <!-- 新增弹窗 -->
    <el-dialog v-model="showAdd" title="新增奖金" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
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
          <el-input v-model="form.subType" placeholder="如：季度奖金、年终奖等（选填）" />
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" :step="100" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="事由" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请输入奖金事由" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="奖金详情" width="480px">
      <el-descriptions v-if="detailData" :column="2" border size="small">
        <el-descriptions-item label="归属月">{{ detailData.period }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ empDisplay(detailData.employeeId) }}</el-descriptions-item>
        <el-descriptions-item label="子类型">{{ detailData.subType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ fmt(detailData.amount) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailData.createTime }}</el-descriptions-item>
        <el-descriptions-item label="事由" :span="2">{{ detailData.reason || '—' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <!-- 审批统一由「我的待办」弹窗办理（工作流任务接口），本页只提供查看 -->
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { payrollApi, type ManualItem } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const period = ref(new Date().toISOString().slice(0, 7));
const list = ref<ManualItem[]>([]);
const loading = ref(false);
const showAdd = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const empOptions = ref<Employee[]>([]);
const empLoading = ref(false);
const empCache = ref<Map<string, Employee>>(new Map());

const form = ref<any>({
  period: '',
  employeeId: null as string | null,
  itemType: 'BONUS',
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

// 前端过滤 BONUS 类型
const filteredList = computed(() => list.value.filter((r) => r.itemType === 'BONUS'));
const totalAmount = computed(() =>
  filteredList.value.reduce((s, r) => s + (Number(r.amount) || 0), 0)
);

const empDisplay = (id: number) => {
  const emp = empCache.value.get(String(id));
  return emp ? `${emp.employeeName}（${emp.employeeCode}）` : String(id);
};

const load = async () => {
  if (!period.value) {
    list.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await payrollApi.listManual(period.value);
    list.value = (res as any).data ?? [];
    // 预加载员工信息
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
  // 批量加载（每次最多 20 个）
  for (let i = 0; i < missing.length; i += 20) {
    const chunk = missing.slice(i, i + 20);
    try {
      const res = await employeeApi.list({ pageSize: 100 });
      const rows = (res as any).data?.rows ?? [];
      rows.forEach((emp: Employee) => empCache.value.set(emp.employeeId, emp));
    } catch { /* ignore */ }
  }
};

const searchEmployee = (keyword: string) => {
  if (!keyword) {
    empOptions.value = [];
    return;
  }
  empLoading.value = true;
  // 防抖
  setTimeout(async () => {
    try {
      const res = await employeeApi.list({ employeeName: keyword, pageSize: 20 });
      empOptions.value = (res as any).data?.rows ?? [];
      // 缓存
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
    itemType: 'BONUS',
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
    ElMessage.success('奖金已保存');
    showAdd.value = false;
    load();
  } finally {
    submitting.value = false;
  }
};

const remove = async (row: ManualItem) => {
  try {
    await ElMessageBox.confirm('确认删除该奖金记录？', '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await payrollApi.deleteManual(row.id);
    ElMessage.success('已删除');
    load();
  } catch { /* 拦截器处理 */ }
};

// 详情
const showDetail = ref(false);
const detailData = ref<ManualItem | null>(null);

// 工作流跳转：查看态打开详情（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  try {
    const res = await payrollApi.getManual(Number(id));
    detailData.value = (res as any).data;
    showDetail.value = true;
  } catch {
    ElMessage.error('加载单据失败');
  }
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/payroll/bonus', openFromWorkflow);

onMounted(() => {
  load();
});
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
</style>
