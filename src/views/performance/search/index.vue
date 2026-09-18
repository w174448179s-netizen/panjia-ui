<template>
  <div class="performance-search-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="期间" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="全部期间"
              clearable
              style="width: 160px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item label="门店/组别" prop="deptId">
            <el-tree-select
              v-model="queryParams.deptId"
              :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any"
              value-key="deptId"
              node-key="deptId"
              placeholder="全部门店/组别"
              clearable
              check-strictly
              style="width: 200px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item label="关键字" prop="keyword">
            <el-input
              v-model.trim="queryParams.keyword"
              placeholder="合同号/订单号/物业地址"
              clearable
              style="width: 260px"
              @keyup.enter="handleQuery"
              @clear="handleQuery"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
            <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          :data="tableData"
          border
          stripe
          :max-height="tableMaxHeight"
        >
          <el-table-column label="合同号/订单号" align="center" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <el-button
                v-if="resolveBizNo(row.bizType, row.contractNo, row.orderNo)"
                type="primary"
                link
                class="no-click"
                @click="openDetail(row as PerformanceFactSearch)"
              >
                {{ resolveBizNo(row.bizType, row.contractNo, row.orderNo) }}
              </el-button>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" align="center" prop="bizType" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.bizType || '—' }}</template>
          </el-table-column>
          <el-table-column label="物业地址" align="center" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
          </el-table-column>
          <el-table-column label="期间" align="center" prop="period" width="90" />
          <el-table-column label="签约日期" align="center" width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDate(row.signDate) }}</template>
          </el-table-column>

          <!-- 新签业绩：未调整只显示本值；已调整显示「原值 → 调整后业绩」（同实收明细） -->
          <el-table-column label="新签业绩" align="right" width="200">
            <template #default="{ row }">
              <template v-if="isExpectAdjusted(row)">
                <span class="amount-strike">{{ formatMoney(row.expectOriginalAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount-red">{{ formatMoney(row.expectAmount) }}</span>
              </template>
              <span v-else :class="{ 'amount-gray': num(row.expectAmount) === 0 }">{{ formatMoney(row.expectAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="190">
            <template #default="{ row }">
              <template v-if="isExpectAdjusted(row)">
                <span class="amount-strike">{{ formatMoney(row.originalExpectConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount-ink">{{ formatMoney(row.expectConvertedAmount) }}</span>
              </template>
              <span v-else class="amount-ink">{{ formatMoney(row.expectConvertedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="130">
            <template #default="{ row }">
              <span class="amount-red">{{ formatMoney(row.realAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="120">
            <template #default="{ row }">
              <span class="amount-ink">{{ formatMoney(row.realConvertedAmount) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="调整单状态" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.adjustStatus" :type="adjustStatusTagType(row.adjustStatus)" size="small">
                {{ adjustStatusMap[row.adjustStatus] ?? row.adjustStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="实收审批" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.receivedStatus" :type="receivedStatusTagType(row.receivedStatus)" size="small">
                {{ receivedStatusMap[row.receivedStatus] ?? row.receivedStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收/应收" align="right" width="150">
            <template #default="{ row }">
              <div v-if="row.receivedRealAmount != null">
                <span class="amount-red">{{ formatMoney(row.receivedRealAmount) }}</span>
                <span class="amount-gray"> / {{ formatMoney(row.receivedExpectedAmount) }}</span>
              </div>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="结佣状态" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.commissionStatus" :type="commissionStatusTagType(row.commissionStatus)" size="small">
                {{ commissionStatusMap[row.commissionStatus] ?? row.commissionStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="结佣业绩" align="right" width="130">
            <template #default="{ row }">
              <span v-if="row.commissionAmount != null" class="amount-red">{{ formatMoney(row.commissionAmount) }}</span>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="120">
            <template #default="{ row }">
              <span v-if="row.commissionConvertedAmount != null" class="amount-ink">{{ formatMoney(row.commissionConvertedAmount) }}</span>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="人数" align="center" prop="employeeCount" width="70" />
          <el-table-column label="明细" align="center" prop="detailCount" width="70" />
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && tableData.length === 0" class="empty-wrap">
          <el-empty description="暂无业绩数据" />
        </div>

        <!-- 分页 -->
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="queryParams.pageNum"
            v-model:page-size="queryParams.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleQuery"
            @current-change="getList"
          />
        </div>
      </div>
    </el-card>

    <!-- 合同业绩详情弹窗（摘要 + 全部明细一次展示） -->
    <el-dialog
      v-model="detailDialog.visible"
      title="合同业绩详情"
      width="92%"
      top="3vh"
      class="search-detail-dialog"
      destroy-on-close
      append-to-body
    >
      <el-descriptions v-if="detailDialog.row" :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="合同号">{{ detailDialog.row.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detailDialog.row.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detailDialog.row.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="物业地址" :span="3">{{ detailDialog.row.propertyAddress || '—' }}</el-descriptions-item>
        <el-descriptions-item label="签约时间">{{ formatDate(detailDialog.row.signDate) }}</el-descriptions-item>
        <el-descriptions-item label="最近期间">{{ detailDialog.row.period }}</el-descriptions-item>
        <!-- 新签业绩：已调整时展示「原值 → 调整后业绩」，折算后同形式（同实收明细） -->
        <el-descriptions-item label="新签业绩">
          <template v-if="detailRowAdjusted">
            <span class="amount-strike">{{ formatMoney(detailDialog.row.expectOriginalAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount-red">{{ formatMoney(detailDialog.row.expectAmount) }}</span>
          </template>
          <span v-else class="amount-red">{{ formatMoney(detailDialog.row.expectAmount) }}</span>
          <span class="converted-inline">
            折算后
            <span v-if="detailRowAdjusted" class="amount-strike">{{ formatMoney(detailDialog.row.originalExpectConvertedAmount) }}</span>
            <span v-if="detailRowAdjusted" class="amount-arrow">→</span>
            <span class="amount-ink">{{ formatMoney(detailDialog.row.expectConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="实收业绩">
          <span class="amount-red">{{ formatMoney(detailDialog.row.realAmount) }}</span>
          <span class="amount-gray" style="margin-left: 8px">折算后 {{ formatMoney(detailDialog.row.realConvertedAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="调整单状态">
          <el-tag v-if="detailDialog.row.adjustStatus" :type="adjustStatusTagType(detailDialog.row.adjustStatus)" size="small">
            {{ adjustStatusMap[detailDialog.row.adjustStatus] ?? detailDialog.row.adjustStatus }}
          </el-tag>
          <span v-else class="amount-gray">—</span>
        </el-descriptions-item>
        <el-descriptions-item label="实收审批">
          <el-tag v-if="detailDialog.row.receivedStatus" :type="receivedStatusTagType(detailDialog.row.receivedStatus)" size="small">
            {{ receivedStatusMap[detailDialog.row.receivedStatus] ?? detailDialog.row.receivedStatus }}
          </el-tag>
          <span v-else class="amount-gray">—</span>
        </el-descriptions-item>
        <el-descriptions-item label="实收/应收">
          <template v-if="detailDialog.row.receivedRealAmount != null">
            <span class="amount-red">{{ formatMoney(detailDialog.row.receivedRealAmount) }}</span>
            <span class="amount-gray"> / {{ formatMoney(detailDialog.row.receivedExpectedAmount) }}</span>
          </template>
          <span v-else class="amount-gray">—</span>
        </el-descriptions-item>
        <el-descriptions-item label="结佣状态">
          <el-tag v-if="detailDialog.row.commissionStatus" :type="commissionStatusTagType(detailDialog.row.commissionStatus)" size="small">
            {{ commissionStatusMap[detailDialog.row.commissionStatus] ?? detailDialog.row.commissionStatus }}
          </el-tag>
          <span v-else class="amount-gray">—</span>
        </el-descriptions-item>
        <el-descriptions-item label="结佣业绩">
          <span v-if="detailDialog.row.commissionAmount != null" class="amount-red">{{ formatMoney(detailDialog.row.commissionAmount) }}</span>
          <span v-else class="amount-gray">—</span>
          <span v-if="detailDialog.row.commissionConvertedAmount != null" class="amount-gray" style="margin-left: 8px">折算后 {{ formatMoney(detailDialog.row.commissionConvertedAmount) }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 汇总条 -->
      <div class="detail-summary-bar">
        <span class="summary-text">
          涉及 <b>{{ detailSummary.employeeCount }}</b> 人 ·
          <b>{{ detailList.length }}</b> 条明细
        </span>
        <span class="summary-amount">
          <!-- 存在已调整明细时，合计按「原合计 → 调整后合计」展示，与明细列同形式 -->
          <template v-if="detailSummary.hasAdjustRow">
            新签业绩合计：
            <b class="summary-struck">{{ formatMoney(detailSummary.totalExpectOriginal) }}</b>
            <span class="summary-arrow">→</span>
            <b class="amount-red">{{ formatMoney(detailSummary.totalExpect) }}</b>
            <span class="summary-sep">|</span>
            折算后：
            <b class="summary-struck">{{ formatMoney(detailSummary.totalExpectOriginalConverted) }}</b>
            <span class="summary-arrow">→</span>
            <b class="amount-ink">{{ formatMoney(detailSummary.totalExpectConverted) }}</b>
          </template>
          <template v-else>
            新签业绩合计：<b class="amount-red">{{ formatMoney(detailSummary.totalExpect) }}</b>
            <span class="summary-sep">|</span>
            折算后：<b class="amount-ink">{{ formatMoney(detailSummary.totalExpectConverted) }}</b>
          </template>
          <span class="summary-sep">|</span>
          实收合计：<b class="amount-red">{{ formatMoney(detailSummary.totalReal) }}</b>
          <span class="amount-gray" style="margin-left: 4px">折算后 {{ formatMoney(detailSummary.totalRealConverted) }}</span>
        </span>
      </div>

      <!-- 明细列表 -->
      <el-table border :data="detailList" v-loading="detailLoading" max-height="480">
        <el-table-column label="期间" align="center" prop="period" width="80" />
        <el-table-column label="门店/组别" align="left" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptPath || '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" align="center" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" align="center" min-width="100">
          <template #default="{ row }">{{ row.employeeName || '—' }}</template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.roleType || row.roleName || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="{ row }">{{ formatRatio(row.shareRatio) }}</template>
        </el-table-column>
        <el-table-column label="签约/认购时间" align="center" width="160">
          <template #default="{ row }">{{ formatDate(row.businessDate) }}</template>
        </el-table-column>
        <!-- 新签业绩：已调整时在该行展示「原值 → 调整后业绩」，折算后同形式 -->
        <el-table-column label="新签业绩" align="right" width="200">
          <template #default="{ row }">
            <template v-if="isRowAdjusted(row)">
              <span class="amount-strike">{{ formatMoney(row.originalExpectAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount-red">{{ formatMoney(row.expectAmount) }}</span>
            </template>
            <span v-else class="amount-red">{{ formatMoney(row.expectAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="180">
          <template #default="{ row }">
            <template v-if="isRowAdjusted(row)">
              <span class="amount-strike">{{ formatMoney(row.originalExpectConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount-ink">{{ formatMoney(row.expectConvertedAmount) }}</span>
            </template>
            <span v-else class="amount-ink">{{ formatMoney(row.expectConvertedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实收业绩" align="right" width="130">
          <template #default="{ row }">
            <span :class="row.realAmount < 0 ? 'amount-red' : 'amount-ink'">{{ formatMoney(row.realAmount) }}</span>
            <el-tag v-if="row.realAmount < 0" type="danger" size="small" effect="plain" class="adjust-tag">红冲</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="120">
          <template #default="{ row }">
            <span :class="row.realAmount < 0 ? 'amount-red' : 'amount-ink'">{{ formatMoney(row.realConvertedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结算" align="center" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.settled" type="success" size="small">已结算</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未结算</el-tag>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无明细数据" />
        </template>
      </el-table>
      <template #footer>
        <el-button @click="detailDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceFactSearch, PerformanceSearchDetailRow } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { resolveBizNo } from '@/utils/panjiaBiz';

defineOptions({ name: 'PerformanceSearch' });

const tableMaxHeight = ref(580);

const calcTableHeight = () => {
  nextTick(() => {
    tableMaxHeight.value = window.innerHeight - 280;
  });
};

// ==================== 部门树 ====================
const deptTreeData = ref<DeptNode[]>([]);
const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[search] 部门树加载失败', e);
  }
};

// ==================== 筛选 & 分页 ====================
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: undefined as string | undefined,
  deptId: undefined as string | undefined,
  keyword: undefined as string | undefined,
});

const loading = ref(false);
const tableData = ref<PerformanceFactSearch[]>([]);
const total = ref(0);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.searchByContract({
      period: queryParams.period,
      deptId: queryParams.deptId,
      keyword: queryParams.keyword,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    tableData.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e) {
    console.error('[search] 查询失败', e);
    tableData.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.period = undefined;
  queryParams.deptId = undefined;
  queryParams.keyword = undefined;
  handleQuery();
};

// ==================== 格式化 ====================
const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatMoney = (val?: number | null): string => {
  if (val == null) return '—';
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * 是否按「原值 → 调整后值」展示：调整后金额与原值不等即为已调整。
 * 统一走 num() 做数值比较（后端字段可能为 number | string），
 * 与「新签明细」页 isAdjusted 同口径 —— 未调整的行不展示「调整后」值，避免与调整前重复。
 */
const isExpectAdjusted = (
  row: { expectAmount?: number | string | null; expectOriginalAmount?: number | string | null } | null | undefined,
): boolean => !!row && num(row.expectAmount) !== num(row.expectOriginalAmount);
/** 合同明细行：字段名不同（originalExpectAmount），判定口径与列表行一致 */
const isRowAdjusted = (
  row: { expectAmount?: number | string | null; originalExpectAmount?: number | string | null } | null | undefined,
): boolean => !!row && num(row.expectAmount) !== num(row.originalExpectAmount);

const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// ==================== 状态映射 ====================
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

const adjustStatusMap: Record<string, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  EXECUTED: '已执行',
};
const adjustStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'info',
    EXECUTED: 'success',
  };
  return map[status] ?? 'info';
};

const receivedStatusMap: Record<string, string> = {
  DRAFT: '待提交',
  SUBMITTED: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已作废',
};
const receivedStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    DRAFT: 'info',
    SUBMITTED: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'info',
  };
  return map[status] ?? 'info';
};

const commissionStatusMap: Record<string, string> = {
  DRAFT: '待提交',
  SUBMITTED: '审批中',
  APPROVED: '已通过',
  LOCKED: '已锁定',
  REJECTED: '已驳回',
  CANCELLED: '已作废',
};
const commissionStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    DRAFT: 'info',
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    LOCKED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'info',
  };
  return map[status] ?? 'info';
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

// ==================== 合同详情弹窗（摘要 + 明细一次展示） ====================
// 业务键口径：一手房、房产金融、家装荐客以订单号为准，其它以合同号为准（空则回退订单号）
const detailDialog = reactive({
  visible: false,
  row: undefined as PerformanceFactSearch | undefined,
});
const detailLoading = ref(false);
const detailList = ref<PerformanceSearchDetailRow[]>([]);

/** 明细弹窗头部「新签业绩」是否按「原值 → 调整后值」展示（与列表同口径） */
const detailRowAdjusted = computed(() => isExpectAdjusted(detailDialog.row));

const detailSummary = computed(() => {
  const list = detailList.value;
  return {
    employeeCount: new Set(list.map((r) => r.employeeId)).size,
    // 调整前（原值）合计：originalExpectAmount 由 SQL COALESCE 兜底，未调整时等于当前值
    totalExpectOriginal: list.reduce((s, r) => s + num(r.originalExpectAmount ?? r.expectAmount), 0),
    totalExpectOriginalConverted: list.reduce((s, r) => s + num(r.originalExpectConvertedAmount ?? r.expectConvertedAmount), 0),
    // 当前（调整后）合计
    totalExpect: list.reduce((s, r) => s + num(r.expectAmount), 0),
    totalExpectConverted: list.reduce((s, r) => s + num(r.expectConvertedAmount), 0),
    hasAdjustRow: list.some((r) => isRowAdjusted(r)),
    totalReal: list.reduce((s, r) => s + num(r.realAmount), 0),
    totalRealConverted: list.reduce((s, r) => s + num(r.realConvertedAmount), 0),
  };
});

const openDetail = async (row: PerformanceFactSearch) => {
  const bizNo = resolveBizNo(row.bizType, row.contractNo, row.orderNo);
  if (!bizNo) {
    ElMessage.warning('该合同无合同号/订单号，无法查看明细');
    return;
  }
  detailDialog.row = row;
  detailList.value = [];
  detailDialog.visible = true;
  detailLoading.value = true;
  try {
    const res = await performanceApi.getSearchDetails({ bizNo });
    detailList.value = res.data ?? [];
  } catch (e) {
    console.error('[search] 合同明细加载失败', e);
    detailList.value = [];
  } finally {
    detailLoading.value = false;
  }
};

// ==================== 初始化 ====================
onMounted(() => {
  calcTableHeight();
  window.addEventListener('resize', calcTableHeight);
  loadDeptTree();
  getList();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', calcTableHeight);
});
</script>

<style scoped>
.performance-search-page {
  padding: 0;
}

.page-card {
  border: none;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.empty-wrap {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.no-click {
  padding: 0;
  height: auto;
  font-weight: 500;
}

.amount-red {
  color: #f56c6c;
  font-weight: 500;
}

.amount-gray {
  color: #909399;
}

.amount-ink {
  color: #303133;
  font-weight: 500;
}

/* ============ 「原值 → 调整后值」展示（列表两列 / 详情摘要 / 明细表两列 / 汇总条共用） ============
   有调整时：被调整掉的原值置灰加删除线，箭头连接调整后值；未调整时只渲染一个值。
   口径与「合同业绩明细」页 / 实收明细页保持一致。 */
.amount-strike {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #c0c4cc;
  text-decoration: line-through;
}
.amount-arrow {
  margin: 0 4px;
  color: #c0c4cc;
}
/* 详情摘要「新签业绩」右侧的折算后内联段：灰字标签 + 值，与左侧同一格并排 */
.converted-inline {
  margin-left: 10px;
  font-size: 13px;
  color: #909399;
}
/* 汇总条上的「原合计 → 调整后合计」：原值删除线、箭头同明细列口径 */
.summary-struck {
  color: #c0c4cc;
  font-weight: 500;
  text-decoration: line-through;
  margin: 0 2px;
}
.summary-arrow {
  margin: 0 2px;
  color: #c0c4cc;
}

.adjust-tag {
  margin-left: 4px;
}

.detail-desc {
  margin-bottom: 12px;
}

.detail-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
}

.summary-sep {
  margin: 0 8px;
  color: #c0c4cc;
}
</style>
