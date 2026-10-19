import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteWorkspace, getDatasetSignature, listWorkspaces, saveWorkspace } from './localWorkspaces.js';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

test('saved workspaces are scoped to a dataset signature and updated by name', () => {
  const storage = new MemoryStorage();
  const signature = getDatasetSignature('sales.csv', ['Region', 'Revenue'], 20);
  const settings = { filterMode: 'all', search: 'west' };

  const first = saveWorkspace({ name: 'Regional review', fileName: 'sales.csv', signature, settings }, storage, 1000);
  const updated = saveWorkspace({ name: 'regional review', fileName: 'sales.csv', signature, settings: { ...settings, search: 'east' } }, storage, 2000);

  assert.equal(updated.id, first.id);
  assert.equal(listWorkspaces(signature, storage).length, 1);
  assert.deepEqual(listWorkspaces(signature, storage)[0].settings, { filterMode: 'all', search: 'east' });
  assert.deepEqual(listWorkspaces(getDatasetSignature('other.csv', ['Region', 'Revenue'], 20), storage), []);
  assert.notEqual(signature, getDatasetSignature('sales.csv', ['Region', 'Revenue'], 21));
});

test('saved workspaces can be deleted and corrupt browser storage is ignored', () => {
  const storage = new MemoryStorage();
  const signature = getDatasetSignature('sales.csv', ['Region'], 1);
  const workspace = saveWorkspace({ name: 'Review', fileName: 'sales.csv', signature, settings: {} }, storage, 3000);

  assert.equal(deleteWorkspace(workspace.id, storage), true);
  assert.deepEqual(listWorkspaces(signature, storage), []);
  storage.setItem('insightx-saved-workspaces-v1', '{bad json');
  assert.deepEqual(listWorkspaces(signature, storage), []);
});
