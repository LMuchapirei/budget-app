import * as FileSystem from 'expo-file-system/legacy';

const EVIDENCE_DIR = `${FileSystem.documentDirectory ?? ''}payment-evidence/`;

function extensionFor(uri: string) {
  const clean = uri.split('?')[0];
  const ext = clean.includes('.') ? clean.split('.').pop() : 'jpg';
  return ext && ext.length <= 5 ? ext : 'jpg';
}

export async function persistEvidenceImage(uri: string) {
  if (!FileSystem.documentDirectory) return uri;
  await FileSystem.makeDirectoryAsync(EVIDENCE_DIR, { intermediates: true });
  const target = `${EVIDENCE_DIR}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(uri)}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

export async function deleteEvidenceFile(uri?: string) {
  if (!uri || !uri.startsWith(EVIDENCE_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Evidence metadata should still be removable if the file is already gone.
  }
}

export async function clearEvidenceFiles() {
  if (!FileSystem.documentDirectory) return;
  try {
    await FileSystem.deleteAsync(EVIDENCE_DIR, { idempotent: true });
  } catch {
    // Clearing app data should not fail just because an attachment file is gone.
  }
}
