<template>
  <div class="ledger-cost" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">门店成本录入</h3>
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
          <el-select
            v-model="selectedDeptId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 200px"
            @change="load"
          >
            <el-option
              v-for="d in deptList"
              :key="d.deptId"
              :label="d.deptName"
              :value="d.deptId"
            />
          </el-select>
          <el-button type="primary" @click="openAdd">+ 新增成本</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="filteredList" stripe border>
        <el-table-column label="归属月" prop="period" width="110" />
        <el-table-column label="门店/组别" min-width="150">
          <template #default="{ row }">{{ deptName(row.deptId) }}</template>
        </el-table-column>
        <el-table-column label="成本类型" prop="costType" width="130">
          <template #default="{ row }">{{ costTypeLabel(row.costType) }}</template>
        </el-table-column>
        <el-table-column label="金额" prop="amount" width="130" align="right">
          <template #default="{ row }"><b>¥{{ fmt(row.amount) }}</b></template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="200" show-overflow-tooltip />
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无成本数据" /></template>
      </el-table>

      <div v-if="filteredList.length" class="total-bar">
        <span>共 {{ filteredList.length }} 条，合计：</span>
        <b>¥{{ fmt(totalAmount) }}</b>
      </div>
    </el-card>

    <!-- 新增弹窗 -->
    <el-dialog v-model="showAdd" title="新增门店成本" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="归属月" prop="period">
          <el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="门店/组别" prop="deptId">
          <el-tree-select
            v-model="form.deptId"
            :data="deptList"
            :props="{ label: 'deptName', children: 'children' }"
            value-key="deptId"
            node-key="deptId"
            placeholder="请选择门店/组别"
            check-strictly
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="成本类型" prop="costType">
          <el-select v-model="form.costType" placeholder="请选择类型" style="width:100%">
            <el-option v-for="opt in costTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" :step="100" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" maxlength="200" show-word-limit />
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
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';

interface CostEntry {
  id: number;
  period: string;
  deptId: string;
  costType: string;
  amount: number;
  remark: string;
  createTime: string;
}

const period = ref(new Date().toISOString().slice(0, 7));
const selectedDeptId = ref('');
const loading = ref(false);
const list = ref<CostEntry[]>([]);
const deptList = ref<DeptNode[]>([]);

const showAdd = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const form = ref({
  period: '',
  deptId: '' as string,
  costType: '',
  amount: 0,
  remark: '',
});

const rules = {
  period: [{ required: true, message: '请选择归属月', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择门店/组别', trigger: 'change' }],
  costType: [{ required: true, message: '请选择成本类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
};

const COST_TYPE_MAP: Record<string, string> = {
  RENT: '房租', UTILITY: '水电', MATERIAL: '物料', MAINTENANCE: '维修', OTHER: '其他',
};
const costTypeOptions = Object.entries(COST_TYPE_MAP).map(([value, label]) => ({ value, label }));
const costTypeLabel = (t: string) => COST_TYPE_MAP[t] || t || '—';

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const deptName = (id: string) => {
  const find = (nodes: DeptNode[]): DeptNode | undefined => {
    for (const n of nodes) {
      if (n.deptId === id) return n;
      if (n.children?.length) {
        const f = find(n.children);
        if (f) return f;
      }
    }
  };
  return find(deptList.value)?.deptName || String(id);
};

const filteredList = computed(() => {
  if (!selectedDeptId.value) return list.value;
  return list.value.filter((r) => String(r.deptId) === String(selectedDeptId.value));
});

const totalAmount = computed(() =>
  filteredList.value.reduce((s, r) => s + (Number(r.amount) || 0), 0)
);

const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptList.value = (res as any).data ?? [];
  } catch { /* ignore */ }
};

const load = async () => {
  // 后端接口待实现，暂用空数据
  loading.value = true;
  try {
    list.value = [];
  } finally {
    loading.value = false;
  }
};

const openAdd = () => {
  form.value = { period: period.value, deptId: '', costType: '', amount: 0, remark: '' };
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
    // TODO: 后端接口就绪后替换
    ElMessage.warning('后端接口待实现');
    showAdd.value = false;
  } finally {
    submitting.value = false;
  }
};

const remove = async (row: CostEntry) => {
  try {
    await ElMessageBox.confirm('确认删除该成本记录？', '提示', { type: 'warning' });
  } catch {
    return;
  }
  // TODO: 后端接口就绪后实现
  ElMessage.warning('后端接口待实现');
};

onMounted(() => {
  loadDeptTree();
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
