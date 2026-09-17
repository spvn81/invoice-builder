import { getSystemDb } from '../db/systemDb';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ensures that a user has a valid workspace. 
 * If default_workspace_id is missing or points to an invalid workspace, 
 * it provisions a new one safely and idempotently.
 */
export const ensureUserWorkspace = async (userId: string): Promise<string> => {
  const db = await getSystemDb();
  const lockName = `provision_workspace_${userId}`;
  
  // Acquire concurrency lock
  const lockRes = await db.query('SELECT GET_LOCK(?, 10) as lockResult', [lockName]);
  if (!lockRes.rows || lockRes.rows[0].lockResult !== 1) {
    throw new Error('error.couldNotAcquireWorkspaceLock');
  }

  try {
    const userRes = await db.query('SELECT default_workspace_id FROM users WHERE id = ?', [userId]);
    if (!userRes.rows || userRes.rows.length === 0) {
      throw new Error('error.userNotFound');
    }
    
    const user = userRes.rows[0] as any;
    
    // Check if default_workspace_id exists and is valid
    if (user.default_workspace_id) {
      const workspaceRes = await db.query('SELECT id FROM workspaces WHERE id = ?', [user.default_workspace_id]);
      if (workspaceRes.rows && workspaceRes.rows.length > 0) {
        return user.default_workspace_id; // Workspace is valid
      }
    }
    
    // Missing or invalid workspace -> create new
    const newWorkspaceId = uuidv4();
    
    await db.run('BEGIN');
    try {
      await db.run('INSERT INTO workspaces (id, name) VALUES (?, ?)', [newWorkspaceId, 'Default Workspace']);
      await db.run('UPDATE users SET default_workspace_id = ? WHERE id = ?', [newWorkspaceId, userId]);
      await db.run('COMMIT');
      return newWorkspaceId;
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } finally {
    // Release the concurrency lock
    await db.run('SELECT RELEASE_LOCK(?)', [lockName]);
  }
};
