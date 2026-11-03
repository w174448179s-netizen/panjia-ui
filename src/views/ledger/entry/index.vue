<template>
  <div class="app-container ledger-entry-page">
    <el-card shadow="never">
      <el-tabs v-model="activeDirection" @tab-change="handleDirectionChange">
        <el-tab-pane label="收入录入" name="INCOME" />
        <el-tab-pane label="支出录入" name="EXPENSE" />
      </el-tabs>

      <div class="query-bar">
        <el-date-picker
          v-model="query.period"
          type="month"
          value-format="YYYY-MM"
          placeholder="归属月"
          :clearable="false"
          style="width: 150px"
          @change="loadEntries"
        />
        <PanjiaDeptSelect
          v-model="query.deptId"
          :scope="false"
          leaf-only
          placeholder="全部末级部门"
          width="200px"
          @change="loadEntries"
        />
        <el-tree-select
          v-model="query.subjectId"
          :data="subjectTree"
          :props="{ label: 'subjectName', children: 'children', disabled: 'disabled' }"
          node-key="id"
          value-key="id"
          check-strictly
          clearable
          filterable
          placeholder="全部科目"
          style="width: 220px"
          @change="loadEntries"
        />
        <el-button type="primary" plain icon="Search" @click="loadEntries">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        <div class="flex-1" />
        <el-button type="primary" icon="Plus" v-hasPermi="['ledger:entry:add']" @click="handleAdd">
          新增录入
        </el-button>
      </div>

      <el-alert
        v-if="activeDirection === 'EXPENSE'"
        type="info"
        :closable="false"
        show-icon
        class="sign-tip"
        title="支出正常填正数，报表按支出方向显示为负数；冲减/退款类（如宿舍收入）填负数。"
      />

      <el-table v-loading="loading" :data="entries" border size="small">
        <el-table-column label="收支科目" min-width="220">
          <template #default="{ row }">
            <span class="subject-path">{{ row.subjectPath || row.subjectName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="deptName" label="部门" width="160" />
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ negative: row.amount < 0 }">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="startDate" label="生效日期" width="120" align="center" />
        <el-table-column prop="endDate" label="失效日期" width="120" align="center" />
        <el-table-column label="计入月份" min-width="170">
          <template #default="{ row }">{{ coverMonths(row.startDate, row.endDate) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="170" align="center" />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-hasPermi="['ledger:entry:edit']" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" v-hasPermi="['ledger:entry:remove']" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="当前归属月暂无录入记录" />
        </template>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑收支录入' : `新增${activeDirection === 'INCOME' ? '收入' : '支出'}录入`"
      width="620px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="收支科目" prop="subjectId">
          <el-tree-select
            v-model="form.subjectId"
            :data="subjectTree"
            :props="{ label: 'subjectName', children: 'children', disabled: 'disabled' }"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            placeholder="仅可选择末级手工科目"
            style="width: 100%"
            @change="handleSubjectChange"
          />
          <div class="form-tip">自动取数科目（佣金/工资）不允许手工录入。</div>
        </el-form-item>
        <el-form-item label="部门" prop="deptId">
          <PanjiaDeptSelect
            v-model="form.deptId"
            :scope="false"
            leaf-only
            placeholder="仅可选择末级部门"
            @change="handleDeptChange"
          />
        </el-form-item>
        <el-form-item :label="activeDirection === 'EXPENSE' ? '金额（支出）' : '金额（收入）'" prop="amount">
          <el-input-number
            v-model="form.amount"
            :precision="2"
            :step="100"
            :min="-99999999"
            :max="99999999"
            controls-position="right"
            style="width: 220px"
          />
          <span class="form-tip inline">
            {{ activeDirection === 'EXPENSE' ? '正数=支出，负数=冲减/退款' : '正数=收入，负数=退款冲减' }}
          </span>
        </el-form-item>

        <el-form-item label="期间方式">
          <el-radio-group v-model="form.dateMode">
            <el-radio value="MONTH">按归属月</el-radio>
            <el-radio value="RANGE">按起止日期</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.dateMode === 'MONTH'" label="归属月" prop="month">
          <el-date-picker v-model="form.month" type="month" value-format="YYYY-MM" :clearable="false" />
        </el-form-item>
        <el-form-item v-else label="生效期间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="生效日期"
            end-placeholder="失效日期"
            :clearable="false"
          />
        </el-form-item>
        <el-form-item label="计入说明">
          <div class="preview-box">
            <div>生效期间：{{ previewText }}</div>
            <div class="sub">跨月录入时，只要归属月与该期间有交集，该笔金额在该月报表中整笔计入（不按天折算）。</div>
          </div>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import {
  ledgerApi,
  type LedgerDirection,
  type LedgerEntry,
  type LedgerSubject
} from '@/api/panjia/ledger';

const loading = ref(false);
const saving = ref(false);
const entries = ref<LedgerEntry[]>([]);
const subjects = ref<LedgerSubject[]>([]);
const activeDirection = ref<LedgerDirection>('INCOME');

const query = reactive({
  period: currentMonth(),
  deptId: null as number | null,
  subjectId: null as number | null
});

interface EntryForm {
  id?: number;
  subjectId: number | null;
  deptId: number | null;
  amount: number | null;
  dateMode: 'MONTH' | 'RANGE';
  month: string;
  dateRange: [string, string] | null;
  remark?: string;
}

const form = reactive<EntryForm>({
  subjectId: null,
  deptId: null,
  amount: null,
  dateMode: 'MONTH',
  month: currentMonth(),
  dateRange: null,
  remark: ''
});

const rules = {
  subjectId: [{ required: true, message: '请选择收支科目', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择部门', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  month: [{ required: true, message: '请选择归属月', trigger: 'change' }],
  dateRange: [{ required: true, message: '请选择生效期间', trigger: 'change' }]
};

const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref();

/** 科目树：非末级/自动取数科目置灰，不可选 */
const subjectTree = computed(() => {
  const list = subjects.value.filter((s) => s.direction === activeDirection.value);
  const nodes = new Map<number, any>();
  list.forEach((s) =>
    nodes.set(s.id, {
      ...s,
      children: [],
      disabled: s.dataSource !== 'MANUAL'
    })
  );
  const roots: any[] = [];
  list.forEach((s) => {
    const node = nodes.get(s.id);
    if (s.parentId && nodes.has(s.parentId)) nodes.get(s.parentId).children.push(node);
    else roots.push(node);
  });
  const mark = (arr: any[]) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
    arr.forEach((n) => {
      mark(n.children);
      if (n.children.length > 0) n.disabled = true;
    });
  };
  mark(roots);
  return roots;
});

const previewRange = computed<[string, string] | null>(() => {
  if (form.dateMode === 'MONTH') {
    return form.month ? monthRange(form.month) : null;
  }
  return form.dateRange ?? null;
});

const previewText = computed(() => {
  const range = previewRange.value;
  if (!range) return '请选择期间';
  return `${range[0]} ~ ${range[1]}（含当天）`;
});

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

function coverMonths(start: string, end: string) {
  if (!start || !end) return '';
  const months: string[] = [];
  let cur = new Date(start.slice(0, 7) + '-01');
  const endMonth = new Date(end.slice(0, 7) + '-01');
  while (cur <= endMonth && months.length < 24) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months.join('、');
}

function formatMoney(value?: number) {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadSubjects() {
  subjects.value = await ledgerApi.listSubjects();
}

async function loadEntries() {
  loading.value = true;
  try {
    entries.value = await ledgerApi.listEntries({
      period: query.period,
      direction: activeDirection.value,
      deptId: query.deptId ?? undefined,
      subjectId: query.subjectId ?? undefined
    });
  } finally {
    loading.value = false;
  }
}

function handleDirectionChange() {
  query.subjectId = null;
  loadEntries();
}

function resetQuery() {
  query.period = currentMonth();
  query.deptId = null;
  query.subjectId = null;
  loadEntries();
}

function resetForm() {
  form.id = undefined;
  form.subjectId = null;
  form.deptId = null;
  form.amount = null;
  form.dateMode = 'MONTH';
  form.month = query.period || currentMonth();
  form.dateRange = null;
  form.remark = '';
}

function handleAdd() {
  isEdit.value = false;
  resetForm();
  dialogVisible.value = true;
}

function handleEdit(row: LedgerEntry) {
  isEdit.value = true;
  resetForm();
  const month = row.startDate?.slice(0, 7);
  const fullMonth = month && row.startDate === `${month}-01`;
  Object.assign(form, {
    id: row.id,
    subjectId: row.subjectId,
    deptId: row.deptId,
    amount: row.amount,
    dateMode: fullMonth ? 'MONTH' : 'RANGE',
    month: month || currentMonth(),
    dateRange: [row.startDate, row.endDate],
    remark: row.remark
  });
  dialogVisible.value = true;
}

function handleSubjectChange(value: number) {
  const subject = subjects.value.find((s) => s.id === value);
  if (subject) form.subjectId = subject.id;
}

function handleDeptChange(value: string | number | undefined) {
  form.deptId = value === undefined || value === null ? null : Number(value);
}

async function handleSubmit() {
  await formRef.value?.validate();
  const range = previewRange.value;
  if (!range) {
    ElMessage.warning('请选择生效期间');
    return;
  }
  saving.value = true;
  try {
    const payload: Partial<LedgerEntry> = {
      id: form.id,
      subjectId: form.subjectId!,
      deptId: form.deptId!,
      amount: form.amount!,
      startDate: range[0],
      endDate: range[1],
      remark: form.remark
    };
    if (isEdit.value) {
      await ledgerApi.updateEntry(payload);
      ElMessage.success('录入已更新');
    } else {
      await ledgerApi.createEntry(payload);
      ElMessage.success('录入已新增');
    }
    dialogVisible.value = false;
    await loadEntries();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: LedgerEntry) {
  await ElMessageBox.confirm(
    `确定删除「${row.subjectPath || row.subjectName}」在 ${row.deptName || ''} 的这条录入？`,
    '提示',
    { type: 'warning' }
  );
  await ledgerApi.deleteEntry(row.id);
  ElMessage.success('已删除');
  await loadEntries();
}

watch(
  () => form.dateMode,
  () => {
    if (form.dateMode === 'MONTH' && !form.month) form.month = query.period || currentMonth();
  }
);

onMounted(async () => {
  await Promise.all([loadSubjects(), loadEntries()]);
});
</script>

<style scoped>
.ledger-entry-page {
  padding: 16px;
}
.query-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.flex-1 {
  flex: 1;
}
.sign-tip {
  margin-bottom: 8px;
}
.subject-path {
  font-weight: 500;
}
.negative {
  color: #f56c6c;
}
.form-tip {
  width: 100%;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
  margin-top: 4px;
}
.form-tip.inline {
  width: auto;
  margin-left: 10px;
  margin-top: 0;
}
.preview-box {
  width: 100%;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 20px;
}
.preview-box .sub {
  color: #909399;
  font-size: 12px;
}
</style>
