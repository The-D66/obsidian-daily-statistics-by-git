<template>
  <!--  <el-button :bg="false" :plain=true size="small" :icon="Edit" @click="dialogVisible = true" />-->
  <el-icon id="edit-icon">
    <Edit @click="dialogVisible = true" />
  </el-icon>
  <el-dialog
    align-center
    v-model="dialogVisible"
    :title="$t('SetGoal')"
    :show-close=false
    width="300">

    <template #default>
      <el-input-number :controls="false" v-model="num" :min="7" :max="20000" />
    </template>


    <template #footer>

      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">
          {{ $t("Cancel") }}
        </el-button>
        <el-button @click="confirm">
          {{ $t("Confirm") }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, defineEmits, ref, watch } from "vue";

import { Edit } from "@element-plus/icons-vue";

// // 获取当前主题模式
// const isDark = useDark();
// useToggle(isDark);

const emit = defineEmits(["setValue"]);
const dialogVisible = ref(false);

const props = defineProps(["defaultData"]);
const defaultData = computed(() => props.defaultData || 0);
const num = ref(defaultData.value);

watch(defaultData, (newValue) => {
  num.value = newValue;
});

const confirm = () => {
  dialogVisible.value = false;
  emit("setValue", num.value);
};

</script>

<style>


.el-icon {
  margin-left: 6px;
}

/* 定义鼠标悬停时的样式 */
#edit-icon:hover {
  color: #1989fa;
}

input[type='number'] {
  background: unset;
  border: unset;

}

.el-input-number.is-without-controls .el-input__wrapper {
  padding: unset;
}

.el-input__wrapper.is-focus {
  box-shadow: unset;
}

.el-dialog__body {
  /*让子项居中*/
  display: flex;
  align-items: center;
  justify-content: center; /* 水平居中 */
}

/* 设置弹窗背景色为 Obsidian 侧栏颜色 */
.el-dialog {
  background-color: var(--background-secondary);
  color: var(--text-normal);
}

/* 设置弹窗头部和底部的背景色 */
.el-dialog__header,
.el-dialog__footer {
  background-color: var(--background-secondary);
  color: var(--text-normal);
}

/* 设置输入框背景色 */
.el-input-number .el-input__wrapper {
  background-color: var(--background-primary);
  color: var(--text-normal);
}

/* 基础按钮样式 */
.el-button {
  --el-button-hover-border-color: transparent;
  --el-button-hover-bg-color: transparent;
  --el-button-hover-text-color: var(--text-normal);
  --el-button-active-color: transparent;
  --el-button-active-bg-color: transparent;
  --el-button-active-border-color: transparent;
  box-shadow: none;
  border: none;
  background-color: transparent;
  color: var(--text-normal);
  padding: 8px 16px;
  transition: none;
  filter: none;
}

/* 移除按钮悬浮和点击效果 */
.el-button:hover,
.el-button:focus,
.el-button:active {
  background-color: transparent;
  border-color: transparent;
  transform: none;
  filter: none;
}

/* 使用 Obsidian 的背景色 */

</style>
