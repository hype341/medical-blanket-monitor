<template>
  <div class="layout-logo">
    <transition enter-active-class="logo-fade-enter-active">
      <router-link :key="+collapse" class="wh-full flex-center" to="/">
        <img :src="logo" class="w20px h20px" />
        <span v-if="!collapse" class="layout-logo__title">
          {{ monitoringStore.platformName }}
        </span>
      </router-link>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import logo from "@/assets/images/logo.png";
import { useMonitoringStore } from "@/features/monitoring/store";

defineProps({
  collapse: {
    type: Boolean,
    required: true,
  },
});

const monitoringStore = useMonitoringStore();
</script>

<style lang="scss" scoped>
.layout-logo {
  width: 100%;
  height: $navbar-height;
  background-color: $sidebar-logo-background;

  &__title {
    flex-shrink: 0;
    margin-left: 10px;
    font-size: 14px;
    font-weight: bold;
    color: $sidebar-logo-text-color;
  }
}

.logo-fade-enter-active {
  animation: logo-fade-in-left 1s both;
}

@keyframes logo-fade-in-left {
  from {
    opacity: 0;
    transform: translate3d(-100%, 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>

<style lang="scss">
.layout-root.layout--top,
.layout-root.layout--mix {
  .layout-logo {
    background-color: transparent !important;

    &__title {
      color: var(--menu-text);
    }
  }
}

.layout-root.is-sidebar-open {
  &.layout--top .layout-header__left .layout-logo,
  &.layout--mix .layout-header__logo .layout-logo {
    width: $sidebar-width;
  }
}

.layout-root.is-sidebar-collapsed {
  &.layout--top .layout-header__left .layout-logo,
  &.layout--mix .layout-header__logo .layout-logo {
    width: $sidebar-width-collapsed;
  }

  .layout-logo__title {
    display: none;
  }
}
</style>
