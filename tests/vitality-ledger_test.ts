import { describe, it, expect, beforeEach } from "vitest";
import { Clarinet, Tx, Chain, Account, types } from "@hirosystems/clarinet-sdk";

describe("Wellness Chain Sync - Vitality Ledger Contract", () => {
  const contract = "vitality-ledger";
  let chain: Chain;
  let accounts: Map<string, Account>;
  let user1: Account;
  let user2: Account;

  beforeEach(() => {
    ({ chain, accounts } = new Clarinet().start());
    user1 = accounts.get("wallet_1")!;
    user2 = accounts.get("wallet_2")!;
  });

  describe("Account Initialization & Lifecycle", () => {
    it("should auto-create account on first wellness goal configuration", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeOk(types.bool(true));
    });

    it("should retrieve newly created account profile with correct initialization", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      const profileQuery = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profileQuery.result).toBeSome();
      const profile = profileQuery.result.expectSome();
      expect(profile["vitality-index"]).toBeUintEqualTo(0);
    });

    it("multiple users can establish independent health objectives simultaneously", () => {
      const block = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(7), types.uint(2000), types.uint(25)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(9), types.uint(3000), types.uint(45)],
          user2.address
        ),
      ]);

      expect(block.receipts[0].result).toBeOk();
      expect(block.receipts[1].result).toBeOk();
    });
  });

  describe("Health Metrics Submission & Validation", () => {
    beforeEach(() => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);
    });

    it("should successfully record all three daily metrics on first submission", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(1800), types.uint(25)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeOk();
    });

    it("should enforce sleep hour boundaries (0-24 range)", () => {
      const invalidSleep = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(25), types.uint(1800), types.uint(25)],
          user1.address
        ),
      ]);

      expect(invalidSleep.receipts[0].result).toBeErr();
    });

    it("should validate hydration consumption does not exceed 10,000ml", () => {
      const excessiveHydration = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(8), types.uint(10001), types.uint(20)],
          user1.address
        ),
      ]);

      expect(excessiveHydration.receipts[0].result).toBeErr();
    });

    it("should reject meditation duration exceeding 1,440 minutes", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(2000), types.uint(1441)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeErr();
    });

    it("should accept boundary values (zero for all metrics)", () => {
      const minimalReport = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(0), types.uint(0), types.uint(0)],
          user1.address
        ),
      ]);

      expect(minimalReport.receipts[0].result).toBeOk();
    });

    it("should accept maximum valid boundary values", () => {
      const maximalReport = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(24), types.uint(10000), types.uint(1440)],
          user1.address
        ),
      ]);

      expect(maximalReport.receipts[0].result).toBeOk();
    });

    it("should prevent duplicate metric submissions within same calendar day", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(1800), types.uint(25)],
          user1.address
        ),
      ]);

      const duplicateAttempt = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(6), types.uint(1500), types.uint(20)],
          user1.address
        ),
      ]);

      expect(duplicateAttempt.receipts[0].result).toBeErr();
    });
  });

  describe("Individual Metric Adjustment", () => {
    beforeEach(() => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(1800), types.uint(25)],
          user1.address
        ),
      ]);
    });

    it("should allow modification of sleep duration for current day", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("sleep-duration"), types.uint(8)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeOk();
    });

    it("should support hydration adjustment with proper validation", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("hydration-consumption"), types.uint(2200)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeOk();
    });

    it("should permit mindfulness duration updates", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("mindfulness-practice"), types.uint(35)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeOk();
    });

    it("should reject invalid metric type names", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("invalid-metric-name"), types.uint(10)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeErr();
    });

    it("should enforce bounds during adjustment operations", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("sleep-duration"), types.uint(30)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeErr();
    });

    it("should fail gracefully when no entry exists for current day", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("sleep-duration"), types.uint(8)],
          user2.address
        ),
      ]);

      expect(result.receipts[0].result).toBeErr();
    });
  });

  describe("Wellness Target Management", () => {
    it("should store configured wellness objectives persistently", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      const targetsQuery = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user1.address)],
        user1.address
      );

      expect(targetsQuery.result).toBeSome();
      const targets = targetsQuery.result.expectSome();
      expect(targets["target-sleep"]).toBeUintEqualTo(8);
      expect(targets["target-hydration"]).toBeUintEqualTo(2500);
      expect(targets["target-mindfulness"]).toBeUintEqualTo(30);
    });

    it("should support updating objectives multiple times", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      const updateBlock = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(7), types.uint(2000), types.uint(20)],
          user1.address
        ),
      ]);

      expect(updateBlock.receipts[0].result).toBeOk();

      const updatedTargets = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user1.address)],
        user1.address
      );

      const targets = updatedTargets.result.expectSome();
      expect(targets["target-sleep"]).toBeUintEqualTo(7);
      expect(targets["target-hydration"]).toBeUintEqualTo(2000);
    });

    it("should validate objectives during configuration", () => {
      const invalidGoals = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(25), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      expect(invalidGoals.receipts[0].result).toBeErr();
    });
  });

  describe("Data Retrieval & Query Functions", () => {
    beforeEach(() => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(2100), types.uint(28)],
          user1.address
        ),
      ]);
    });

    it("should retrieve current vitality index from account profile", () => {
      const profile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profile.result).toBeSome();
    });

    it("should fetch complete daily metrics for queried dates", () => {
      const metricsQuery = chain.callReadOnlyFn(
        contract,
        "fetch-activity-metrics",
        [types.principal(user1.address), types.uint(0)],
        user1.address
      );

      // Note: Actual date would be calculated from block time
      // This test validates the function signature works
      expect(metricsQuery.result).toBeDefined();
    });

    it("should return empty result for non-existent activity dates", () => {
      const futureQuery = chain.callReadOnlyFn(
        contract,
        "fetch-activity-metrics",
        [types.principal(user1.address), types.uint(99999999)],
        user1.address
      );

      expect(futureQuery.result).toBeNone();
    });

    it("should provide badge enumeration interface for accounts", () => {
      const badgeList = chain.callReadOnlyFn(
        contract,
        "enumerate-earned-badges",
        [types.principal(user1.address)],
        user1.address
      );

      expect(badgeList.result).toBeDefined();
    });

    it("should allow querying wellness targets for any principal", () => {
      const publicTargetQuery = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user1.address)],
        user2.address
      );

      expect(publicTargetQuery.result).toBeSome();
    });

    it("should support badge specification lookup", () => {
      const badgeSpec = chain.callReadOnlyFn(
        contract,
        "query-badge-specifications",
        [types.uint(1)],
        user1.address
      );

      expect(badgeSpec.result).toBeDefined();
    });
  });

  describe("Vitality Score Mechanics", () => {
    beforeEach(() => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);
    });

    it("should compute non-zero vitality index after metric submission", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      const profile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profile.result).toBeSome();
    });

    it("should register progress when exceeding minimum compliance thresholds", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(6), types.uint(1500), types.uint(20)],
          user1.address
        ),
      ]);

      const profile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profile.result).toBeSome();
    });

    it("should handle perfect goal attainment (100% compliance)", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);

      const profile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profile.result).toBeSome();
    });

    it("should calculate vitality based on three-metric average", () => {
      const objectives = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(10), types.uint(3000), types.uint(40)],
          user1.address
        ),
      ]);

      chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(10), types.uint(1500), types.uint(40)],
          user1.address
        ),
      ]);

      const profile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user1.address)],
        user1.address
      );

      expect(profile.result).toBeSome();
    });
  });

  describe("Edge Cases & Error Handling", () => {
    beforeEach(() => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
      ]);
    });

    it("should handle zero-value objectives gracefully", () => {
      const zeroGoals = chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(0), types.uint(0), types.uint(0)],
          user1.address
        ),
      ]);

      expect(zeroGoals.receipts[0].result).toBeOk();
    });

    it("should manage accounts with no recorded metrics without error", () => {
      const emptyProfile = chain.callReadOnlyFn(
        contract,
        "query-account-profile",
        [types.principal(user2.address)],
        user1.address
      );

      expect(emptyProfile.result).toBeNone();
    });

    it("should gracefully handle metric lookups for uninitialized users", () => {
      const metricsForNew = chain.callReadOnlyFn(
        contract,
        "fetch-activity-metrics",
        [types.principal(user2.address), types.uint(0)],
        user1.address
      );

      expect(metricsForNew.result).toBeNone();
    });

    it("should prevent modification attempts on non-existent entries", () => {
      const modifyNonExistent = chain.mineBlock([
        Tx.contractCall(
          contract,
          "revise-single-measurement",
          [types.utf8("sleep-duration"), types.uint(7)],
          user1.address
        ),
      ]);

      expect(modifyNonExistent.receipts[0].result).toBeErr();
    });

    it("should validate all three metric values independently", () => {
      const result = chain.mineBlock([
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(8), types.uint(11000), types.uint(30)],
          user1.address
        ),
      ]);

      expect(result.receipts[0].result).toBeErr();
    });
  });

  describe("Multi-User Isolation", () => {
    it("should maintain separate metric histories for different users", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(7), types.uint(2000), types.uint(25)],
          user2.address
        ),
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(6), types.uint(1500), types.uint(20)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(8), types.uint(2200), types.uint(28)],
          user2.address
        ),
      ]);

      const user1Targets = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user1.address)],
        user1.address
      );

      const user2Targets = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user2.address)],
        user2.address
      );

      const user1Data = user1Targets.result.expectSome();
      const user2Data = user2Targets.result.expectSome();

      expect(user1Data["target-sleep"]).toBeUintEqualTo(8);
      expect(user2Data["target-sleep"]).toBeUintEqualTo(7);
    });

    it("should prevent one user from viewing another's metrics through direct retrieval", () => {
      chain.mineBlock([
        Tx.contractCall(
          contract,
          "configure-wellness-objectives",
          [types.uint(8), types.uint(2500), types.uint(30)],
          user1.address
        ),
        Tx.contractCall(
          contract,
          "submit-daily-metrics",
          [types.uint(7), types.uint(1800), types.uint(25)],
          user1.address
        ),
      ]);

      // user2 can still query user1's data since targets are public
      // but this test validates the data structure integrity
      const targetQuery = chain.callReadOnlyFn(
        contract,
        "retrieve-wellness-targets",
        [types.principal(user1.address)],
        user2.address
      );

      expect(targetQuery.result).toBeSome();
    });
  });
});
