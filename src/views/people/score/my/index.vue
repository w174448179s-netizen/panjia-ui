<template>
  <div class="p-2 app-container my-score-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <!-- 非管理角色隐藏部门/员工/姓名筛选（后端强制本人/本店口径） -->
        <el-form-item v-if="isManager" label="门店/组别" prop="deptId">
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            placeholder="本门店"
            clearable
            width="200px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item v-if="isManager" label="姓名" prop="employeeName">
          <el-input
            v-model.trim="queryParams.employeeName"
            placeholder="姓名搜索"
            clearable
            style="width: 130px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item v-if="isManager" label="工号" prop="employeeCode">
          <el-input
            v-model.trim="queryParams.employeeCode"
            placeholder="工号搜索"
            clearable
            style="width: 120px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item label="积分期间">
          <el-date-picker
            v-model="dateRange"
            type="monthrange"
            range-separator="—"
            value-format="YYYY-MM"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            clearable
            style="width: 260px"
            @change="handleDateRangeChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 积分明细列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Performance Score</span>
            <h3>积分查询</h3>
            <p>共 {{ total }} 条记录；总积分/出勤天数来自日报导入，平均积分 = 总积分 / 出勤天数。</p>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="scoreList" :max-height="tableMaxHeight" @expand-change="handleExpandChange">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="detail-expand">
              <el-table
                :data="scoreDetailMap[row.scoreMonth?.slice(0, 7)] || []"
                size="small"
                border
                v-loading="detailLoadingMap[row.scoreMonth?.slice(0, 7)]"
                max-height="300"
              >
                <el-table-column label="填报日期" align="center" prop="pointDate" width="120" />
                <el-table-column v-if="isManager" label="工号" align="center" prop="employeeCode" width="100" />
                <el-table-column v-if="isManager" label="姓名" align="center" prop="employeeName" width="90" />
                <el-table-column label="当日积分" align="center" prop="score" width="100" />
                <el-table-column label="填报时间" align="center" prop="submitTime" width="180">
                  <template #default="{ row: r }">{{ r.submitTime ?? '—' }}</template>
                </el-table-column>
                <el-table-column label="是否计入" align="center" width="100">
                  <template #default="{ row: r }">
                    <el-tag v-if="r.isValid" type="success" effect="plain" size="small">计入</el-tag>
                    <el-tag v-else type="info" effect="plain" size="small">不计入</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="晚提交" align="center" width="90">
                  <template #default="{ row: r }">
                    <el-tag v-if="r.isLateSubmit" type="danger" effect="plain" size="small">晚提交</el-tag>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <template #empty>
                  <span>该月无每日积分明细</span>
                </template>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="积分期间" align="center" prop="scoreMonth" width="110">
          <template #default="{ row }">{{ row.scoreMonth?.slice(0, 7) ?? '—' }}</template>
        </el-table-column>
        <el-table-column v-if="isManager" label="工号" align="center" prop="employeeCode" width="100" />
        <el-table-column v-if="isManager" label="姓名" align="center" prop="employeeName" width="90" />
        <el-table-column v-if="isManager" label="门店/组别" align="center" prop="deptName" min-width="150" show-overflow-tooltip />
        <el-table-column label="总积分" align="center" prop="totalPoints" width="100">
          <template #default="{ row }">
            <span class="amount-bold">{{ row.totalPoints ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="出勤(天)" align="center" prop="attendDays" width="90" />
        <el-table-column label="平均积分" align="center" prop="avgPoints" width="100">
          <template #default="{ row }">{{ row.avgPoints ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="绩效等级" align="center" prop="grade" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.grade" :type="gradeTagType(row.grade)" effect="plain" size="small">{{ row.grade }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="提成扣点" align="center" prop="deductRate" width="100">
          <template #default="{ row }">
            <span v-if="row.deductRate != null" :class="{ 'deduct-text': Number(row.deductRate) < 0 }">
              {{ (Number(row.deductRate) * 100).toFixed(0) }}%
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="晚提交次数" align="center" prop="lateSubmitCount" width="100">
          <template #default="{ row }">{{ row.lateSubmitCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="积分扣款(元)" align="center" prop="pointsFee" width="120">
          <template #default="{ row }">
            <span :class="{ 'deduct-text': row.pointsFee && Number(row.pointsFee) > 0 }">
              {{ row.pointsFee ? Number(row.pointsFee).toFixed(2) : '0.00' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.locked" type="success" effect="plain" size="small">已锁定</el-tag>
            <el-tag v-else type="info" effect="plain" size="small">未提交</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        class="pagination-wrap"
        @pagination="getList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance } from 'element-plus';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreDetail, ScoreQuery, ScoreRecord } from '@/api/panjia/types';
import { useUserStore } from '@/store/modules/user';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';

const userStore = useUserStore();
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const scoreList = ref<ScoreRecord[]>([]);
const total = ref(0);
const tableMaxHeight = ref(600);

/** 每日明细缓存：scoreMonth(yyyy-MM) → details 列表 */
const scoreDetailMap = ref<Record<string, ScoreDetail[]>>({});
/** 每日明细加载中标记 */
const detailLoadingMap = ref<Record<string, boolean>>({});

/** 展开行时加载每日明细 */
const handleExpandChange = async (row: ScoreRecord, expanded: any) => {
  const month = row.scoreMonth?.slice(0, 7);
  if (!month) return;
  const isExpanded = Array.isArray(expanded)
    ? expanded.some((r: ScoreRecord) => r.scoreMonth?.slice(0, 7) === month)
    : Boolean(expanded);
  if (!isExpanded || scoreDetailMap.value[month]) return;
  detailLoadingMap.value[month] = true;
  try {
    const res = await scoreApi.myDetails(month);
    scoreDetailMap.value[month] = res.data ?? [];
  } catch (e) {
    console.error('加载积分每日明细失败', e);
    scoreDetailMap.value[month] = [];
  } finally {
    detailLoadingMap.value[month] = false;
  }
};

/** 管理角色判断：店长/总监/超管可见部门/员工筛选列 */
const isManager = computed(() => {
  const roles = userStore.roles ?? [];
  return roles.some((r: string) => ['superadmin', 'director', 'manager'].includes(r));
});

const dateRange = ref<[string, string] | null>(null);

const queryParams = reactive<ScoreQuery>({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: undefined,
  monthStart: undefined,
  monthEnd: undefined
});

const handleDateRangeChange = (val: [string, string] | null) => {
  if (val && val.length === 2) {
    queryParams.monthStart = `${val[0]}-01`;
    queryParams.monthEnd = `${val[1]}-01`;
  } else {
    queryParams.monthStart = undefined;
    queryParams.monthEnd = undefined;
  }
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await scoreApi.myList({ ...queryParams });
    scoreList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    console.error('积分查询失败', e);
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  dateRange.value = null;
  queryParams.employeeCode = '';
  queryParams.employeeName = '';
  queryParams.deptId = undefined;
  queryParams.monthStart = undefined;
  queryParams.monthEnd = undefined;
  queryParams.pageNum = 1;
  getList();
};

const gradeTagType = (grade: string): 'success' | 'warning' | 'danger' => {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'warning';
  return 'danger';
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.my-score-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .toolbar-shell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .table-heading {
    h3 {
      margin: 2px 0 4px;
      font-size: 16px;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .panel-kicker {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--el-color-primary);
  }

  .amount-bold {
    font-weight: 600;
    font-size: 15px;
  }

  .deduct-text {
    color: var(--el-color-danger);
  }

  .detail-expand {
    padding: 8px 12px 4px 48px;
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
