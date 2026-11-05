import type { Router } from "vue-router";

const loadBedDetail = () => import("./views/BedDetailView.vue");

/**
 * Load the detail chunk before navigating so the first click never shows an
 * empty route while the page module is still being fetched.
 */
export async function navigateToBedDetail(router: Router, bedId: string): Promise<void> {
  await loadBedDetail();
  await router.push(`/beds/${encodeURIComponent(bedId)}`);
}
