<template>
  <div class="p-2 app-container people-attendance-my-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="考勤月份">
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 本人考勤汇总列表（只读） -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">My Attendance</span>
            <h3>考勤查询</h3>
            <p>仅展示本人的月度考勤汇总，如有疑问请联系人事。</p>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="attendanceList">
        <el-table-column label="考勤月份" align="center" prop="attendMonth" width="120" />
        <el-table-column label="出勤(天)" align="center" prop="attendDays" width="90" />
        <el-table-column label="休息(天)" align="center" prop="restDays" width="90" />
        <el-table-column label="迟到次数" align="center" prop="lateCount" width="90" />
        <el-table-column label="迟到(分)" align="center" prop="lateMinutes" width="90" />
        <el-table-column label="缺卡次数" align="center" prop="missingCardCount" width="90" />
        <el-table-column label="旷工(天)" align="center" prop="absentDays" width="90" />
        <el-table-column label="请假(天)" align="center" prop="leaveDays" width="90" />
        <el-table-column label="备注" align="center" prop="remark" min-width="140" show-overflow-tooltip />
        <template #empty>
          <el-empty description="暂无本人考勤记录" />
        </template>
      </el-table>

      <el-pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        class="pagination-wrap"
        layout="total, sizes, prev, pager, next, jumper"
        @pagination="getList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceQuery, AttendanceRecord } from '@/api/panjia/types';
import modal from '@/plugins/modal';

const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);
const monthRange = ref<[string, string] | []>([]);

const queryParams = reactive<AttendanceQuery>({
  pageNum: 1,
  pageSize: 10,
  monthStart: undefined,
  monthEnd: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    const [monthStart, monthEnd] = monthRange.value || [];
    // 仅传月份条件；员工身份由后端按登录用户强制限定
    const res = await attendanceApi.myList({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      monthStart: monthStart || undefined,
      monthEnd: monthEnd || undefined
    });
    attendanceList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询本人考勤失败');
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  monthRange.value = [];
  queryParams.pageNum = 1;
  getList();
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.people-attendance-my-page {
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

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
