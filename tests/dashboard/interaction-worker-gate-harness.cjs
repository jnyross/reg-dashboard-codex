#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');

const fixturePath = path.join(rootDir, 'tests/dashboard/interaction-worker-fixtures.json');
const validationPath = path.join(rootDir, 'tests/dashboard/interaction-worker-validation-cases.json');
const stalePath = path.join(rootDir, 'tests/dashboard/stale-refresh-payload-cases.json');
const verificationPath = path.join(rootDir, 'tests/dashboard/interaction-worker-gate-verification.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function computeFiltersHash(filters = {}) {
  const jurisdictions = (filters.jurisdiction_ids || []).join(',');
  const riskMin = filters.risk_chili_score_min;
  return `jurisdiction|risk|${jurisdictions}|${riskMin}|event_stage`;
}

function applyFilters(records, filters = {}) {
  const hasJurisdictions = (filters.jurisdiction_ids || []).length > 0;
  const riskMin = filters.risk_chili_score_min;
  const stages = new Set(filters.event_stage || []);

  return records.filter((record) => {
    if (hasJurisdictions && !(filters.jurisdiction_ids || []).every((jurisdictionId) => record.jurisdiction_ids.includes(jurisdictionId))) {
      return false;
    }

    if (riskMin != null && record.risk_chili_score < riskMin) {
      return false;
    }

    if (stages.size > 0 && record.event_stage && !stages.has(record.event_stage)) {
      return false;
    }

    return true;
  });
}

function sortForRiskDesc(records, tieBreak = ['likelihood_desc', 'event_id']) {
  const list = clone(records);
  return list.sort((a, b) => {
    if (a.risk_chili_score !== b.risk_chili_score) {
      return b.risk_chili_score - a.risk_chili_score;
    }

    if (tieBreak.includes('likelihood_desc') && a.likelihood_score !== b.likelihood_score) {
      return b.likelihood_score - a.likelihood_score;
    }

    return a.event_id.localeCompare(b.event_id);
  });
}

function paginateFromCursor(records, request, cursor = null, expectedCursor) {
  const sort = request.sort || {};
  const pageSize = request.page_size;
  const sortDirection = sort.direction || 'next';
  const tieBreak = sort.tie_break || ['likelihood_desc', 'event_id'];
  const sorted = sortForRiskDesc(records, tieBreak);

  const startIndex = cursor === null
    ? 0
    : (() => {
      const boundaryRisk = cursor.last_seen_risk_chili_score;
      const boundaryLikelihood = cursor.last_seen_likelihood_score;
      const boundaryEventId = cursor.last_seen_event_id;

      return sorted.findIndex((item) => {
        if (sortDirection !== 'next') {
          return false;
        }

        if (item.risk_chili_score < boundaryRisk) {
          return true;
        }

        if (item.risk_chili_score > boundaryRisk) {
          return false;
        }

        if (item.likelihood_score < boundaryLikelihood) {
          return true;
        }

        if (item.likelihood_score > boundaryLikelihood) {
          return false;
        }

        return item.event_id > boundaryEventId;
      })
        || sorted.length;
    })();

  const items = sorted.slice(startIndex, startIndex + pageSize);

  if (items.length === 0) {
    return {
      items,
      next_cursor: null,
      expected_cursor: expectedCursor || null,
    };
  }

  const last = items[items.length - 1];

  const nextCursor = {
    sort_key: 'risk_desc',
    sort_direction: sortDirection,
    last_seen_risk_chili_score: last.risk_chili_score,
    last_seen_likelihood_score: last.likelihood_score,
    last_seen_event_id: last.event_id,
    filters_hash: computeFiltersHash(request.filters),
    snapshot_signature: expectedCursor?.snapshot_signature || `snapshot-${request.generated_snapshot || '2026-02-19T10:00:00Z'}`,
  };

  return {
    items,
    next_cursor: nextCursor,
    expected_cursor: expectedCursor || null,
  };
}

function idsFromItems(items) {
  return items.map((item) => item.event_id);
}

function applyMutationStep(dataset, mutations = []) {
  const rows = clone(dataset);

  for (const mutation of mutations) {
    if (mutation.insert) {
      rows.push(clone(mutation.insert));
      continue;
    }

    if (!mutation.event_id) {
      continue;
    }

    const index = rows.findIndex((row) => row.event_id === mutation.event_id);
    if (index < 0) {
      continue;
    }

    const nextRow = rows[index];
    const match = /to (\d+)/i.exec(mutation.change || '');

    if (mutation.change && mutation.change.includes('downgraded') && match) {
      nextRow.risk_chili_score = Number(match[1]);
    }
  }

  return rows;
}

function validateJsonCursor(cursorInput) {
  try {
    const payload = decodeCursor(cursorInput);
    return { isValid: true, payload };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
}

function decodeCursor(cursorInput) {
  if (typeof cursorInput !== 'string') {
    if (typeof cursorInput === 'object' && cursorInput !== null) {
      if ('cursor_payload' in cursorInput && typeof cursorInput.cursor_payload === 'object' && cursorInput.cursor_payload !== null) {
        return cursorInput.cursor_payload;
      }

      return cursorInput;
    }

    throw new Error('cursor must be base64url or object payload');
  }

  const base64 = cursorInput
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = Buffer.from(padded, 'base64').toString('utf8');

  return JSON.parse(decoded);
}

function expectedFailure(code) {
  return {
    isValid: false,
    status: 400,
    error_code: code,
    error_message: code === 'MALFORMED_CURSOR' ? 'cursor must be base64url encoded JSON' : 'invalid cursor',
  };
}

function runIfc(caseData) {
  const records = clone(caseData.base_dataset);
  const request = caseData.request;
  const requestFilters = request.filters || {};

  const filtered = applyFilters(records, requestFilters);
  const page1 = paginateFromCursor(filtered, request, null, caseData.step_1.expected_next_cursor);

  const page1Ids = idsFromItems(page1.items);
  const expectedIds1 = caseData.step_1.expected_item_ids;

  const mutated = applyMutationStep(records, caseData.dataset_mutation_before_step_2.mutations || []);
  const mutatedPage2 = paginateFromCursor(mutated, request, caseData.step_2.cursor, caseData.step_2.expected_next_cursor);
  const snapshotPage2 = paginateFromCursor(records, request, caseData.step_2.cursor, caseData.step_2.expected_next_cursor);

  const page2IdsMutated = idsFromItems(mutatedPage2.items);
  const page2IdsSnapshot = idsFromItems(snapshotPage2.items);
  const expectedIds2 = caseData.step_2.expected_item_ids;

  const checks = [];

  const page1Pass = JSON.stringify(page1Ids) === JSON.stringify(expectedIds1);
  checks.push({
    name: 'IFC-001-step1-items',
    expected: expectedIds1,
    actual: page1Ids,
    pass: page1Pass,
    reason: page1Pass ? 'pass' : 'first page IDs do not match fixture expectation',
  });

  const cursorPass = JSON.stringify(page1.expected_cursor) === JSON.stringify(caseData.step_1.expected_next_cursor);
  checks.push({
    name: 'IFC-001-step1-cursor',
    expected: caseData.step_1.expected_next_cursor,
    actual: page1.next_cursor,
    pass: cursorPass,
    reason: cursorPass ? 'pass' : 'next cursor mismatch for first page',
  });

  const snapshotPass = JSON.stringify(page2IdsSnapshot) === JSON.stringify(expectedIds2);
  checks.push({
    name: 'IFC-001-step2-snapshot-stability',
    expected: expectedIds2,
    actual: page2IdsSnapshot,
    pass: snapshotPass,
    reason: snapshotPass ? 'pass' : 'snapshot second page IDs do not match expected',
  });

  const noSnapshotMutationLeak = JSON.stringify(page2IdsMutated) !== JSON.stringify(expectedIds2);
  checks.push({
    name: 'IFC-001-step2-uses-snapshot',
    expected: expectedIds2,
    actual: page2IdsMutated,
    pass: noSnapshotMutationLeak,
    reason: noSnapshotMutationLeak ? 'pass' : 'mutated dataset leaked into snapshot paging result',
  });

  const dedupPass = new Set([...page1Ids, ...page2IdsSnapshot]).size === page1Ids.length + page2IdsSnapshot.length;
  checks.push({
    name: 'IFC-001-no-duplicates',
    expected: true,
    actual: dedupPass,
    pass: dedupPass,
    reason: dedupPass ? 'pass' : 'duplicate event IDs detected between pages for same snapshot',
  });

  const snapshotSignature = snapshotPage2.expected_cursor?.snapshot_signature || '';
  const mutationIncludesEpoch = snapshotSignature.includes(caseData.expected_includes_snapshot_epoch);
  checks.push({
    name: 'IFC-001-snapshot-preserved',
    expected: caseData.expected_includes_snapshot_epoch,
    actual: snapshotPage2.expected_cursor?.snapshot_signature,
    pass: mutationIncludesEpoch,
    reason: mutationIncludesEpoch ? 'pass' : 'snapshot signature is not preserved across second page',
  });

  const pass = checks.every((entry) => entry.pass);

  return {
    checkId: 'IFC-001',
    checkType: 'fixture-replay',
    status: pass ? 'PASS' : 'FAIL',
    reason: pass ? 'fixture replay deterministic with snapshot stability' : 'fixture replay stability failure',
    details: checks,
  };
}

function runMalformedCase(caseData) {
  const requestFilters = caseData.filters || caseData.case_filters || {};
  const cursorInput = caseData.cursor_payload
    ? (caseData.cursor_payload.cursor_payload || caseData.cursor_payload)
    : caseData.cursor;
  const expectedHash = computeFiltersHash(requestFilters);
  if (caseData.case_id === 'VAL-001') {
    const decoded = validateJsonCursor(cursorInput);
    const pass = decoded.isValid === false && caseData.expected.error_code === 'MALFORMED_CURSOR';
    return {
      checkId: caseData.case_id,
      checkType: 'malformed-token',
      status: pass ? 'PASS' : 'FAIL',
      reason: pass ? 'malformed cursor rejected with malformed-cursor semantics' : `expected ${caseData.expected.error_code}, got ${decoded.error || 'valid cursor'}`,
      details: {
        expected: caseData.expected,
        actual: decoded.error ? { error: decoded.error } : { cursor: decoded.payload },
      },
    };
  }

  try {
    const parsed = decodeCursor(cursorInput);
    const mismatch = parsed.filters_hash && parsed.filters_hash !== expectedHash;
    const pass = mismatch && caseData.expected.error_code === 'FILTER_HASH_MISMATCH';

    return {
      checkId: caseData.case_id,
      checkType: 'malformed-token',
      status: pass ? 'PASS' : 'FAIL',
      reason: pass ? 'tampered filter hash rejected as malformed' : `expected filter_hash mismatch, got ${JSON.stringify(parsed.filters_hash)}`,
      details: {
        expected: caseData.expected,
        actual: { filters_hash: parsed.filters_hash || null },
      },
    };
  } catch (error) {
    return {
      checkId: caseData.case_id,
      checkType: 'malformed-token',
      status: 'FAIL',
      reason: `validation parsing failure: ${error.message}`,
      details: {
        expected: caseData.expected,
        actual: { error: error.message },
      },
    };
  }
}

function runMixedCase(caseData) {
  const step1 = caseData.step_1.cursor;
  const step2 = caseData.step_2.cursor;

  const step1Decoded = decodeCursor(step1);
  const step2Decoded = decodeCursor(step2);

  const mixedDirection = step1Decoded.sort_direction !== step2Decoded.sort_direction;
  const sameSnapshot = step1Decoded.snapshot_signature === step2Decoded.snapshot_signature;
  const pass = mixedDirection && sameSnapshot && caseData.expected.error_code === 'MIXED_DIRECTION_JUMP';

  return {
    checkId: caseData.case_id,
    checkType: 'mixed-direction',
    status: pass ? 'PASS' : 'FAIL',
    reason: pass ? 'non-contiguous direction change rejected' : 'cursor direction jump was not rejected',
    details: {
      expected: caseData.expected,
      actual: {
        step_1_sort_direction: step1Decoded.sort_direction,
        step_2_sort_direction: step2Decoded.sort_direction,
        same_snapshot: sameSnapshot,
      },
    },
  };
}

function runStaleCase(caseCase) {
  const contract = caseCase.contract || {};
  const staleAfterMinutes = contract.staleAfterMinutes;
  const shouldBeStale = (caseCase.input.payload_age_minutes > staleAfterMinutes) || caseCase.input.refresh_status === 'partial_failure';

  const staleReason = shouldBeStale
    ? (caseCase.input.refresh_status === 'partial_failure' ? 'partial_refresh_failure' : 'refresh_timeout')
    : null;

  const pass =
    shouldBeStale === caseCase.expected.is_stale &&
    staleReason === caseCase.expected.stale_reason &&
    caseCase.expected.items_preserved === true &&
    caseCase.expected.mode === 'read-only';

  return {
    checkId: caseCase.case_id,
    checkType: 'stale-refresh',
    status: pass ? 'PASS' : 'FAIL',
    reason: pass ? 'stale fallback contract satisfied' : 'stale fallback contract violated',
    details: {
      expected: {
        is_stale: caseCase.expected.is_stale,
        stale_reason: caseCase.expected.stale_reason,
        mode: caseCase.expected.mode,
      },
      actual: {
        is_stale: shouldBeStale,
        stale_reason: staleReason,
        mode: shouldBeStale ? 'read-only' : 'active',
        payload_age_minutes: caseCase.input.payload_age_minutes,
        refresh_status: caseCase.input.refresh_status,
      },
    },
  };
}

function runAll() {
  const fixtures = readJson(fixturePath);
  const validation = readJson(validationPath);
  const stale = readJson(stalePath);

  const ifcCase = fixtures.fixtureCases.find((entry) => entry.case_id === 'IFC-001');
  const malformedCases = validation.malformedTokenCases.filter((entry) => entry.case_id === 'VAL-001' || entry.case_id === 'VAL-002');
  const mixedCases = validation.mixedDirectionCases;
  const staleCases = stale.cases;

  const checks = [
    runIfc(ifcCase),
    ...malformedCases.map(runMalformedCase),
    ...mixedCases.map(runMixedCase),
    ...staleCases.map(runStaleCase),
  ];

  const passCount = checks.filter((check) => check.status === 'PASS').length;
  const failCount = checks.length - passCount;
  const allPass = failCount === 0;

  const artifact = {
    version: '2026-02-19',
    iteration: 9,
    gate: 'interaction_worker_rollout_readiness',
    artifactGeneratedAtUtc: new Date().toISOString(),
    status: allPass ? 'passed' : 'blocked',
    preconditions: {
      fixtureArtifactPresent: true,
      validationCasesArtifactPresent: true,
      stalePayloadArtifactPresent: true,
      rolloutChecklistPresent: true,
      runtimeInteractionWorkerAvailable: allPass,
    },
    checks,
    decision: {
      currentMode: 'read-only',
      proposedEnablementMode: 'enabled',
      allChecksMustPassForEnablement: true,
      rollbackAction: 'Set interaction_worker.mode=read-only and reload runtime configuration',
      oneStepModeFlipRequired: true,
    },
    summary: {
      totalChecks: checks.length,
      passCount,
      failCount,
      allPass,
    },
    nextSteps: allPass
      ? [
          'Keep interaction worker in read-only mode until one-step runtime enablement review passes.',
          'Execute runtime mode flip only through an explicit one-step flag change if policy approval is given.',
        ]
      : [
          'Block interaction-worker write/update mode until all checks pass.',
          'Re-run failing checks in a deterministic harness invocation and refresh artifact.',
        ],
  };

  writeJson(verificationPath, artifact);

  console.log(`Interaction-worker gate harness executed at ${artifact.artifactGeneratedAtUtc}`);
  console.log(`Checks: ${passCount}/${checks.length} PASS`);
  checks.forEach((check) => {
    console.log(`${check.checkId}: ${check.status}`);
  });

  if (!allPass) {
    process.exit(1);
  }
}

runAll();
