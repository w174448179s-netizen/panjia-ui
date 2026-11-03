<template>
  <div class="app-container ledger-subject-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-tabs v-model="activeDirection" class="direction-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="收入配置" name="INCOME" />
          <el-tab-pane label="支出配置" name="EXPENSE" />
        </el-tabs>
        <div class="toolbar-actions">
          <el-button type="primary" plain icon="Plus" v-hasPermi="['ledger:subject:add']" @click="handleAddRoot">
            新增一级科目
          </el-button>
          <el-button icon="Refresh" @click="loadSubjects">刷新</el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="treeData"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        border
        size="small"
      >
        <el-table-column label="科目名称" min-width="240">
          <template #default="{ row }">
            <span class="subject-name">{{ row.subjectName }}</span>
            <el-tag v-if="row.dataSource !== 'MANUAL'" size="small" type="warning" class="ml8">
              {{ dataSourceLabel(row.dataSource) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="subjectCode" label="科目编码" width="130" />
        <el-table-column label="层级" width="70" align="center">
          <template #default="{ row }">{{ row.level }} 级</template>
        </el-table-column>
        <el-table-column label="数据来源" width="150">
          <template #default="{ row }">
            <el-tag :type="row.dataSource === 'MANUAL' ? 'info' : 'warning'" size="small">
              {{ dataSourceLabel(row.dataSource) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'info'" size="small">
              {{ row.status === '0' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.level < 4 && row.dataSource === 'MANUAL'"
              link
              type="primary"
              v-hasPermi="['ledger:subject:add']"
              @click="handleAddChild(row)"
            >
              新增子级
            </el-button>
            <el-button link type="primary" v-hasPermi="['ledger:subject:edit']" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" v-hasPermi="['ledger:subject:remove']" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="科目方向">
          <el-tag :type="form.direction === 'INCOME' ? 'success' : 'danger'" size="small">
            {{ form.direction === 'INCOME' ? '收入' : '支出' }}
          </el-tag>
        </el-form-item>
        <el-form-item label="上级科目">
          <el-tree-select
            v-model="form.parentId"
            :data="parentOptions"
            :props="{ label: 'subjectName', children: 'children' }"
            node-key="id"
            value-key="id"
            check-strictly
            clearable
            filterable
            placeholder="不选则为一级科目"
            :disabled="isEdit"
            style="width: 100%"
          />
          <div class="form-tip">仅手工录入科目可作为上级；最多 4 级。</div>
        </el-form-item>
        <el-form-item label="科目名称" prop="subjectName">
          <el-input v-model="form.subjectName" maxlength="100" placeholder="如：房屋租金" />
        </el-form-item>
        <el-form-item label="科目编码">
          <el-input v-model="form.subjectCode" maxlength="50" placeholder="可选，如 ZC0203" />
        </el-form-item>
        <el-form-item label="数据来源">
          <el-select v-model="form.dataSource" :disabled="isAutoLocked" style="width: 100%">
            <el-option label="手工录入" value="MANUAL" />
            <el-option label="实收明细自动（佣金收入）" value="RECEIVED_DETAIL" />
            <el-option label="工资应发自动（人工成本）" value="PAYROLL_GROSS" />
          </el-select>
          <div class="form-tip">
            自动取数科目必须是末级科目，且不能再新增子级或手工录入。
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">启用</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ledgerApi, type LedgerDataSource, type LedgerDirection, type LedgerSubject } from '@/api/panjia/ledger';

const loading = ref(false);
const saving = ref(false);
const activeDirection = ref<LedgerDirection>('INCOME');
const allSubjects = ref<LedgerSubject[]>([]);

const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref();

interface SubjectForm {
  id?: number;
  direction: LedgerDirection;
  parentId: number | null;
  subjectName: string;
  subjectCode?: string;
  level: number;
  sortOrder: number;
  dataSource: LedgerDataSource;
  status: string;
  remark?: string;
}

const form = reactive<SubjectForm>({
  direction: 'INCOME',
  parentId: null,
  subjectName: '',
  subjectCode: '',
  level: 1,
  sortOrder: 0,
  dataSource: 'MANUAL',
  status: '0',
  remark: ''
});

const rules = {
  subjectName: [{ required: true, message: '请输入科目名称', trigger: 'blur' }]
};

const dataSourceLabel = (value?: string) => {
  if (value === 'RECEIVED_DETAIL') return '实收明细自动';
  if (value === 'PAYROLL_GROSS') return '工资应发自动';
  return '手工录入';
};

const dialogTitle = computed(() => {
  if (isEdit.value) return '编辑科目';
  return form.parentId ? '新增子级科目' : '新增一级科目';
});

/** 当前方向的树 */
const treeData = computed(() => buildTree(allSubjects.value.filter((s) => s.direction === activeDirection.value)));

/** 可作为上级的科目（手工、未满 4 级） */
const parentOptions = computed(() =>
  buildTree(
    allSubjects.value.filter(
      (s) => s.direction === form.direction && s.dataSource === 'MANUAL' && (s.level || 1) < 4
    )
  )
);

const isAutoLocked = computed(() => isEdit.value && (form.level || 1) > 0 && hasChildrenInList(form.id));

function hasChildrenInList(id?: number) {
  if (!id) return false;
  return allSubjects.value.some((s) => s.parentId === id);
}

function buildTree(list: LedgerSubject[]): any[] {
  const nodes = new Map<number, any>();
  list.forEach((s) => nodes.set(s.id, { ...s, children: [] }));
  const roots: any[] = [];
  list.forEach((s) => {
    const node = nodes.get(s.id);
    if (s.parentId && nodes.has(s.parentId)) {
      nodes.get(s.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (arr: any[]) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
    arr.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

async function loadSubjects() {
  loading.value = true;
  try {
    allSubjects.value = await ledgerApi.listSubjects();
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.id = undefined;
  form.direction = activeDirection.value;
  form.parentId = null;
  form.subjectName = '';
  form.subjectCode = '';
  form.level = 1;
  form.sortOrder = 0;
  form.dataSource = 'MANUAL';
  form.status = '0';
  form.remark = '';
}

function handleTabChange() {
  // 页签切换只影响展示，不打断当前弹窗
}

function handleAddRoot() {
  isEdit.value = false;
  resetForm();
  form.direction = activeDirection.value;
  form.parentId = null;
  form.level = 1;
  dialogVisible.value = true;
}

function handleAddChild(row: any) {
  isEdit.value = false;
  resetForm();
  form.direction = row.direction;
  form.parentId = row.id;
  form.level = row.level + 1;
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  resetForm();
  Object.assign(form, {
    id: row.id,
    direction: row.direction,
    parentId: row.parentId && row.parentId !== 0 ? row.parentId : null,
    subjectName: row.subjectName,
    subjectCode: row.subjectCode,
    level: row.level,
    sortOrder: row.sortOrder,
    dataSource: row.dataSource,
    status: row.status,
    remark: row.remark
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const payload: Partial<LedgerSubject> = {
      id: form.id,
      direction: form.direction,
      parentId: form.parentId ?? 0,
      subjectName: form.subjectName.trim(),
      subjectCode: form.subjectCode?.trim(),
      sortOrder: form.sortOrder,
      dataSource: form.dataSource,
      status: form.status,
      remark: form.remark
    };
    if (isEdit.value) {
      await ledgerApi.updateSubject(payload);
      ElMessage.success('科目已更新');
    } else {
      await ledgerApi.createSubject(payload);
      ElMessage.success('科目已新增');
    }
    dialogVisible.value = false;
    await loadSubjects();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除科目「${row.subjectName}」？`, '提示', { type: 'warning' });
  await ledgerApi.deleteSubject(row.id);
  ElMessage.success('已删除');
  await loadSubjects();
}

onMounted(loadSubjects);
</script>

<style scoped>
.ledger-subject-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.direction-tabs {
  flex: 1;
}
.direction-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
}
.subject-name {
  font-weight: 500;
}
.ml8 {
  margin-left: 8px;
}
.form-tip {
  width: 100%;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
  margin-top: 4px;
}
</style>
