#!/usr/bin/env node

const assert = require("node:assert/strict");
const cases = require("./intent-router-eval-cases.cjs");
const { routeIntent } = require("../electron/services/intent-router.cjs");

function assertIncludes(actual, expected, message) {
  for (const item of expected || []) {
    assert.ok(actual.includes(item), `${message}: missing ${item}`);
  }
}

function assertCase(testCase) {
  const actual = routeIntent({
    prompt: testCase.prompt,
    attachments: testCase.attachments || [],
    channelId: testCase.channelId,
    channelContext: testCase.channelContext,
    threadContext: testCase.threadContext
  });
  const expected = testCase.expected;

  assert.equal(actual.intentNamespace, expected.namespace, `${testCase.name}: namespace`);
  assert.equal(actual.mode, expected.mode, `${testCase.name}: mode`);
  assert.equal(actual.modality, expected.modality, `${testCase.name}: modality`);
  if (expected.taskKind) {
    assert.equal(actual.taskKind, expected.taskKind, `${testCase.name}: taskKind`);
  }
  if (expected.isSystemIntent != null) {
    assert.equal(actual.isSystemIntent, expected.isSystemIntent, `${testCase.name}: isSystemIntent`);
  }
  if (expected.requiresExternalContext != null) {
    assert.equal(actual.requiresExternalContext, expected.requiresExternalContext, `${testCase.name}: requiresExternalContext`);
  }
  if (expected.modelCapability) {
    assert.equal(actual.capabilityIntent.modelCapability, expected.modelCapability, `${testCase.name}: modelCapability`);
  }
  if (expected.routeTarget) {
    assert.equal(actual.capabilityIntent.routeTarget, expected.routeTarget, `${testCase.name}: routeTarget`);
  }
  if (expected.runtime) {
    assert.equal(actual.capabilityIntent.runtime, expected.runtime, `${testCase.name}: runtime`);
  }
  if (expected.localFirst != null) {
    assert.equal(actual.capabilityIntent.localFirst, expected.localFirst, `${testCase.name}: localFirst`);
  }
  if (expected.modelRequired != null) {
    assert.equal(actual.capabilityIntent.modelRequired, expected.modelRequired, `${testCase.name}: modelRequired`);
  }
  if (expected.outputAction) {
    assert.equal(actual.capabilityIntent.outputAction, expected.outputAction, `${testCase.name}: outputAction`);
  }
  assertIncludes(actual.capabilityIntent.requiredToolCapabilities, expected.requiredToolCapabilities, `${testCase.name}: requiredToolCapabilities`);

  return {
    name: testCase.name,
    namespace: actual.intentNamespace,
    mode: actual.mode,
    modality: actual.modality,
    routeTarget: actual.capabilityIntent.routeTarget,
    runtime: actual.capabilityIntent.runtime
  };
}

const results = cases.map(assertCase);
console.log(JSON.stringify({ ok: true, total: results.length, routeVersion: routeIntent({ prompt: "hi" }).routeVersion, results }, null, 2));
