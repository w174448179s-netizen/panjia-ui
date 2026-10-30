<template>
  <el-tree-select
    :model-value="modelValue"
    :data="treeData"
    :props="{ label: 'deptName', children: 'children' }"
    node-key="deptId"
    value-key="deptId"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :check-strictly="checkStrictly"
    :filterable="filterable"
    :render-after-expand="false"
    :size="size"
    :style="{ width }"
    @update:model-value="handleUpdate"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDeptScope } from '@/hooks/useDeptScope';

/**
 * 门店/组别公共选择器（全系统统一）。
 * <p>
 * 数据源为员工域部门树（门店 → 组别），默认按登录用户部门数据权限裁剪；
 * 财务台账等需要全量门店的场景传 :scope="false"。
 * check-strictly：门店与组别均可直接选中，不做父子联动。
 */
const props = withDefaults(
  defineProps<{
    /** 选中部门 ID */
    modelValue?: string | number | null;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    /** 门店/组别均可直接选中，默认 true */
    checkStrictly?: boolean;
    filterable?: boolean;
    size?: 'large' | 'default' | 'small';
    /** 控件宽度 */
    width?: string;
    /** true=按登录用户部门数据权限裁剪（默认）；false=全量部门树（财务台账用） */
    scope?: boolean;
  }>(),
  {
    modelValue: null,
    placeholder: '全部门店/组别',
    clearable: true,
    disabled: false,
    checkStrictly: true,
    filterable: true,
    size: 'default',
    width: '100%',
    scope: true,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | undefined): void;
  (e: 'change', value: string | number | undefined): void;
}>();

const { deptTreeRaw, deptTreeData, loadDeptTree } = useDeptScope();

const treeData = computed(() => (props.scope ? deptTreeData.value : deptTreeRaw.value));

onMounted(() => {
  loadDeptTree();
});

const handleUpdate = (value: string | number | undefined) => {
  emit('update:modelValue', value);
};

const handleChange = (value: string | number | undefined) => {
  emit('change', value);
};
</script>
