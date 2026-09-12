<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>导入模板管理</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 域切换 -->
        <el-tabs v-model="domain" class="domain-tabs" @tab-change="handleDomainChange">
          <el-tab-pane label="单据导入模板" name="import" />
          <el-tab-pane label="员工导入模板" name="people" />
        </el-tabs>

        <!-- 筛选条件（仅 import 域） -->
        <el-form v-if="domain === 'import'" class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
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
            <el-button type="primary" icon="Search" @click="getList">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 模板列表 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="templateList"
        >
          <el-table-column
            v-if="domain === 'import'"
            label="模板名称"
            align="center"
            prop="templateName"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="domain === 'import'"
            label="单据类型"
            align="center"
            width="130"
          >
            <template #default="scope">
              {{ sourceTypeMap[scope.row.sourceType] ?? scope.row.sourceType }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="domain === 'people'"
            label="模板编码"
            align="center"
            prop="templateCode"
            width="140"
          />
          <el-table-column label="版本" align="center" prop="templateVersion" width="100" />
          <el-table-column label="列数" align="center" width="80">
            <template #default="scope">
              {{ getColumnCount(scope.row) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" width="100">
            <template #default="scope">
              <el-tag :type="isActive(scope.row) ? 'success' : 'info'" size="small">
                {{ isActive(scope.row) ? '已启用' : '未启用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" width="170" sortable>
            <template #default="scope">
              {{ domain === 'import' ? scope.row.createdAt : scope.row.createTime }}
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="200" class-name="action-col" fixed="right">
            <template #default="scope">
              <div class="action-row">
                <el-tooltip content="下载 Excel 模板" placement="top">
                  <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)" />
                </el-tooltip>
                <el-tooltip content="编辑列映射" placement="top">
                  <el-button link type="primary" icon="Edit" @click="handleEditColumns(scope.row)" />
                </el-tooltip>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, scope.row)">
                  <el-button link type="primary" icon="MoreFilled" />
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="copy" icon="CopyDocument">复制为新版本</el-dropdown-item>
                      <el-dropdown-item command="compare" icon="DataAnalysis">版本对比</el-dropdown-item>
                      <el-dropdown-item
                        command="activate"
                        icon="CircleCheck"
                        :disabled="isActive(scope.row)"
                      >
                        {{ isActive(scope.row) ? '当前已启用' : '启用此版本' }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
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
        <el-form-item v-if="domain === 'import'" label="新模板名称">
          <el-input v-model="copyForm.newName" placeholder="留空则沿用原名称" style="width: 300px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyDialog.visible = false">取 消</el-button>
        <el-button type="primary" :loading="copying" @click="doCopy">确认复制</el-button>
      </template>
    </el-dialog>

    <!-- 列映射编辑弹窗 -->
    <el-dialog v-model="columnDialog.visible" title="编辑列映射" width="1000px" append-to-body>
      <div class="column-dialog-header">
        <span>{{ columnDialog.templateName }}（{{ columnDialog.templateVersion }}）</span>
        <el-button type="primary" size="small" icon="Plus" @click="addColumn">新增列</el-button>
      </div>
      <el-table :data="columnDialog.columns" border size="small" max-height="480">
        <el-table-column label="序号" type="index" width="60" align="center" />
        <el-table-column label="Excel 表头" min-width="140">
          <template #default="scope">
            <el-input v-model="scope.row.colName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="目标字段" min-width="160">
          <template #default="scope">
            <el-input v-model="scope.row.field" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110" align="center">
          <template #default="scope">
            <el-select v-model="scope.row.type" size="small" style="width: 100%">
              <el-option label="STRING" value="STRING" />
              <el-option label="INT" value="INT" />
              <el-option label="DECIMAL" value="DECIMAL" />
              <el-option label="DATE" value="DATE" />
              <el-option label="BOOL" value="BOOL" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="必填" width="70" align="center">
          <template #default="scope">
            <el-switch v-model="scope.row.required" />
          </template>
        </el-table-column>
        <el-table-column v-if="domain === 'people'" label="枚举值" min-width="160">
          <template #default="scope">
            <el-input
              v-model="scope.row.enumValuesText"
              placeholder="逗号分隔，如 A0,A1,A2"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="domain === 'people'" label="日期格式" width="130">
          <template #default="scope">
            <el-input v-model="scope.row.dateFormat" placeholder="yyyy-MM-dd" size="small" />
          </template>
        </el-table-column>
        <el-table-column v-if="domain === 'import'" label="转换规则" min-width="140">
          <template #default="scope">
            <el-input v-model="scope.row.transform" placeholder="如 lookup:dict_type" size="small" />
          </template>
        </el-table-column>
        <el-table-column v-if="domain === 'import'" label="默认值" width="100">
          <template #default="scope">
            <el-input v-model="scope.row.default_value" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center" fixed="right">
          <template #default="scope">
            <el-button link type="danger" icon="Delete" size="small" @click="removeColumn(scope.$index)" />
          </template>
        </el-table-column>
      </el-table>
      <div class="column-dialog-tip">
        <el-alert
          v-if="columnDialog.isActive"
          title="已启用的模板不允许直接编辑，请先复制为新版本再修改"
          type="warning"
          :closable="false"
          show-icon
        />
      </div>
      <template #footer>
        <el-button @click="columnDialog.visible = false">取 消</el-button>
        <el-button type="primary" :loading="savingColumns" :disabled="columnDialog.isActive" @click="doSaveColumns">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 版本对比弹窗 -->
    <el-dialog v-model="compareDialog.visible" title="版本对比" width="900px" append-to-body>
      <div class="compare-select">
        <el-select v-model="compareDialog.targetId" placeholder="选择对比目标版本" style="width: 300px">
          <el-option
            v-for="t in compareDialog.candidates"
            :key="t.id"
            :label="`${t.templateVersion} - ${domain === 'import' ? t.templateName : t.templateCode}`"
            :value="t.id"
          />
        </el-select>
        <el-button type="primary" :loading="comparing" @click="doCompare">开始对比</el-button>
      </div>
      <el-table v-loading="comparing" :data="compareDialog.diffList" border size="small" max-height="480">
        <el-table-column label="字段" prop="field" min-width="160" show-overflow-tooltip />
        <el-table-column label="变更类型" width="100" align="center">
          <template #default="scope">
            <el-tag :type="diffTagType(scope.row.changeType)" size="small">
              {{ diffLabel(scope.row.changeType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="原表头" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.sourceHeader || '—' }}</template>
        </el-table-column>
        <el-table-column label="新表头" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.targetHeader || '—' }}</template>
        </el-table-column>
        <el-table-column label="原类型" width="90" align="center">
          <template #default="scope">{{ scope.row.sourceType || '—' }}</template>
        </el-table-column>
        <el-table-column label="新类型" width="90" align="center">
          <template #default="scope">{{ scope.row.targetType || '—' }}</template>
        </el-table-column>
        <el-table-column label="差异详情" min-width="200" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.diffDetail }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="compareDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { templateApi, peopleTemplateApi } from '@/api/panjia/import';
import type { ImportTemplate, PeopleImportTemplate, ColumnDef, ColumnMapping, TemplateColumnDiff } from '@/api/panjia/types';
import modal from '@/plugins/modal';

const sourceTypeMap: Record<string, string> = {
  KE_SIGNED: '贝壳业绩明细',
  ATTENDANCE: '考勤',
  POINTS: '积分',
  OTHERS: '手工费用'
};
const sourceTypeOptions = Object.entries(sourceTypeMap).map(([value, label]) => ({ value, label }));

type DomainType = 'import' | 'people';
const domain = ref<DomainType>('import');

// ==================== 列表 ====================
const loading = ref(false);
const templateList = ref<any[]>([]);
const queryParams = reactive({ sourceType: '' });

const getList = async () => {
  loading.value = true;
  try {
    if (domain.value === 'import') {
      const res = await templateApi.list(queryParams.sourceType || undefined);
      templateList.value = res.data ?? [];
    } else {
      const res = await peopleTemplateApi.list();
      templateList.value = res.data ?? [];
    }
  } finally {
    loading.value = false;
  }
};

const handleDomainChange = () => {
  templateList.value = [];
  getList();
};

const resetQuery = () => {
  queryParams.sourceType = '';
  getList();
};

const isActive = (row: any): boolean => {
  if (domain.value === 'import') return (row as ImportTemplate).isActive;
  return (row as PeopleImportTemplate).enabled === 1;
};

const getColumnCount = (row: any): number => {
  try {
    const json = domain.value === 'import' ? row.columnMapping : row.columnJson;
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
};

const getTemplateName = (row: any): string => {
  if (domain.value === 'import') return (row as ImportTemplate).templateName;
  return (row as PeopleImportTemplate).templateCode;
};

// ==================== 下载 ====================
const handleDownload = async (row: any) => {
  try {
    const name = domain.value === 'import'
      ? `${row.templateName}.xlsx`
      : `员工导入模板_${row.templateVersion}.xlsx`;
    if (domain.value === 'import') {
      await templateApi.download(row.id, name);
    } else {
      await peopleTemplateApi.download(row.id, name);
    }
    modal.msgSuccess('模板下载成功');
  } catch {
    modal.msgError('模板下载失败');
  }
};

// ==================== 操作下拉菜单 ====================
const handleAction = (cmd: string, row: any) => {
  switch (cmd) {
    case 'copy':
      handleCopy(row);
      break;
    case 'compare':
      handleCompare(row);
      break;
    case 'activate':
      handleActivate(row);
      break;
  }
};

// ==================== 复制新版本 ====================
const copyDialog = reactive({
  visible: false,
  sourceId: '' as string | number,
  sourceName: ''
});
const copyForm = reactive({ newVersion: '', newName: '' });
const copying = ref(false);

const handleCopy = (row: any) => {
  copyDialog.sourceId = row.id;
  copyDialog.sourceName = `${getTemplateName(row)}（${row.templateVersion}）`;
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
    if (domain.value === 'import') {
      await templateApi.copy(
        copyDialog.sourceId,
        copyForm.newVersion.trim(),
        copyForm.newName.trim() || undefined
      );
    } else {
      await peopleTemplateApi.copy(copyDialog.sourceId, copyForm.newVersion.trim());
    }
    modal.msgSuccess('复制成功，新模板默认未启用');
    copyDialog.visible = false;
    await getList();
  } catch {
    modal.msgError('复制失败');
  } finally {
    copying.value = false;
  }
};

// ==================== 启用 ====================
const activatingId = ref<string | number | undefined>();

const handleActivate = async (row: any) => {
  try {
    await modal.confirm(`确认启用模板「${getTemplateName(row)}（${row.templateVersion}）」？同类型其他模板将自动停用。`);
  } catch {
    return;
  }
  activatingId.value = row.id;
  try {
    if (domain.value === 'import') {
      await templateApi.activate(row.id);
    } else {
      await peopleTemplateApi.activate(row.id);
    }
    modal.msgSuccess('模板已启用');
    await getList();
  } catch {
    modal.msgError('启用失败');
  } finally {
    activatingId.value = undefined;
  }
};

// ==================== 列映射编辑 ====================
const columnDialog = reactive({
  visible: false,
  templateId: '' as string | number,
  templateName: '',
  templateVersion: '',
  isActive: false,
  columns: [] as any[]
});
const savingColumns = ref(false);

const handleEditColumns = async (row: any) => {
  columnDialog.templateId = row.id;
  columnDialog.templateName = getTemplateName(row);
  columnDialog.templateVersion = row.templateVersion;
  columnDialog.isActive = isActive(row);
  columnDialog.columns = [];
  columnDialog.visible = true;
  try {
    let res;
    if (domain.value === 'import') {
      res = await templateApi.getColumns(row.id);
      columnDialog.columns = (res.data ?? []).map(c => ({
        colName: c.source_header,
        field: c.target_field,
        type: c.data_type,
        required: c.required,
        transform: c.transform,
        default_value: c.default_value,
        source_column: c.source_column
      }));
    } else {
      res = await peopleTemplateApi.getColumns(row.id);
      columnDialog.columns = (res.data ?? []).map((c: ColumnDef) => ({
        ...c,
        enumValuesText: c.enumValues?.join(',') || ''
      }));
    }
  } catch {
    modal.msgError('加载列定义失败');
  }
};

const addColumn = () => {
  if (domain.value === 'import') {
    columnDialog.columns.push({
      colName: '',
      field: '',
      type: 'STRING',
      required: false,
      transform: '',
      default_value: ''
    });
  } else {
    columnDialog.columns.push({
      colName: '',
      field: '',
      type: 'STRING',
      required: false,
      enumValuesText: ''
    });
  }
};

const removeColumn = (index: number) => {
  columnDialog.columns.splice(index, 1);
};

const doSaveColumns = async () => {
  // 校验
  for (let i = 0; i < columnDialog.columns.length; i++) {
    const col = columnDialog.columns[i];
    if (!col.colName || !col.colName.trim()) {
      modal.msgWarning(`第 ${i + 1} 列表头不能为空`);
      return;
    }
    if (!col.field || !col.field.trim()) {
      modal.msgWarning(`第 ${i + 1} 列目标字段不能为空`);
      return;
    }
  }
  savingColumns.value = true;
  try {
    if (domain.value === 'import') {
      const columns: ColumnMapping[] = columnDialog.columns.map((c: any) => ({
        source_column: c.source_column,
        source_header: c.colName?.trim(),
        target_field: c.field?.trim(),
        data_type: c.type,
        required: c.required,
        transform: c.transform || undefined,
        default_value: c.default_value || undefined
      }));
      await templateApi.saveColumns(columnDialog.templateId, columns);
    } else {
      const columns: ColumnDef[] = columnDialog.columns.map((c: any) => ({
        colName: c.colName?.trim(),
        field: c.field?.trim(),
        type: c.type || 'STRING',
        required: c.required,
        maxLength: c.maxLength,
        dateFormat: c.dateFormat || undefined,
        enumValues: c.enumValuesText?.split(',').map((s: string) => s.trim()).filter(Boolean) || undefined,
        deptLevel: c.deptLevel
      }));
      await peopleTemplateApi.saveColumns(columnDialog.templateId, columns);
    }
    modal.msgSuccess('保存成功');
    columnDialog.visible = false;
    await getList();
  } catch {
    modal.msgError('保存失败');
  } finally {
    savingColumns.value = false;
  }
};

// ==================== 版本对比 ====================
const compareDialog = reactive({
  visible: false,
  sourceId: '' as string | number,
  targetId: '' as string | number,
  candidates: [] as any[],
  diffList: [] as TemplateColumnDiff[]
});
const comparing = ref(false);

const handleCompare = (row: any) => {
  compareDialog.sourceId = row.id;
  compareDialog.targetId = '';
  compareDialog.diffList = [];
  // 过滤掉当前模板自身
  compareDialog.candidates = templateList.value.filter((t: any) => t.id !== row.id);
  compareDialog.visible = true;
};

const doCompare = async () => {
  if (!compareDialog.targetId) {
    modal.msgWarning('请选择对比目标版本');
    return;
  }
  comparing.value = true;
  try {
    let res;
    if (domain.value === 'import') {
      res = await templateApi.compare(compareDialog.sourceId, compareDialog.targetId);
    } else {
      res = await peopleTemplateApi.compare(compareDialog.sourceId, compareDialog.targetId);
    }
    compareDialog.diffList = res.data ?? [];
  } catch {
    modal.msgError('对比失败');
  } finally {
    comparing.value = false;
  }
};

const diffTagType = (type: string): 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, any> = {
    ADDED: 'success',
    REMOVED: 'danger',
    MODIFIED: 'warning',
    UNCHANGED: 'info'
  };
  return map[type] ?? 'info';
};

const diffLabel = (type: string): string => {
  const map: Record<string, string> = {
    ADDED: '新增',
    REMOVED: '删除',
    MODIFIED: '修改',
    UNCHANGED: '未变'
  };
  return map[type] ?? type;
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

  .domain-tabs {
    margin-bottom: -10px;
  }
}

:deep(.action-col .cell) {
  padding: 0 4px;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 2px;

  .el-button + .el-button {
    margin-left: 0;
  }

  .el-dropdown {
    display: inline-flex;
  }
}

.column-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.column-dialog-tip {
  margin-top: 12px;
}

.compare-select {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
</style>
