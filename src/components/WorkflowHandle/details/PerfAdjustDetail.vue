<template>
  <!--
    业绩调整审批（我的待办 → 办理弹窗）详情体。
    模板本体与「业绩调整 → 详情」共用 AdjustDetailPanel，避免两处口径漂移。
    本文件仅作为工作流注册表的适配层（flowCode = perf_adjust）。
  -->
  <AdjustDetailPanel :business-id="businessId" />
</template>

<script setup lang="ts">
import AdjustDetailPanel from '@/views/performance/adjust/components/AdjustDetailPanel.vue';

defineProps<{ businessId: string | number }>();
</script>
