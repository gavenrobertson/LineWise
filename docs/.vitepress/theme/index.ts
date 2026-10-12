// SPDX-License-Identifier: Apache-2.0
// The default VitePress theme in LineWise colors (spec section 15, BRD-05), plus the download page.
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import LandingPage from './LandingPage.vue';
import './brand.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LandingPage', LandingPage);
  },
} satisfies Theme;
