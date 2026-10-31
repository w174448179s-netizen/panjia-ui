<template>
  <div class="dingtalk-sync-panel">
    <el-alert v-if="!embedded" type="info" :closable="false" show-icon :title="tip" />

    <div class="sync-body">
      <el-date-picker
        v-model="period"
        type="month"
        value-format="YYYY-MM"
        :placeholder="periodPlaceholder"
        :clearable="false"
        class="month-picker"
      />
      <el-button
        v-if="canSync"
        type="primary"
        :icon="type === 'SCORE' ? 'Star' : 'Calendar'"
        :loading="starting"
        @click="handleSync"
      >
        {{ type === 'SCORE' ? '同步积分' : '同步考勤' }}
      </el-button>
      <el-button icon="Refresh" :loading="loading" @click="getList">刷新记录</el-button>
    </div>

    <div class="records-head">
      <span>同步记录</span>
      <span v-if="hasRunning" class="tip">同步执行中，每 3 秒自动刷新…</span>
    </div>

    <el-table :data="logs" v-loading="loading" border stripe size="small">
      <el-table-column :label="periodLabel" prop="period" width="110" align="center" />
      <el-table-column label="触发方式" width="100" align="center">
        <template #default="{ row }">{{ row.triggerType === 'SCHEDULE' ? '定时' : '手动' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="totalLabel" prop="totalCount" width="110" align="center" />
      <el-table-column :label="successLabel" prop="successCount" width="120" align="center" />
      <el-table-column :label="skippedLabel" prop="skippedCount" width="100" align="center" />
      <el-table-column prop="failedCount" label="失败" width="80" align="center" />
      <el-table-column prop="startTime" label="开始时间" width="170" align="center" />
      <el-table-column prop="endTime" label="结束时间" width="170" align="center" />
      <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
    </el-table>

    <el-pagination
      v-show="total > 0"
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.pageNum"
      @current-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts" name="DingTalkSyncPanel">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { dingtalkApi } from '@/api/system/dingtalk';
import type { DingTalkSyncLog, DingTalkSyncType } from '@/api/system/dingtalk';
import { checkPermi } from '@/utils/permission';
import modal from '@/plugins/modal';

const props = withDefaults(
  defineProps<{
    type: DingTalkSyncType;
    defaultPeriod?: string;
    /** 内嵌在弹窗中使用：不渲染顶部说明卡片 */
    embedded?: boolean;
  }>(),
  { defaultPeriod: '', embedded: false }
);

const emit = defineEmits<{ (e: 'finished'): void }>();

const starting = ref(false);
const loading = ref(false);
const logs = ref<DingTalkSyncLog[]>([]);
const total = ref(0);
const query = reactive<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 20 });

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const period = ref(props.defaultPeriod || currentMonth());

watch(
  () => props.defaultPeriod,
  (value) => {
    if (value) period.value = value;
  }
);

const isScore = computed(() => props.type === 'SCORE');
const perm = computed(() => (isScore.value ? 'dingtalk:sync:score' : 'dingtalk:sync:attendance'));
const canSync = computed(() => checkPermi([perm.value]));
const periodPlaceholder = computed(() => (isScore.value ? '选择积分月份' : '选择考勤月份'));
const periodLabel = computed(() => (isScore.value ? '积分月份' : '考勤月份'));
const totalLabel = computed(() => (isScore.value ? '日志条数' : '钉钉人数'));
const successLabel = computed(() => (isScore.value ? '每日明细' : '汇总条数'));
const skippedLabel = computed(() => (isScore.value ? '未匹配' : '跳过'));
const tip = computed(() =>
  isScore.value
    ? '异步同步：从钉钉《二手/租赁积分日报》日志按天聚合为积分明细，按钉钉工号匹配员工，同人同月覆盖；提交窗口按参数管理 panjia.score.submit_window 配置（默认当日 19:00 至次日 9:00 计入积分，23:00 后记晚提交），9:00-18:59 提交不计分（计 0），月度汇总随后按明细重算。'
    : '异步同步：点击后立即开始后台任务，完成后在下方同步记录中查看结果。数据口径与钉钉智能考勤报表一致（月度汇总 + 每日考勤结果），按钉钉工号匹配系统员工，同人同月覆盖。'
);

const hasRunning = computed(() => logs.value.some((row) => row.status === 'RUNNING'));

const statusType = (status: string) => {
  if (status === 'SUCCESS') return 'success';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'info';
};
const statusText = (status: string) =>
  ({ RUNNING: '执行中', SUCCESS: '成功', PARTIAL: '部分成功', FAILED: '失败' } as Record<string, string>)[status] ??
  status;

const getList = async () => {
  loading.value = true;
  try {
    const res: any = await dingtalkApi.logs({ ...query, syncType: props.type });
    logs.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number) => {
  query.pageNum = page;
  getList();
};

/** 有 RUNNING 记录时轮询，任务结束后停止并通知父组件刷新业务列表 */
let timer: ReturnType<typeof setInterval> | undefined;
const startPolling = () => {
  stopPolling();
  timer = setInterval(async () => {
    await getList();
    if (!hasRunning.value) {
      stopPolling();
      emit('finished');
    }
  }, 3000);
};
const stopPolling = () => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
};

const handleSync = async () => {
  await modal.confirm(
    isScore.value
      ? `将从钉钉同步 ${period.value} 的积分流水（按天聚合为每日明细，同人同月覆盖），是否继续？`
      : `将从钉钉智能考勤报表同步 ${period.value} 的月度汇总与每日明细（同人同月覆盖），是否继续？`
  );
  starting.value = true;
  try {
    if (isScore.value) {
      await dingtalkApi.syncScore(period.value);
    } else {
      await dingtalkApi.syncAttendance(period.value);
    }
    query.pageNum = 1;
    await getList();
    startPolling();
  } finally {
    starting.value = false;
  }
};

onMounted(async () => {
  await getList();
  if (hasRunning.value) startPolling();
});
onUnmounted(stopPolling);
</script>

<style lang="scss" scoped>
.dingtalk-sync-panel {
  .sync-body {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }

  .month-picker {
    width: 160px;
  }

  .records-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .tip {
    color: var(--el-color-primary);
    font-size: 12px;
    font-weight: 400;
  }

  .pager {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
