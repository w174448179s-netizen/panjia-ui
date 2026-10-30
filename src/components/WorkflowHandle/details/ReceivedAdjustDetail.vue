<template>
  <!--
    实收调整审批（我的待办 → 办理弹窗）详情体。
    模板本体与「实收调整 → 详情」共用 AdjustDetailPanel（kind=received，走 /perf/received-adjust），
    避免两处口径漂移。本文件仅作为工作流注册表的适配层（flowCode = perf_received_adjust，2026-10-12 拆表新增）。
  -->
  <AdjustDetailPanel kind="received" :business-id="businessId" />
</template>

<script setup lang="ts">
import AdjustDetailPanel from '@/views/performance/adjust/components/AdjustDetailPanel.vue';

defineProps<{ businessId: string | number }>();
</script>
