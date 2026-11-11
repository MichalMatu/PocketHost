import test from "node:test";
import assert from "node:assert/strict";
import { planChangedChecks } from "../../scripts/dev/changed-checks-policy.mjs";
import { prepareChangedVerification, runChangedVerification } from "../../scripts/dev/verify-changed-policy.mjs";

const deps = {
  "apps/admin/tests/screen.interaction.test.tsx": [
    "apps/admin/tests/screen.interaction.test.tsx",
    "apps/admin/src/app/screen/page.tsx",
  ],
};

function makePlan(changed, review = null) {
  const plan = planChangedChecks(changed, deps);
  return { ...plan, head: "a".repeat(40), review: review ?? plan.review };
}

test("typecheck runs before UI interaction tests, formatting runs last", () => {
  const check = prepareChangedVerification(makePlan(["apps/admin/src/app/screen/page.tsx"]));
  assert.deepEqual(check.review, []);
  assert.deepEqual(check.checks.map(x => x.label), [
    "admin incremental typecheck", "ui tests", "changed-file format",
  ]);
});

test("new JavaScript scripts are syntax-checked before other gates", () => {
  const check = prepareChangedVerification(makePlan([
    "scripts/dev/verify-changed.mjs",
  ]));
  assert.equal(check.checks[0].label, "syntax: scripts/dev/verify-changed.mjs");
  assert.ok(check.checks.some(x => x.argv.includes("tests/quality/dev-verify-changed.test.mjs")));
});

test("a changed interaction test runs itself but does not trigger a full UI suite", () => {
  const check = prepareChangedVerification(makePlan([
    "apps/admin/tests/screen.interaction.test.tsx",
  ]));
  assert.deepEqual(check.checks.map(x => x.label), ["ui tests", "changed-file format"]);
  assert.deepEqual(check.checks[0].argv.slice(-1), ["tests/screen.interaction.test.tsx"]);
});

test("unknown package/config changes fail closed, before running commands", () => {
  const plan = makePlan(["apps/admin/src/app/screen/page.tsx", "package.json"]);
  const prepared = prepareChangedVerification(plan);
  assert.ok(prepared.review.some(x => x.includes("package.json")));
  assert.deepEqual(prepared.checks, []);
});

test("invalid or unrecognized check specifications cannot execute", () => {
  const plan = makePlan([]);
  plan.commands = [{ label: "deploy", cwd: ".", argv: ["node", "-e", "foo"] }];
  const prepared = prepareChangedVerification(plan);
  assert.ok(prepared.review.length);
  assert.deepEqual(prepared.checks, []);
});

test("execution stops at first failed gate and reports which gate failed", () => {
  let invoked = [];
  const steps = [
    { label: "admin incremental typecheck" },
    { label: "ui tests" },
    { label: "changed-file format" },
  ];
  const result = runChangedVerification(steps, step => {
    invoked.push(step.label);
    return { ok: step.label !== "admin incremental typecheck", code: 2, elapsedMs: 7, error: "TSX parse error" };
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.failedAt, "admin incremental typecheck");
  assert.deepEqual(invoked, ["admin incremental typecheck"]);
  assert.equal(result.checks[0].error, "TSX parse error");
});

test("successful focused checks produce one readable PASS receipt", () => {
  const plan = prepareChangedVerification(makePlan(["apps/admin/tests/screen.interaction.test.tsx"]));
  const result = runChangedVerification(plan.checks, () => ({ ok: true, code: 0, elapsedMs: 5 }));
  assert.equal(result.status, "PASS");
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every(x => x.status === "PASS"));
});

test("empty diff never introduces a full-suite fallback", () => {
  const prepared = prepareChangedVerification(makePlan([]));
  assert.deepEqual(prepared.checks, []);
  assert.deepEqual(prepared.review, []);
});
