import { describe, expect, it } from "vitest";
import { matchDemoAccount } from "./demo-accounts";

describe("demo login accounts", () => {
  it("matches the developer account with the shared demo password", () => {
    expect(matchDemoAccount("developer", "123456")).toMatchObject({
      username: "developer",
      role: "DEVELOPER",
      wardIds: ["ward-a", "ward-b"],
    });
  });

  it("rejects an incorrect password", () => {
    expect(matchDemoAccount("developer", "wrong-password")).toBeNull();
  });
});
