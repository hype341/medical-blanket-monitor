import { describe, expect, it } from "vitest";
import { filterRoutesForRole } from "./organization";

const routes = [
  {
    path: "/overview",
    meta: { title: "安全总览" },
  },
  {
    path: "/admin/wards",
    meta: { title: "病区管理", roles: ["ADMIN"] },
  },
];

describe("role-aware navigation", () => {
  it("hides administrator routes from nurses", () => {
    expect(filterRoutesForRole(routes, "NURSE").map((route) => route.path)).toEqual(["/overview"]);
  });

  it("shows administrator routes to administrators", () => {
    expect(filterRoutesForRole(routes, "ADMIN").map((route) => route.path)).toEqual([
      "/overview",
      "/admin/wards",
    ]);
  });
});
