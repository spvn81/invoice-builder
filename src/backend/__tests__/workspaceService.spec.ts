import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ensureUserWorkspace } from '../shared/services/workspaceService';
import { getSystemDb } from '../shared/db/systemDb';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../shared/db/systemDb', () => ({
  getSystemDb: vi.fn(),
}));

describe('workspaceService', () => {
  let mockDb: any;
  const mockUserId = uuidv4();

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      run: vi.fn(),
    };
    (getSystemDb as any).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('acquires and releases lock, and returns existing valid workspace', async () => {
    const existingWorkspaceId = uuidv4();

    // Mock GET_LOCK success
    mockDb.query.mockResolvedValueOnce({ rows: [{ lockResult: 1 }] });
    // Mock user having a workspace
    mockDb.query.mockResolvedValueOnce({ rows: [{ default_workspace_id: existingWorkspaceId }] });
    // Mock workspace existing in workspaces table
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: existingWorkspaceId }] });

    const result = await ensureUserWorkspace(mockUserId);

    expect(result).toBe(existingWorkspaceId);
    expect(mockDb.query).toHaveBeenNthCalledWith(1, 'SELECT GET_LOCK(?, 10) as lockResult', [`provision_workspace_${mockUserId}`]);
    expect(mockDb.query).toHaveBeenNthCalledWith(2, 'SELECT default_workspace_id FROM users WHERE id = ?', [mockUserId]);
    expect(mockDb.run).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', [`provision_workspace_${mockUserId}`]);
    expect(mockDb.run).not.toHaveBeenCalledWith('BEGIN');
  });

  it('creates a new workspace if user has no default_workspace_id', async () => {
    // Mock GET_LOCK success
    mockDb.query.mockResolvedValueOnce({ rows: [{ lockResult: 1 }] });
    // Mock user having NULL workspace
    mockDb.query.mockResolvedValueOnce({ rows: [{ default_workspace_id: null }] });

    const result = await ensureUserWorkspace(mockUserId);

    expect(result).toBeDefined();
    expect(mockDb.run).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO workspaces (id, name) VALUES (?, ?)', [result, 'Default Workspace']);
    expect(mockDb.run).toHaveBeenCalledWith('UPDATE users SET default_workspace_id = ? WHERE id = ?', [result, mockUserId]);
    expect(mockDb.run).toHaveBeenCalledWith('COMMIT');
    expect(mockDb.run).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', [`provision_workspace_${mockUserId}`]);
  });

  it('creates a new workspace if default_workspace_id points to an invalid workspace', async () => {
    const invalidWorkspaceId = uuidv4();
    
    // Mock GET_LOCK success
    mockDb.query.mockResolvedValueOnce({ rows: [{ lockResult: 1 }] });
    // Mock user having an invalid workspace
    mockDb.query.mockResolvedValueOnce({ rows: [{ default_workspace_id: invalidWorkspaceId }] });
    // Mock workspace missing in workspaces table
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const result = await ensureUserWorkspace(mockUserId);

    expect(result).toBeDefined();
    expect(result).not.toBe(invalidWorkspaceId);
    expect(mockDb.run).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO workspaces (id, name) VALUES (?, ?)', [result, 'Default Workspace']);
    expect(mockDb.run).toHaveBeenCalledWith('UPDATE users SET default_workspace_id = ? WHERE id = ?', [result, mockUserId]);
    expect(mockDb.run).toHaveBeenCalledWith('COMMIT');
  });
});
