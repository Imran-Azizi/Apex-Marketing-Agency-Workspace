/**
 * Stable fingerprints for recommendation deduplication.
 */

export function buildFingerprint(signal, context) {
  const stage = String(context.pipelineStage || '');
  const daysBucket = Math.floor(Number(context.daysInStage) || 0);
  const intent = String(signal.intentLevel || 'unknown');
  const objections = (signal.objections || []).slice(0, 3).sort().join('|');
  return [
    signal.kind,
    stage,
    String(daysBucket),
    intent,
    objections,
  ].join(':');
}

export function fingerprintsEqual(a, b) {
  return String(a || '') === String(b || '');
}
