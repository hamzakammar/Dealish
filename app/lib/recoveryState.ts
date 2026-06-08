import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared flag so _layout.tsx can signal to index.tsx that the app
 * was opened via a password-recovery deep link.
 *
 * Persisted in AsyncStorage to survive cold boots and app restarts.
 */
const RECOVERY_FLOW_KEY = 'dealish:recovery_flow_active';

let _isRecoveryFlow = false;

// Sync initialization from storage isn't possible here for synchronous access,
// but we provide an async init and keep the synchronous getter/setter.
export async function initRecoveryState() {
  try {
    const val = await AsyncStorage.getItem(RECOVERY_FLOW_KEY);
    _isRecoveryFlow = val === 'true';
  } catch (e) {
    console.error('Error initializing recovery state:', e);
  }
}

export function setRecoveryFlow() {
  _isRecoveryFlow = true;
  AsyncStorage.setItem(RECOVERY_FLOW_KEY, 'true').catch(e => 
    console.error('Error persisting recovery flow:', e)
  );
}

export function consumeRecoveryFlow(): boolean {
  const was = _isRecoveryFlow;
  if (was) {
    _isRecoveryFlow = false;
    AsyncStorage.removeItem(RECOVERY_FLOW_KEY).catch(e => 
      console.error('Error clearing recovery flow:', e)
    );
  }
  return was;
}

export function isRecoveryFlow(): boolean {
  return _isRecoveryFlow;
}
