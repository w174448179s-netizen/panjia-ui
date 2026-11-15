<template>
  <div class="p-2 app-container people-im-mapping-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="匹配状态">
          <el-select v-model="queryParams.matchStatus" placeholder="全部" clearable style="width: 140px">
            <el-option label="已匹配" value="MATCHED" />
            <el-option label="未匹配" value="UNMATCHED" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-select v-model="queryParams.active" placeholder="全部" clearable style="width: 140px">
            <el-option label="在职" :value="true" />
            <el-option label="离职/停用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="queryParams.keyword"
            placeholder="姓名/工号/手机号/钉钉ID"
            clearable
            style="width: 220px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 映射列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">DingTalk Accounts</span>
            <h3>钉钉账号</h3>
            <p>
              共 {{ total }} 个钉钉账号。同步时按工号自动匹配本地员工；未匹配的可人工绑定，绑定后即可向该钉钉账号推送工作通知与待办。
            </p>
          </div>
          <div class="toolbar-actions">
            <el-button
              v-hasPermi="['dingtalk:sync:employee']"
              type="primary"
              plain
              icon="RefreshRight"
              @click="syncVisible = true"
            >
              同步钉钉账号
            </el-button>
            <el-button icon="Refresh" :loading="loading" @click="getList">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="mappingList">
        <el-table-column label="钉钉姓名" align="center" prop="externalName" width="110" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.externalName">{{ scope.row.externalName }}</span>
            <span v-else class="empty-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="钉钉工号" align="center" prop="externalCode" width="110">
          <template #default="scope">
            <span v-if="scope.row.externalCode">{{ scope.row.externalCode }}</span>
            <span v-else class="empty-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="手机号" align="center" prop="externalMobile" width="130">
          <template #default="scope">
            <span v-if="scope.row.externalMobile">{{ scope.row.externalMobile }}</span>
            <span v-else class="empty-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="账号状态" align="center" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.externalActive ? 'success' : 'info'" size="small">
              {{ scope.row.externalActive ? '在职' : '离职/停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配员工" align="center" min-width="140">
          <template #default="scope">
            <span v-if="scope.row.employeeName">
              {{ scope.row.employeeName }}
              <span v-if="scope.row.externalCode" class="sub-text">（{{ scope.row.externalCode }}）</span>
            </span>
            <span v-else class="empty-text">未匹配</span>
          </template>
        </el-table-column>
        <el-table-column label="登录账号" align="center" prop="userName" width="120">
          <template #default="scope">
            <span v-if="scope.row.userName">{{ scope.row.userName }}</span>
            <span v-else class="empty-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="匹配方式" align="center" width="110">
          <template #default="scope">
            <el-tag :type="matchTypeTag(scope.row.matchType)" size="small">
              {{ matchTypeLabel(scope.row.matchType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步" align="center" prop="lastSyncTime" width="170">
          <template #default="scope">
            <span v-if="scope.row.lastSyncTime">{{ scope.row.lastSyncTime }}</span>
            <span v-else class="empty-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="120" fixed="right">
          <template #default="scope">
            <el-button
              v-hasPermi="['people:im:bind']"
              link
              type="primary"

              @click="openBind(scope.row as ImUserMapping)"
            >
              绑定
            </el-button>
            <el-button
              v-if="scope.row.employeeId"
              v-hasPermi="['people:im:bind']"
              link
              type="danger"

              @click="handleUnbind(scope.row as ImUserMapping)"
            >
              解绑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>

    <!-- 人工绑定 -->
    <el-dialog v-model="bindVisible" title="人工绑定映射" width="520px" append-to-body>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="bind-alert"
        :title="`钉钉账号：${bindRow?.externalName || '—'}${bindRow?.externalCode ? '（' + bindRow.externalCode + '）' : ''}`"
      />
      <el-form label-width="90px">
        <el-form-item label="绑定员工" required>
          <el-select
            v-model="bindEmployeeId"
            filterable
            remote
            clearable
            reserve-keyword
            :remote-method="searchEmployeeOptions"
            :loading="employeeSearching"
            placeholder="输入工号/姓名搜索员工"
            style="width: 100%"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="binding" @click="submitBind">确 定</el-button>
        <el-button @click="bindVisible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- 同步钉钉账号（复用钉钉同步面板：触发同步 + 查看同步记录） -->
    <el-dialog v-model="syncVisible" title="同步钉钉账号" width="1000px" append-to-body>
      <DingTalkSyncPanel type="EMPLOYEE" embedded @finished="getList" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="PeopleImMapping">
import { onMounted, reactive, ref } from 'vue';
import { imMappingApi } from '@/api/panjia/imMapping';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee, ImUserMapping } from '@/api/panjia/types';
import DingTalkSyncPanel from '@/views/people/dingtalk/components/DingTalkSyncPanel.vue';
import modal from '@/plugins/modal';

/** 匹配方式中文标签 */
const MATCH_TYPE_LABELS: Record<string, string> = {
  CODE: '工号匹配',
  MOBILE: '手机号匹配',
  MANUAL: '人工绑定',
  NONE: '未匹配'
};

const matchTypeLabel = (matchType?: string | null) =>
  matchType ? MATCH_TYPE_LABELS[matchType] ?? matchType : '未匹配';
const matchTypeTag = (matchType?: string | null) => {
  if (matchType === 'MANUAL') return 'warning';
  if (matchType === 'CODE' || matchType === 'MOBILE') return 'success';
  return 'info';
};

// ==================== 列表 ====================
const syncVisible = ref(false);
const loading = ref(false);
const mappingList = ref<ImUserMapping[]>([]);
const total = ref(0);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  channel: 'DINGTALK',
  matchStatus: '',
  keyword: '',
  active: undefined as boolean | undefined
});

const getList = async () => {
  loading.value = true;
  try {
    const res = await imMappingApi.list({ ...queryParams });
    mappingList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.channel = 'DINGTALK';
  queryParams.matchStatus = '';
  queryParams.keyword = '';
  queryParams.active = undefined;
  handleQuery();
};

// ==================== 人工绑定 ====================
const bindVisible = ref(false);
const bindRow = ref<ImUserMapping | null>(null);
const bindEmployeeId = ref<string | number | undefined>(undefined);
const binding = ref(false);
const employeeOptions = ref<Employee[]>([]);
const employeeSearching = ref(false);

const ACTIVE_STATUS = ['ACTIVE', 'PARTTIME', 'PENDING'];

const searchEmployeeOptions = async (keyword: string) => {
  if (!keyword || !keyword.trim()) {
    employeeOptions.value = [];
    return;
  }
  employeeSearching.value = true;
  try {
    const res = await employeeApi.list({
      pageNum: 1,
      pageSize: 20,
      employeeName: keyword.trim(),
      status: ACTIVE_STATUS
    });
    let rows = res.data?.rows ?? [];
    // 关键字可能是工号：按姓名无结果时用工号再试一次
    if (!rows.length) {
      const byCode = await employeeApi.list({
        pageNum: 1,
        pageSize: 20,
        employeeCode: keyword.trim(),
        status: ACTIVE_STATUS
      });
      rows = byCode.data?.rows ?? [];
    }
    employeeOptions.value = rows;
  } finally {
    employeeSearching.value = false;
  }
};

const openBind = (row: ImUserMapping) => {
  bindRow.value = row;
  bindEmployeeId.value = row.employeeId ?? undefined;
  employeeOptions.value = [];
  bindVisible.value = true;
};

const submitBind = async () => {
  if (!bindRow.value || !bindEmployeeId.value) {
    modal.msgWarning('请选择要绑定的员工');
    return;
  }
  binding.value = true;
  try {
    // employeeId 是 19 位雪花 ID，转 Number 会丢精度导致后端查不到员工，保持字符串原样提交
    await imMappingApi.bind(bindRow.value.mappingId, { employeeId: bindEmployeeId.value });
    modal.msgSuccess('绑定成功');
    bindVisible.value = false;
    getList();
  } finally {
    binding.value = false;
  }
};

const handleUnbind = async (row: ImUserMapping) => {
  try {
    await modal.confirm(`确认解除「${row.externalName || row.externalUserId || ''}」与员工的绑定吗？`);
  } catch {
    return;
  }
  await imMappingApi.unbind(row.mappingId);
  modal.msgSuccess('已解绑');
  // 解绑后该行变为「未匹配」，若当前筛选的是「已匹配」会被过滤掉，看起来像记录消失
  if (queryParams.matchStatus === 'MATCHED') {
    queryParams.matchStatus = '';
  }
  getList();
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.empty-text {
  color: var(--el-text-color-placeholder);
}

.sub-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.bind-alert {
  margin-bottom: 14px;
}
</style>
