/**
 * Shared flag so _layout.tsx can signal to index.tsx that the app
 * was opened via a password-recovery deep link.
 *
 * Must be a module-level variable (not React state) so it's set
 * synchronously before any navigation decisions run.
 */
let _isRecoveryFlow = false;

export function setRecoveryFlow() {
  _isRecoveryFlow = true;
}

export function consumeRecoveryFlow(): boolean {
  const was = _isRecoveryFlow;
  _isRecoveryFlow = false;
  return was;
}

export function isRecoveryFlow(): boolean {
  return _isRecoveryFlow;
}
