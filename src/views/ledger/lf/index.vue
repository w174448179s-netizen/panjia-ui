<template>
  <div class="app-container ledger-lf-page">
    <div class="lf-page-header">
      <div>
        <div class="lf-page-title">理房通流水</div>
        <div class="lf-page-subtitle">按门店导入账户流水，匹配实收业绩并归集费用</div>
      </div>
      <div class="lf-page-actions">
        <el-button type="primary" icon="Upload" v-hasPermi="['ledger:lf:import']" @click="openImport">
          导入流水
        </el-button>
        <el-button icon="Warning" v-hasPermi="['ledger:lf:list']" @click="openPending">待补科目</el-button>
        <el-button icon="DataAnalysis" v-hasPermi="['ledger:lf:list']" @click="openDiff">差异报表</el-button>
        <el-button icon="Download" v-hasPermi="['ledger:lf:export']" @click="handleExport">导出</el-button>
      </div>
    </div>

    <el-card shadow="never" class="lf-filter-card">
      <el-form :inline="true" class="lf-filter-form" @submit.prevent>
        <el-form-item label="归属月">
          <el-date-picker
            v-model="query.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            clearable
            style="width: 140px"
            @change="handleSearch"
          />
        </el-form-item>
        <el-form-item label="门店">
          <el-select
            v-model="query.storeDeptId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 170px"
            @change="handleSearch"
          >
            <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收支类型">
          <el-select
            v-model="query.incomeExpenseType"
            placeholder="全部"
            clearable
            style="width: 110px"
            @change="handleSearch"
          >
            <el-option label="收入" value="收入" />
            <el-option label="支出" value="支出" />
            <el-option label="提现" value="提现" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="query.category"
            placeholder="全部"
            clearable
            style="width: 130px"
            @change="handleSearch"
          >
            <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="流水类型">
          <el-select
            v-model="query.decorationFlag"
            placeholder="全部"
            clearable
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option label="去化流水" :value="true" />
            <el-option label="普通流水" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="交易类型">
          <el-input
            v-model="query.transactionType"
            placeholder="输入交易类型"
            clearable
            style="width: 160px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="划归状态">
          <el-select
            v-model="query.allocStatus"
            placeholder="全部"
            clearable
            style="width: 130px"
            @change="handleSearch"
          >
            <el-option label="待划归" value="PENDING" />
            <el-option label="自动划归" value="AUTO" />
            <el-option label="手工划归" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配状态">
          <el-select
            v-model="query.matchStatus"
            placeholder="全部"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option v-for="item in matchStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="query.keyword"
            placeholder="合同号 / 业务描述 / 对方户名"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item class="lf-filter-actions">
          <el-button type="primary" icon="Search" @click="handleSearch">查询</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="lf-table-card">
      <div class="lf-toolbar">
        <div class="lf-toolbar-left">
          <span class="lf-toolbar-title">流水明细</span>
          <span class="lf-toolbar-count">共 {{ total }} 条</span>
        </div>
        <div class="lf-toolbar-right">
          <span class="lf-selected">已选 {{ selectedRows.length }} 条费用流水</span>
          <el-button
            type="primary"
            plain
            size="small"
            :disabled="!selectedRows.length"
            v-hasPermi="['ledger:lf:alloc']"
            @click="openAlloc"
          >
            费用划归
          </el-button>
        </div>
      </div>
      <div class="alloc-tip">单组门店自动划归；多组门店需手工选择归属组。</div>

      <el-table
        v-loading="loading"
        :data="rows"
        border
        size="small"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="42" :selectable="canAllocate" />
        <el-table-column label="动账时间" width="155" align="center">
          <template #default="{ row }">{{ formatTime(row.transactionTime) }}</template>
        </el-table-column>
        <el-table-column prop="storeName" label="门店" width="120" />
        <el-table-column label="收支类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.incomeExpenseType === '收入' ? 'success' : 'info'" size="small">
              {{ row.incomeExpenseType || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="transactionType" label="交易类型" width="140" show-overflow-tooltip />
        <el-table-column label="交易金额" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ negative: Number(row.transactionAmount) < 0 }">{{ formatMoney(row.transactionAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="账户余额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.accountBalance) }}</template>
        </el-table-column>
        <el-table-column label="分类" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.category)" size="small">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="费用科目" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.subjectName">{{ row.subjectName }}</span>
            <el-tag v-else-if="row.category === 'FEE'" type="warning" size="small">待补科目</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="费用归属组" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.expenseDeptName">{{ row.expenseDeptName }}</span>
            <el-tag v-else-if="row.category === 'FEE'" type="danger" size="small">待划归</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="匹配状态" width="130" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.matchStatus" :type="matchTagType(row.matchStatus)" size="small">
              {{ matchStatusLabel(row.matchStatus) }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="去化补录" width="110" align="center">
          <template #default="{ row }">
            <template v-if="row.decorationFlag">
              <el-tooltip
                v-if="row.matchStatus === 'PENDING_SIGN_ROLE'"
                content="该合同未找到去化模式新签角色人，暂不能生成实收"
                placement="top"
              >
                <el-tag type="danger" size="small">未补录</el-tag>
              </el-tooltip>
              <el-tag v-else-if="row.matchStatus === 'MATCHED'" type="success" size="small">已补录</el-tag>
              <el-tag v-else type="info" size="small">待匹配</el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="businessDesc" label="业务描述" min-width="190" show-overflow-tooltip />
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="houseNo" label="房屋编号" width="130" show-overflow-tooltip />
        <el-table-column prop="contractNo" label="合同编号" width="140" show-overflow-tooltip />
        <el-table-column prop="transactionRemark" label="交易备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="counterpartyName" label="对方户名" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.category === 'FEE'"
              link
              type="primary"
              v-hasPermi="['ledger:lf:alloc']"
              @click="openAllocForRow(row)"
            >
              划归
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无理房通流水，请先导入" />
        </template>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        class="lf-pagination"
        @current-change="loadRows"
        @size-change="handlePageSizeChange"
      />
    </el-card>

    <el-dialog v-model="importVisible" title="导入理房通流水" width="640px" destroy-on-close @closed="resetImport">
      <el-form label-width="100px">
        <el-form-item label="门店账户" required>
          <el-select v-model="importAccountId" placeholder="请选择门店对公账户" filterable :disabled="importing" style="width: 100%">
            <el-option
              v-for="a in enabledAccounts"
              :key="a.id"
              :label="`${a.storeName}（${a.accountName}）`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="流水文件" required>
          <el-upload
            drag
            :auto-upload="false"
            :limit="1"
            :disabled="importing"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
          >
            <div class="el-upload__text">将理房通账户明细 Excel 拖到此处，或<em>点击选择</em></div>
          </el-upload>
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="系统按文件名前缀识别门店和对公账户；提交后由后台异步导入，可重复导入并按记账流水号覆盖更新。"
      />
      <div v-if="importResult" class="import-result">
        <div class="result-title">
          <span>{{ importResultTitle }}</span>
          <el-tag :type="importStatusTagType" size="small">{{ importStatusLabel }}</el-tag>
        </div>
        <template v-if="importResult.status === 'PROCESSING'">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="文件已归档，后台正在解析、落库并匹配合同；可关闭弹窗，任务会继续执行。"
          />
          <el-progress :percentage="importProgress" class="import-progress" />
        </template>
        <div class="result-grid">
          <span>总行数：{{ importResult.totalRows }}</span>
          <span>成功：{{ importResult.successRows }}</span>
          <span>失败：{{ importResult.failRows }}</span>
          <span>新增：{{ importResult.insertRows }}</span>
          <span>覆盖：{{ importResult.updateRows }}</span>
          <span>跳过：{{ importResult.skippedRows }}</span>
          <span>匹配合同：{{ importResult.matchContractCount }}</span>
          <span>一致：{{ importResult.matchedCount }}</span>
          <span>差异：{{ importResult.diffCount }}</span>
          <span>未找到实收：{{ importResult.notFoundCount }}</span>
          <span>待补角色人：{{ importResult.pendingSignRoleCount }}</span>
          <span>待划归：{{ importResult.pendingAllocCount }}</span>
          <span>待补科目：{{ importResult.pendingSubjectCount }}</span>
        </div>
        <el-alert
          v-if="importResult.unmappedSubjects?.length"
          type="warning"
          :closable="false"
          show-icon
          class="mt8"
          title="以下费用未匹配到收支科目，请到「收支科目配置」新增后点「重新归集」"
        />
        <div v-if="importResult.unmappedSubjects?.length" class="issue-list">
          <div v-for="(item, index) in importResult.unmappedSubjects" :key="index" class="issue-line">{{ item }}</div>
        </div>
        <div v-if="importResult.errors?.length" class="issue-list error">
          <div v-for="(item, index) in importResult.errors" :key="index" class="issue-line">{{ item }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">{{ importing ? '后台运行' : '关闭' }}</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!importFile || !importAccountId || importing"
          @click="submitImport"
        >
          {{ importing ? '后台处理中' : '开始导入' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="allocVisible" title="费用划归" width="480px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="流水条数">
          <span>{{ allocRows.length }} 条</span>
        </el-form-item>
        <el-form-item label="归属门店">
          <span>{{ allocStoreName || '-' }}</span>
        </el-form-item>
        <el-form-item label="归属组" required>
          <el-select v-model="allocDeptId" placeholder="请选择归属组" style="width: 100%">
            <el-option v-for="g in allocGroupOptions" :key="g.value" :label="g.label" :value="g.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="allocRows.length > 1 && !sameStore"
        type="error"
        :closable="false"
        show-icon
        title="所选流水不属于同一门店，不能一起划归，请按门店分别操作。"
      />
      <template #footer>
        <el-button @click="allocVisible = false">取消</el-button>
        <el-button type="primary" :loading="allocating" :disabled="!allocDeptId || !sameStore" @click="submitAlloc">
          确认划归
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pendingVisible" title="待补科目费用" width="680px">
      <div class="pending-toolbar">
        <span>按业务描述汇总，共 {{ pendingTotal }} 类</span>
        <div class="flex-1" />
        <el-button type="primary" plain :loading="rematching" @click="handleRematch">重新归集</el-button>
      </div>
      <el-table :data="pendingList" border size="small" max-height="420">
        <el-table-column prop="desc" label="业务描述" min-width="300" show-overflow-tooltip />
        <el-table-column prop="cnt" label="笔数" width="80" align="center" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有待补科目的费用" />
        </template>
      </el-table>
      <el-pagination
        v-if="pendingTotal > 0"
        v-model:current-page="pendingPageNum"
        v-model:page-size="pendingPageSize"
        :page-sizes="[10, 20, 50]"
        :total="pendingTotal"
        layout="total, sizes, prev, pager, next"
        class="lf-pagination"
        @current-change="loadPending"
        @size-change="handlePendingSizeChange"
      />
      <template #footer>
        <el-button @click="pendingVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="diffVisible" title="理房通流水与实收差异" width="980px">
      <div class="diff-toolbar">
        <el-select v-model="diffQuery.matchStatus" placeholder="全部状态" clearable style="width: 160px" @change="handleDiffSearch">
          <el-option label="一致" value="MATCHED" />
          <el-option label="金额差异" value="AMOUNT_DIFF" />
          <el-option label="未找到实收" value="NOT_FOUND" />
          <el-option label="待补新签角色人" value="PENDING_SIGN_ROLE" />
        </el-select>
        <el-input
          v-model="diffQuery.contractNo"
          placeholder="合同编号"
          clearable
          style="width: 220px"
          @keyup.enter="handleDiffSearch"
          @clear="handleDiffSearch"
        />
        <el-button type="primary" plain icon="Search" @click="handleDiffSearch">查询</el-button>
      </div>
      <el-table v-loading="diffLoading" :data="diffList" border size="small" max-height="480">
        <el-table-column prop="contractNo" label="合同编号" width="150" />
        <el-table-column label="流水净额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.flowAmount) }}</template>
        </el-table-column>
        <el-table-column label="系统实收" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.receivedAmount) }}</template>
        </el-table-column>
        <el-table-column label="差异" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ negative: Math.abs(Number(row.diffAmount)) >= 0.01 }">{{ formatMoney(row.diffAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="matchTagType(row.matchStatus)" size="small">{{ matchStatusLabel(row.matchStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配时间" width="160" align="center">
          <template #default="{ row }">{{ formatTime(row.lastMatchTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDiffDetail(row.contractNo)">查看明细</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无匹配结果" />
        </template>
      </el-table>
      <el-pagination
        v-if="diffTotal > 0"
        v-model:current-page="diffPageNum"
        v-model:page-size="diffPageSize"
        :page-sizes="[20, 50, 100]"
        :total="diffTotal"
        layout="total, sizes, prev, pager, next"
        class="lf-pagination"
        @current-change="loadDiff"
        @size-change="handleDiffSizeChange"
      />
      <template #footer>
        <el-button @click="diffVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="合同匹配明细" size="72%">
      <div v-loading="detailLoading">
        <el-descriptions v-if="diffDetail" :column="4" border size="small">
          <el-descriptions-item label="合同编号">{{ diffDetail.contractNo }}</el-descriptions-item>
          <el-descriptions-item label="流水净额">{{ formatMoney(diffDetail.flowAmount) }}</el-descriptions-item>
          <el-descriptions-item label="系统实收">{{ formatMoney(diffDetail.receivedAmount) }}</el-descriptions-item>
          <el-descriptions-item label="差异">
            <span :class="{ negative: Math.abs(Number(diffDetail.diffAmount)) >= 0.01 }">
              {{ formatMoney(diffDetail.diffAmount) }}
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-title">理房通流水</div>
        <el-table :data="diffDetail?.flowLines || []" border size="small" max-height="260">
          <el-table-column label="动账时间" width="155" align="center">
            <template #default="{ row }">{{ formatTime(row.transactionTime) }}</template>
          </el-table-column>
          <el-table-column prop="storeName" label="门店" width="120" />
          <el-table-column prop="incomeExpenseType" label="收支" width="70" align="center" />
          <el-table-column prop="businessDesc" label="业务描述" min-width="180" show-overflow-tooltip />
          <el-table-column prop="transactionRemark" label="交易备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.transactionAmount) }}</template>
          </el-table-column>
        </el-table>

        <div class="detail-title">系统实收</div>
        <el-table :data="diffDetail?.receivedLines || []" border size="small" max-height="260">
          <el-table-column prop="period" label="归属月" width="90" align="center" />
          <el-table-column prop="employeeId" label="员工ID" width="180" show-overflow-tooltip />
          <el-table-column prop="roleName" label="角色" width="110" />
          <el-table-column prop="roleType" label="角色类型" width="110" />
          <el-table-column label="实收金额" width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.performanceAmount) }}</template>
          </el-table-column>
          <el-table-column prop="sourceType" label="来源" min-width="130" />
          <el-table-column prop="applyStatus" label="审批状态" width="110" align="center" />
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useDeptScope } from '@/hooks/useDeptScope';
import {
  lfApi,
  type LfAccount,
  type LfDiffDetail,
  type LfImportResult,
  type LfMatchResult,
  type LfStatement,
  type LfStatementQuery
} from '@/api/panjia/lf';

const { deptTreeRaw, loadDeptTree } = useDeptScope();

const loading = ref(false);
const rows = ref<LfStatement[]>([]);
const accounts = ref<LfAccount[]>([]);
const pageNum = ref(1);
const pageSize = ref(50);
const total = ref(0);

const query = reactive<LfStatementQuery>({
  period: '',
  storeDeptId: undefined,
  incomeExpenseType: '',
  transactionType: '',
  category: '',
  decorationFlag: undefined,
  allocStatus: '',
  matchStatus: '',
  keyword: ''
});

const categoryOptions = [
  { label: '业务收入', value: 'BUSINESS' },
  { label: '费用支出', value: 'FEE' },
  { label: '业务冲减', value: 'REVERSAL' },
  { label: '提现', value: 'WITHDRAW' },
  { label: '非业务', value: 'NON_BUSINESS' }
];

const matchStatusOptions = [
  { label: '一致', value: 'MATCHED' },
  { label: '金额差异', value: 'AMOUNT_DIFF' },
  { label: '未找到实收', value: 'NOT_FOUND' },
  { label: '待补新签角色人', value: 'PENDING_SIGN_ROLE' }
];

const storeOptions = computed(() => {
  const map = new Map<string, string>();
  accounts.value.forEach((a) => {
    if (a.storeDeptId && a.storeName) map.set(String(a.storeDeptId), a.storeName);
  });
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
});

const enabledAccounts = computed(() => accounts.value.filter((a) => a.status === '0'));

const selectedRows = ref<LfStatement[]>([]);

const importVisible = ref(false);
const importing = ref(false);
const importFile = ref<File | null>(null);
const importAccountId = ref<string | number | null>(null);
const importResult = ref<LfImportResult | null>(null);
const pageDestroyed = ref(false);

const importResultTitle = computed(() => {
  const status = importResult.value?.status;
  if (status === 'FAILED') return '导入失败';
  if (status === 'PARTIAL') return '部分导入完成';
  if (status === 'PROCESSING') return '后台导入中';
  return '导入完成';
});

const importStatusLabel = computed(() => {
  const status = importResult.value?.status;
  if (status === 'FAILED') return '失败';
  if (status === 'PARTIAL') return '部分失败';
  if (status === 'PROCESSING') return '处理中';
  return '成功';
});

const importStatusTagType = computed<'success' | 'warning' | 'danger' | 'info'>(() => {
  const status = importResult.value?.status;
  if (status === 'FAILED') return 'danger';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'PROCESSING') return 'info';
  return 'success';
});

const importProgress = computed(() => {
  const result = importResult.value;
  if (!result || result.totalRows <= 0) return 0;
  const percentage = Math.round(((result.successRows + result.failRows) / result.totalRows) * 100);
  return result.status === 'PROCESSING' ? Math.min(99, percentage) : Math.min(100, percentage);
});

const allocVisible = ref(false);
const allocating = ref(false);
const allocRows = ref<LfStatement[]>([]);
const allocDeptId = ref<string | number | null>(null);

const pendingVisible = ref(false);
const pendingList = ref<Array<{ desc: string; cnt: number; amount: number }>>([]);
const pendingPageNum = ref(1);
const pendingPageSize = ref(10);
const pendingTotal = ref(0);
const rematching = ref(false);

const diffVisible = ref(false);
const diffLoading = ref(false);
const diffList = ref<LfMatchResult[]>([]);
const diffPageNum = ref(1);
const diffPageSize = ref(20);
const diffTotal = ref(0);
const diffQuery = reactive({ matchStatus: '', contractNo: '' });

const detailVisible = ref(false);
const detailLoading = ref(false);
const diffDetail = ref<LfDiffDetail | null>(null);

const allocStoreId = computed(() => {
  const ids = new Set(allocRows.value.map((r) => String(r.storeDeptId || '')));
  return ids.size === 1 ? Array.from(ids)[0] : '';
});

const sameStore = computed(() => Boolean(allocStoreId.value));

const allocStoreName = computed(() => allocRows.value[0]?.storeName || '');

const allocGroupOptions = computed(() => {
  if (!allocStoreId.value) return [];
  const store = findDept(deptTreeRaw.value as any[], allocStoreId.value);
  return (store?.children || []).map((child: any) => ({
    label: child.deptName,
    value: String(child.deptId)
  }));
});

function findDept(nodes: any[], deptId: string): any {
  for (const node of nodes || []) {
    if (String(node.deptId) === deptId) return node;
    const found = findDept(node.children || [], deptId);
    if (found) return found;
  }
  return null;
}

async function loadAccounts() {
  const page = await lfApi.listAccounts({ pageNum: 1, pageSize: 500 });
  accounts.value = page.rows || [];
}

async function loadRows() {
  loading.value = true;
  try {
    const page = await lfApi.listStatements({
      ...query,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    });
    rows.value = page.rows || [];
    total.value = Number(page.total || 0);
    if (rows.value.length === 0 && total.value > 0 && pageNum.value > 1) {
      pageNum.value = 1;
      await loadRows();
    }
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange() {
  pageNum.value = 1;
  loadRows();
}

function handleSearch() {
  pageNum.value = 1;
  loadRows();
}

function resetQuery() {
  query.period = '';
  query.storeDeptId = undefined;
  query.incomeExpenseType = '';
  query.transactionType = '';
  query.category = '';
  query.decorationFlag = undefined;
  query.allocStatus = '';
  query.matchStatus = '';
  query.keyword = '';
  handleSearch();
}

function handleSelectionChange(selection: LfStatement[]) {
  selectedRows.value = selection;
}

function canAllocate(row: any) {
  return row.category === 'FEE';
}

function openImport() {
  importVisible.value = true;
}

function handleFileChange(file: any) {
  importFile.value = file.raw;
  importResult.value = null;
}

function handleFileRemove() {
  importFile.value = null;
}

function resetImport() {
  importFile.value = null;
  importAccountId.value = null;
  if (!importing.value) {
    importResult.value = null;
  }
}

async function submitImport() {
  const account = accounts.value.find((a) => String(a.id) === String(importAccountId.value));
  if (!account || !account.storeDeptId) {
    ElMessage.warning('请选择门店账户');
    return;
  }
  if (!importFile.value) {
    ElMessage.warning('请选择流水文件');
    return;
  }
  importing.value = true;
  try {
    const result = await lfApi.importStatements(importFile.value, account.storeDeptId);
    importResult.value = result;
    if (result.batchId === undefined) {
      importing.value = false;
      ElMessage.error('导入任务提交失败，请稍后重试');
      return;
    }
    ElMessage.success('文件已提交，后台开始导入');
    void pollImportResult(result.batchId);
  } catch (error) {
    importing.value = false;
    throw error;
  }
}

async function pollImportResult(batchId: string | number) {
  while (!pageDestroyed.value) {
    let latest: LfImportResult;
    try {
      latest = await lfApi.getImportResult(batchId);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    importResult.value = latest;
    if (latest.status !== 'PROCESSING') {
      importing.value = false;
      if (latest.status === 'SUCCESS') {
        ElMessage.success('理房通流水导入完成');
      } else if (latest.status === 'PARTIAL') {
        ElMessage.warning('理房通流水部分导入完成，请查看行级错误');
      } else {
        ElMessage.error('理房通流水导入失败，请查看失败原因');
      }
      await loadRows().catch(() => undefined);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function openAllocForRow(row: any) {
  selectedRows.value = [row];
  openAlloc();
}

function openAlloc() {
  allocRows.value = selectedRows.value.filter((r) => r.category === 'FEE');
  if (!allocRows.value.length) {
    ElMessage.warning('请选择费用类流水');
    return;
  }
  allocDeptId.value = null;
  allocVisible.value = true;
}

async function submitAlloc() {
  if (!sameStore.value) {
    ElMessage.warning('所选流水不属于同一门店');
    return;
  }
  if (!allocDeptId.value) {
    ElMessage.warning('请选择归属组');
    return;
  }
  allocating.value = true;
  try {
    const count = await lfApi.allocate(
      allocRows.value.map((r) => r.id),
      allocDeptId.value
    );
    ElMessage.success(`已划归 ${count} 条费用`);
    allocVisible.value = false;
    await loadRows();
  } finally {
    allocating.value = false;
  }
}

async function openPending() {
  pendingVisible.value = true;
  pendingPageNum.value = 1;
  await loadPending();
}

async function loadPending() {
  const page = await lfApi.pendingSubjects({
    storeDeptId: query.storeDeptId,
    pageNum: pendingPageNum.value,
    pageSize: pendingPageSize.value
  });
  pendingList.value = page.rows || [];
  pendingTotal.value = Number(page.total || 0);
}

function handlePendingSizeChange() {
  pendingPageNum.value = 1;
  loadPending();
}

async function handleRematch() {
  await ElMessageBox.confirm('将按当前收支科目重新匹配所有待补科目的费用，是否继续？', '重新归集', {
    type: 'warning'
  });
  rematching.value = true;
  try {
    const count = await lfApi.rematchSubject(query.storeDeptId);
    ElMessage.success(`已重新归集 ${count} 条`);
    pendingPageNum.value = 1;
    await loadPending();
    await loadRows();
  } finally {
    rematching.value = false;
  }
}

async function openDiff() {
  diffVisible.value = true;
  diffPageNum.value = 1;
  await loadDiff();
}

function handleDiffSearch() {
  diffPageNum.value = 1;
  loadDiff();
}

function handleDiffSizeChange() {
  diffPageNum.value = 1;
  loadDiff();
}

async function loadDiff() {
  diffLoading.value = true;
  try {
    const page = await lfApi.diffList({
      ...diffQuery,
      pageNum: diffPageNum.value,
      pageSize: diffPageSize.value
    });
    diffList.value = page.rows || [];
    diffTotal.value = Number(page.total || 0);
  } finally {
    diffLoading.value = false;
  }
}

async function openDiffDetail(contractNo: string) {
  detailVisible.value = true;
  detailLoading.value = true;
  diffDetail.value = null;
  try {
    diffDetail.value = await lfApi.diffDetail(contractNo);
  } finally {
    detailLoading.value = false;
  }
}

function handleExport() {
  lfApi.exportStatements({ ...query });
}

function formatTime(value?: string) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function categoryLabel(value?: string) {
  return categoryOptions.find((item) => item.value === value)?.label || value || '-';
}

function categoryTagType(value?: string) {
  if (value === 'FEE') return 'danger';
  if (value === 'REVERSAL') return 'warning';
  if (value === 'WITHDRAW') return 'info';
  if (value === 'NON_BUSINESS') return 'info';
  return 'success';
}

function matchStatusLabel(value?: string) {
  return matchStatusOptions.find((item) => item.value === value)?.label || value || '-';
}

function matchTagType(value?: string) {
  if (value === 'MATCHED') return 'success';
  if (value === 'AMOUNT_DIFF') return 'warning';
  if (value === 'NOT_FOUND') return 'danger';
  return 'info';
}

onMounted(async () => {
  await Promise.all([loadAccounts(), loadDeptTree(), loadRows()]);
});

onBeforeUnmount(() => {
  pageDestroyed.value = true;
});
</script>

<style scoped>
.lf-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.lf-page-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: #303133;
}

.lf-page-subtitle {
  margin-top: 2px;
  font-size: 13px;
  color: #909399;
}

.lf-page-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.lf-filter-card {
  margin-bottom: 12px;
}

.lf-filter-card :deep(.el-card__body) {
  padding: 16px 16px 4px;
}

.lf-filter-form :deep(.el-form-item) {
  margin-right: 16px;
  margin-bottom: 12px;
}

.lf-filter-form :deep(.lf-filter-actions) {
  margin-right: 0;
}

.lf-table-card :deep(.el-card__body) {
  padding: 16px;
}

.lf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.lf-toolbar-left,
.lf-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lf-toolbar-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.lf-toolbar-count,
.lf-selected {
  font-size: 13px;
  color: #909399;
}

.alloc-tip {
  margin-bottom: 10px;
  padding: 6px 10px;
  color: #909399;
  font-size: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.negative {
  color: #f56c6c;
}

.lf-pagination {
  margin-top: 12px;
  justify-content: flex-end;
}

.import-result {
  margin-top: 12px;
  padding: 12px;
  background: #f7f9fc;
  border-radius: 4px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 8px;
}

.import-progress {
  margin: 12px 0;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 12px;
  font-size: 13px;
  color: #606266;
}

.issue-list {
  margin-top: 6px;
  max-height: 140px;
  overflow-y: auto;
  font-size: 13px;
  color: #b88230;
}

.issue-list.error {
  color: #f56c6c;
}

.issue-line {
  line-height: 22px;
}

.mt8 {
  margin-top: 8px;
}

.pending-toolbar,
.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.detail-title {
  margin: 16px 0 8px;
  font-weight: 600;
}
</style>
