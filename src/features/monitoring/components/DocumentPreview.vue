<template>
  <article class="document-preview" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { markdownToDocumentHtml } from "@/utils/document-export";

const props = defineProps<{
  content: string;
}>();

const html = computed(() => markdownToDocumentHtml(props.content));
</script>

<style scoped lang="scss">
.document-preview {
  max-height: 620px;
  padding: 22px 24px;
  overflow: auto;
  color: #28443f;
  background: #fbfdfc;
  border: 1px solid #dfe9e5;

  :deep(h1) {
    margin: 0 0 18px;
    font-size: 24px;
    color: #123e39;
    letter-spacing: -0.03em;
  }

  :deep(h2) {
    padding-bottom: 7px;
    margin: 24px 0 10px;
    font-size: 16px;
    border-bottom: 1px solid #d5e2dd;
  }

  :deep(h3) {
    margin: 17px 0 7px;
    font-size: 13px;
  }

  :deep(p),
  :deep(ul) {
    margin: 7px 0;
    font-size: 11px;
    line-height: 1.75;
  }

  :deep(ul) {
    padding-left: 20px;
  }

  :deep(code) {
    padding: 1px 4px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    color: #245d51;
    overflow-wrap: anywhere;
    background: #eaf4ef;
  }

  :deep(pre) {
    padding: 14px;
    overflow: auto;
    color: #dceee8;
    background: #0b3530;

    code {
      padding: 0;
      color: inherit;
      background: transparent;
    }
  }

  :deep(.table-wrap) {
    margin: 10px 0 16px;
    overflow-x: auto;
    border: 1px solid #dbe6e2;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
  }

  :deep(th),
  :deep(td) {
    padding: 8px 9px;
    font-size: 9px;
    vertical-align: top;
    text-align: left;
    overflow-wrap: anywhere;
    border: 1px solid #e2ebe8;
  }

  :deep(th) {
    color: #285d53;
    background: #edf6f2;
  }
}
</style>
