<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>导入模板管理</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams">
          <el-form-item label="单据类型" prop="sourceType">
            <el-select
              v-model="queryParams.sourceType"
              placeholder="全部单据类型"
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="opt in sourceTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 模板列表 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="templateList"
          :default-sort="{ prop: 'sourceType', order: 'ascending' }"
        >
          <el-table-column label="模板编码" align="center" prop="templateCode" min-width="160" show-overflow-tooltip />
          <el-table-column label="版本" align="center" prop="templateVersion" width="100" />
          <el-table-column label="模板名称" align="center" prop="templateName" min-width="200" show-overflow-tooltip />
          <el-table-column label="单据类型" align="center" width="130">
            <template #default="scope">
              {{ sourceTypeMap[scope.row.sourceType] ?? scope.row.sourceType }}
            </template>
          </el-table-column>
          <el-table-column label="文件类型" align="center" prop="fileType" width="100" />
          <el-table-column label="表头行" align="center" prop="headerRow" width="80" />
          <el-table-column label="数据起始行" align="center" prop="dataStartRow" width="100" />
          <el-table-column label="状态" align="center" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.isActive ? 'success' : 'info'" size="small">
                {{ scope.row.isActive ? '已激活' : '未激活' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createdAt" width="170" sortable />
          <el-table-column label="操作" align="center" width="320" class-name="action-col">
            <template #default="scope">
              <div class="action-row">
                <el-tooltip content="下载 Excel 模板" placement="top">
                  <el-button link type="primary" icon="Download" @click="handleDownload(scope.row as ImportTemplate)">
                    下载
                  </el-button>
                </el-tooltip>
                <el-tooltip content="复制为新版本" placement="top">
                  <el-button link type="primary" icon="CopyDocument" @click="handleCopy(scope.row as ImportTemplate)">
                    复制
                  </el-button>
                </el-tooltip>
                <el-tooltip content="查看列映射" placement="top">
                  <el-button link type="primary" icon="View" @click="handleViewColumns(scope.row as ImportTemplate)">
                    列映射
                  </el-button>
                </el-tooltip>
                <el-tooltip
                  :content="scope.row.isActive ? '当前已激活' : '激活此版本'"
                  placement="top"
                  :disabled="scope.row.isActive"
                >
                  <el-button
                    link
                    type="warning"
                    icon="CircleCheck"
                    :disabled="scope.row.isActive"
                    :loading="activatingId === scope.row.id"
                    @click="handleActivate(scope.row as ImportTemplate)"
                  >
                    激活
                  </el-button>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 复制新版本弹窗 -->
    <el-dialog v-model="copyDialog.visible" title="复制为新版本" width="500px" append-to-body>
      <el-form :model="copyForm" label-width="120px">
        <el-form-item label="源模板">
          <span>{{ copyDialog.sourceName }}</span>
        </el-form-item>
        <el-form-item label="新版本号" required>
          <el-input v-model="copyForm.newVersion" placeholder="如 V200" style="width: 200px" />
        </el-form-item>
        <el-form-item label="新模板名称">
          <el-input v-model="copyForm.newName" placeholder="留空则沿用原名称" style="width: 300px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyDialog.visible = false">取 消</el-button>
        <el-button type="primary" :loading="copying" @click="doCopy">确认复制</el-button>
      </template>
    </el-dialog>

    <!-- 列映射查看弹窗 -->
    <el-dialog v-model="columnDialog.visible" title="列映射详情" width="800px" append-to-body>
      <el-table :data="columnDialog.columns" border size="small" max-height="460">
        <el-table-column label="列号" prop="source_column" width="80" align="center" />
        <el-table-column label="表头" prop="source_header" min-width="150" show-overflow-tooltip />
        <el-table-column label="目标字段" prop="target_field" min-width="150" show-overflow-tooltip />
        <el-table-column label="类型" prop="data_type" width="100" align="center" />
        <el-table-column label="必填" width="80" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.required ? 'danger' : 'info'" size="small">
              {{ scope.row.required ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="转换规则" prop="transform" min-width="150" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.transform || '—' }}</template>
        </el-table-column>
        <el-table-column label="默认值" prop="default_value" min-width="120" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.default_value || '—' }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="columnDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { templateApi } from '@/api/panjia/import';
import type { ImportTemplate } from '@/api/panjia/types';
import modal from '@/plugins/modal';

const sourceTypeMap: Record<string, string> = {
  KE_SIGNED: '贝壳结佣',
  KE_NEW_SIGN: '新签业绩',
  ATTENDANCE: '考勤',
  POINTS: '积分',
  OTHERS: '手工费用'
};
const sourceTypeOptions = Object.entries(sourceTypeMap).map(([value, label]) => ({ value, label }));

// ==================== 筛选 ====================
const queryParams = reactive({
  sourceType: ''
});

// ==================== 列表 ====================
const loading = ref(false);
const templateList = ref<ImportTemplate[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const res = await templateApi.list(queryParams.sourceType || undefined);
    templateList.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  queryParams.sourceType = '';
  getList();
};

// ==================== 下载 ====================
const handleDownload = async (row: ImportTemplate) => {
  try {
    await templateApi.download(row.id, `${row.templateName}.xlsx`);
    modal.msgSuccess('模板下载成功');
  } catch {
    modal.msgError('模板下载失败');
  }
};

// ==================== 复制新版本 ====================
const copyDialog = reactive({
  visible: false,
  sourceId: '' as string | number,
  sourceName: ''
});
const copyForm = reactive({
  newVersion: '',
  newName: ''
});
const copying = ref(false);

const handleCopy = (row: ImportTemplate) => {
  copyDialog.sourceId = row.id;
  copyDialog.sourceName = `${row.templateName}（${row.templateVersion}）`;
  copyForm.newVersion = '';
  copyForm.newName = '';
  copyDialog.visible = true;
};

const doCopy = async () => {
  if (!copyForm.newVersion.trim()) {
    modal.msgWarning('请输入新版本号');
    return;
  }
  copying.value = true;
  try {
    await templateApi.copy(copyDialog.sourceId, copyForm.newVersion.trim(), copyForm.newName.trim() || undefined);
    modal.msgSuccess('复制成功，新模板默认未激活');
    copyDialog.visible = false;
    await getList();
  } catch {
    modal.msgError('复制失败');
  } finally {
    copying.value = false;
  }
};

// ==================== 激活 ====================
const activatingId = ref<string | number | undefined>();

const handleActivate = async (row: ImportTemplate) => {
  try {
    await modal.confirm(`确认激活模板「${row.templateName}（${row.templateVersion}）」？同类型其他模板将自动停用。`);
  } catch {
    return;
  }
  activatingId.value = row.id;
  try {
    await templateApi.activate(row.id);
    modal.msgSuccess('模板已激活');
    await getList();
  } catch {
    modal.msgError('激活失败');
  } finally {
    activatingId.value = undefined;
  }
};

// ==================== 列映射查看 ====================
const columnDialog = reactive({
  visible: false,
  columns: [] as Array<Record<string, any>>
});

const handleViewColumns = (row: ImportTemplate) => {
  try {
    const columns = JSON.parse(row.columnMapping);
    columnDialog.columns = Array.isArray(columns) ? columns : [];
  } catch {
    columnDialog.columns = [];
  }
  columnDialog.visible = true;
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.panjia-page {
  padding: 16px;
}

.page-card {
  border-radius: 16px;
}

.card-header {
  font-weight: 600;
  font-size: 16px;
}

.page-content {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .filter-form {
    margin-bottom: 0;
  }

  .data-table {
    width: 100%;
  }

  :deep(.action-col .cell) {
    padding: 0 4px;
  }

  .action-row {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 4px;

    .el-button + .el-button {
      margin-left: 0;
    }
  }
}
</style>
