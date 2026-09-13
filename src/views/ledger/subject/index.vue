<template>
  <div class="ledger-subject" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">收支科目配置</h3>
        <el-button type="primary" @click="openAdd">+ 新增科目</el-button>
      </div>

      <el-form :inline="true" :model="queryParams" @submit.prevent class="mb-4">
        <el-form-item label="方向">
          <el-select v-model="queryParams.direction" placeholder="全部" clearable style="width: 120px" @change="load">
            <el-option label="收入" value="INCOME" />
            <el-option label="支出" value="EXPENSE" />
          </el-select>
        </el-form-item>
        <el-form-item label="科目名称">
          <el-input
            v-model="queryParams.subjectName"
            placeholder="搜索科目名称"
            clearable
            style="width: 200px"
            @keyup.enter="load"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="filteredList" stripe border>
        <el-table-column label="科目编码" prop="subjectCode" width="140" />
        <el-table-column label="科目名称" prop="subjectName" min-width="160" />
        <el-table-column label="方向" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'INCOME' ? 'success' : 'danger'" size="small">
              {{ row.direction === 'INCOME' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="映射字段" prop="fieldMapping" width="160">
          <template #default="{ row }">{{ row.fieldMapping || '—' }}</template>
        </el-table-column>
        <el-table-column label="排序" prop="sortOrder" width="70" align="center" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">
              {{ row.active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无科目配置" /></template>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="showForm" :title="editingId ? '编辑科目' : '新增科目'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="科目编码" prop="subjectCode">
          <el-input v-model="form.subjectCode" placeholder="如：COMM_INCOME" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="科目名称" prop="subjectName">
          <el-input v-model="form.subjectName" placeholder="如：业绩提成" />
        </el-form-item>
        <el-form-item label="方向" prop="direction">
          <el-radio-group v-model="form.direction">
            <el-radio-button value="INCOME">收入</el-radio-button>
            <el-radio-button value="EXPENSE">支出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="映射字段" prop="fieldMapping">
          <el-input v-model="form.fieldMapping" placeholder="对应 PayrollDetail 字段名（选填）" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :step="1" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.active" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';

interface SubjectConfig {
  id: number;
  subjectCode: string;
  subjectName: string;
  direction: string; // INCOME / EXPENSE
  fieldMapping: string;
  sortOrder: number;
  active: boolean;
  remark: string;
}

const loading = ref(false);
const list = ref<SubjectConfig[]>([]);
const queryParams = reactive({ direction: '' as string, subjectName: '' as string });

const showForm = ref(false);
const submitting = ref(false);
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();

const form = ref({
  subjectCode: '',
  subjectName: '',
  direction: 'INCOME',
  fieldMapping: '',
  sortOrder: 0,
  active: true,
  remark: '',
});

const rules = {
  subjectCode: [{ required: true, message: '请输入科目编码', trigger: 'blur' }],
  subjectName: [{ required: true, message: '请输入科目名称', trigger: 'blur' }],
  direction: [{ required: true, message: '请选择方向', trigger: 'change' }],
};

const filteredList = computed(() => {
  let result = list.value;
  if (queryParams.direction) result = result.filter((r) => r.direction === queryParams.direction);
  if (queryParams.subjectName) result = result.filter((r) => r.subjectName.includes(queryParams.subjectName));
  return result;
});

const load = async () => {
  loading.value = true;
  try {
    // 后端接口待实现，暂用空数据
    list.value = [];
  } finally {
    loading.value = false;
  }
};

const resetQuery = () => {
  Object.assign(queryParams, { direction: '', subjectName: '' });
  load();
};

const openAdd = () => {
  editingId.value = null;
  form.value = { subjectCode: '', subjectName: '', direction: 'INCOME', fieldMapping: '', sortOrder: 0, active: true, remark: '' };
  showForm.value = true;
};

const edit = (row: SubjectConfig) => {
  editingId.value = row.id;
  form.value = { ...row };
  showForm.value = true;
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
    showForm.value = false;
  } finally {
    submitting.value = false;
  }
};

const remove = async (row: SubjectConfig) => {
  try {
    await ElMessageBox.confirm(`确认删除科目「${row.subjectName}」？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  // TODO: 后端接口就绪后实现
  ElMessage.warning('后端接口待实现');
};

onMounted(load);
</script>
