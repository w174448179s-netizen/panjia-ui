<template>
  <div class="panjia-copyright">
    {{ copyright }}
  </div>
</template>

<script setup lang="ts">
import settings from '@/settings';
const copyright = settings.title + ' 版权所有';
</script>

<style lang="scss" scoped>
.panjia-copyright {
  color: var(--app-text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
