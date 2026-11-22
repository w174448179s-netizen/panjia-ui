<template>
  <div class="app-container ledger-lf-account-page">
    <el-card shadow="never">
      <div class="query-bar">
        <el-input
          v-model="query.keyword"
          placeholder="门店 / 文件名前缀 / 对公账户"
          clearable
          style="width: 260px"
          @keyup.enter="loadList"
          @clear="loadList"
        />
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 120px" @change="loadList">
          <el-option label="启用" value="0" />
          <el-option label="停用" value="1" />
        </el-select>
        <el-button type="primary" plain icon="Search" @click="loadList">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        <div class="flex-1" />
        <el-button type="primary" icon="Plus" v-hasPermi="['ledger:lf:account:add']" @click="handleAdd">
          新增账户
        </el-button>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="account-tip"
        title="一个门店同一时间只能启用一个对公账户；文件名前缀用于导入时自动识别门店，不能重复。"
      />

      <el-table v-loading="loading" :data="list" border size="small">
        <el-table-column prop="storeName" label="门店" width="150" />
        <el-table-column prop="filePrefix" label="文件名前缀" min-width="240" show-overflow-tooltip />
        <el-table-column prop="accountName" label="对公账户名称" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'info'" size="small">
              {{ row.status === '0' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column prop="updateTime" label="更新时间" width="170" align="center" />
        <el-table-column label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" v-hasPermi="['ledger:lf:account:edit']" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" v-hasPermi="['ledger:lf:account:remove']" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无账户配置" />
        </template>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        class="lf-pagination"
        @current-change="loadList"
        @size-change="handlePageSizeChange"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑理房通账户' : '新增理房通账户'"
      width="560px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="门店" prop="storeDeptId">
          <el-tree-select
            v-model="form.storeDeptId"
            :data="storeTree"
            :props="{ label: 'deptName', children: 'children' }"
            node-key="deptId"
            value-key="deptId"
            check-strictly
            filterable
            placeholder="请选择门店"
            style="width: 100%"
            @change="handleStoreChange"
          />
        </el-form-item>
        <el-form-item label="文件名前缀" prop="filePrefix">
          <el-input v-model="form.filePrefix" placeholder="例如：353517343-B@qq.com" />
          <div class="form-tip">理房通导出文件名以该前缀开头，导入时据此识别门店。</div>
        </el-form-item>
        <el-form-item label="对公账户名称" prop="accountName">
          <el-input v-model="form.accountName" placeholder="例如：成都市人居天街房地产经纪有限公司" />
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
import { useDeptScope } from '@/hooks/useDeptScope';
import { lfApi, type LfAccount } from '@/api/panjia/lf';

const { deptTreeRaw, loadDeptTree } = useDeptScope();

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const list = ref<LfAccount[]>([]);
const pageNum = ref(1);
const pageSize = ref(10);
const total = ref(0);
const formRef = ref();

const query = reactive({
  keyword: '',
  status: ''
});

const form = reactive<LfAccount>({
  id: undefined,
  storeDeptId: null,
  storeName: '',
  filePrefix: '',
  accountName: '',
  status: '0',
  remark: ''
});

const rules = {
  storeDeptId: [{ required: true, message: '请选择门店', trigger: 'change' }],
  filePrefix: [{ required: true, message: '请输入文件名前缀', trigger: 'blur' }],
  accountName: [{ required: true, message: '请输入对公账户名称', trigger: 'blur' }]
};

/** 门店层级：组织根节点下一级 */
const storeTree = computed(() => {
  const roots = (deptTreeRaw.value || []) as any[];
  if (roots.length === 1) {
    return roots[0].children || [];
  }
  return roots.flatMap((root) => root.children || []);
});

async function loadList() {
  loading.value = true;
  try {
    const page = await lfApi.listAccounts({
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    });
    list.value = page.rows || [];
    total.value = Number(page.total || 0);
    if (list.value.length === 0 && total.value > 0 && pageNum.value > 1) {
      pageNum.value = 1;
      await loadList();
    }
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange() {
  pageNum.value = 1;
  loadList();
}

function resetQuery() {
  query.keyword = '';
  query.status = '';
  pageNum.value = 1;
  loadList();
}

function handleAdd() {
  Object.assign(form, {
    id: undefined,
    storeDeptId: null,
    storeName: '',
    filePrefix: '',
    accountName: '',
    status: '0',
    remark: ''
  });
  dialogVisible.value = true;
}

function handleEdit(row: LfAccount) {
  Object.assign(form, row);
  dialogVisible.value = true;
}

function handleStoreChange(value: string | number) {
  const node = findDept(deptTreeRaw.value as any[], String(value));
  if (node) {
    form.storeName = node.deptName;
  }
}

function findDept(nodes: any[], deptId: string): any {
  for (const node of nodes || []) {
    if (String(node.deptId) === deptId) return node;
    const found = findDept(node.children || [], deptId);
    if (found) return found;
  }
  return null;
}

async function handleSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await lfApi.updateAccount(form);
      ElMessage.success('已保存');
    } else {
      await lfApi.createAccount(form);
      ElMessage.success('已新增');
    }
    dialogVisible.value = false;
    await loadList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: LfAccount) {
  await ElMessageBox.confirm(`确定删除「${row.storeName}」的账户配置吗？`, '删除确认', { type: 'warning' });
  if (!row.id) return;
  await lfApi.deleteAccount(row.id);
  ElMessage.success('已删除');
  await loadList();
}

onMounted(async () => {
  await Promise.all([loadDeptTree(), loadList()]);
});
</script>

<style scoped>
.account-tip {
  margin: 8px 0 12px;
}

.form-tip {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.lf-pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
