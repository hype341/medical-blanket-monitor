import { beforeEach, describe, expect, it } from "vitest";
import {
  removeStaffCredential,
  saveStaffPassword,
  verifyStaffPassword,
} from "./staff-credentials";

describe("managed staff credentials", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("verifies a salted password without storing the plain text", () => {
    saveStaffPassword("staff-test", "Nurse@123456");

    expect(verifyStaffPassword("staff-test", "Nurse@123456")).toBe(true);
    expect(verifyStaffPassword("staff-test", "wrong-password")).toBe(false);
    expect(localStorage.getItem("monitoring-staff-credentials-v1")).not.toContain(
      "Nurse@123456",
    );
  });

  it("removes a credential when the account is deleted", () => {
    saveStaffPassword("staff-test", "Nurse@123456");
    removeStaffCredential("staff-test");
    expect(verifyStaffPassword("staff-test", "Nurse@123456")).toBe(false);
  });
});
