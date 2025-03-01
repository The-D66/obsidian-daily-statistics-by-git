<script setup lang="ts">
import store from "@/data/Store";
import { computed, ref, watch } from "vue";


import { ElConfigProvider } from "element-plus";
import Progress from "@/ui/calendar/Progress.vue";
import Calendar from "@/ui/calendar/Calendar.vue";
import { useDark, useToggle } from "@vueuse/core";
import { onBeforeUnmount } from "vue";


// 深色模式适配
// 获取当前主题模式
const isDark = useDark();
isDark.value = document.body.classList.contains("theme-dark");
useToggle(isDark);

// 创建一个MutationObserver实例
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      isDark.value = document.body.classList.contains("theme-dark");
      // console.log("Is dark theme active?", isDark);
    }
  });
});
// 配置观察选项
const config = { attributes: true, attributeFilter: ["class"] };
// 观察body元素
observer.observe(document.body, config);
onBeforeUnmount(() => {
  // // console.log('组件即将销毁');
  observer.disconnect();
  // 执行一些清理工作，比如取消网络请求、移除事件监听器等
});


// 是否开启计划
const enablePlan = computed(() => {
  return store.getters.enablePlan;
});



// 添加一个用于强制重新渲染的 key
const componentKey = ref(0);

// 添加一个刷新方法
const refreshView = () => {
  componentKey.value += 1;
};

// 监听一周开始时间的变化，更新日历视图
watch(() => store.getters.weekStart, () => {
  // 重新加载组件
  refreshView();

});




</script>

<template>

  <el-config-provider :key="componentKey">

    <Calendar />
    <Progress v-if="enablePlan" />

  </el-config-provider>
</template>


<style scoped></style>
