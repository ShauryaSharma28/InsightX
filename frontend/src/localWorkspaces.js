const STORAGE_KEY = 'insightx-saved-workspaces-v1';

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readWorkspaces(storage) {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const saved = JSON.parse(target.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === 'string'
      && typeof item.name === 'string' && typeof item.signature === 'string'
      && typeof item.updatedAt === 'string' && item.settings && typeof item.settings === 'object') : [];
  } catch {
    return [];
  }
}

function writeWorkspaces(workspaces, storage) {
  const target = resolveStorage(storage);
  if (!target) throw new Error('Browser storage is unavailable.');
  target.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

export function getDatasetSignature(fileName, headers, rowCount) {
  const source = JSON.stringify([fileName, headers, rowCount]);
  let firstHash = 2166136261;
  let secondHash = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    firstHash = Math.imul(firstHash ^ code, 16777619) >>> 0;
    secondHash = Math.imul(secondHash ^ code, 2246822519) >>> 0;
  }
  return `${firstHash.toString(36)}-${secondHash.toString(36)}-${rowCount}`;
}

export function listWorkspaces(signature, storage) {
  return readWorkspaces(storage)
    .filter((workspace) => workspace.signature === signature)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveWorkspace(workspace, storage, now = Date.now()) {
  const name = String(workspace.name ?? '').trim().slice(0, 80);
  if (!name) throw new Error('Enter a name for this workspace.');
  if (!workspace.signature || !workspace.fileName || !workspace.settings) {
    throw new Error('This workspace is missing its dataset or view settings.');
  }

  const savedWorkspaces = readWorkspaces(storage);
  const existing = savedWorkspaces.find((item) => item.signature === workspace.signature
    && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const saved = {
    id: existing?.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    fileName: workspace.fileName,
    signature: workspace.signature,
    settings: workspace.settings,
    updatedAt: new Date(now).toISOString(),
  };
  const updatedWorkspaces = existing
    ? savedWorkspaces.map((item) => item.id === existing.id ? saved : item)
    : [saved, ...savedWorkspaces].slice(0, 100);
  writeWorkspaces(updatedWorkspaces, storage);
  return saved;
}

export function deleteWorkspace(id, storage) {
  const savedWorkspaces = readWorkspaces(storage);
  const remaining = savedWorkspaces.filter((workspace) => workspace.id !== id);
  if (remaining.length === savedWorkspaces.length) return false;
  writeWorkspaces(remaining, storage);
  return true;
}
