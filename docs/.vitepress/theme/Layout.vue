<!-- SPDX-License-Identifier: Apache-2.0 -->
<!--
  The default VitePress layout, with a nicer theme switch: the new theme spreads from the switch in
  a circle (a View Transition, so nothing on the page repaints per frame). Without View Transitions,
  or under reduced motion, it switches at once.
-->
<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import { nextTick, provide } from 'vue';

const { isDark } = useData();

const animated = () =>
  'startViewTransition' in document && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
  if (!animated()) {
    isDark.value = !isDark.value;
    return;
  }
  // Keyboard activation has no pointer position: grow from the switch itself.
  if (!x && !y) {
    const r = document.querySelector('.VPSwitchAppearance')?.getBoundingClientRect();
    if (r) [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
  }
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
  await (
    document as Document & { startViewTransition: (cb: () => Promise<void>) => { ready: Promise<void> } }
  ).startViewTransition(async () => {
    isDark.value = !isDark.value;
    await nextTick();
  }).ready;
  document.documentElement.animate(
    { clipPath: isDark.value ? clipPath.reverse() : clipPath },
    {
      duration: 420,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      // Hold the last frame until the transition ends; without it the old snapshot springs back to
      // full size for one frame, and switching to dark flashes the light page.
      fill: 'forwards',
      pseudoElement: `::view-transition-${isDark.value ? 'old' : 'new'}(root)`,
    },
  );
});
</script>

<template>
  <DefaultTheme.Layout />
</template>
