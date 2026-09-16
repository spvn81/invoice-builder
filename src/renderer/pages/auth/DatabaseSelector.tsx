import { useEffect, useState, type FC } from 'react';
import { Box, Button, Container, Typography, Paper, Alert, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../state/configureStore';

interface DatabaseMetadata {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  databaseType: string;
}

export const DatabaseSelectorPage: FC = () => {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState<DatabaseMetadata[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/databases');
      const data = await res.json();
      if (data.success) {
        setDatabases(data.data);
      } else {
        setError(data.message || 'Failed to load databases');
      }
    } catch (err) {
      setError('An error occurred while loading databases');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (dbId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/databases/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: dbId })
      });
      const data = await res.json();
      if (data.success) {
        navigate('/invoices');
      } else {
        setError(data.message || 'Failed to open database');
      }
    } catch (err) {
      setError('An error occurred opening database');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `user_db_${Date.now()}` }) // Or a prompt
      });
      const data = await res.json();
      if (data.success) {
        // Automatically select the newly created one
        await handleSelect(data.data.id);
      } else {
        setError(data.message || 'Failed to create database');
      }
    } catch (err) {
      setError('An error occurred creating database');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'grey.100' }}>
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold" align="center">
            Select Workspace
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <List sx={{ mb: 3 }}>
                {databases.map((db) => (
                  <ListItem 
                    key={db.id} 
                    divider 
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <ListItemText 
                      primary={db.name} 
                      secondary={`Status: ${db.status} ${db.isDefault ? '(Default)' : ''}`} 
                    />
                    <Button 
                      variant="contained" 
                      onClick={() => handleSelect(db.id)}
                      disabled={actionLoading || db.status !== 'ready'}
                      color={db.status === 'ready' ? 'primary' : 'warning'}
                    >
                      {db.status === 'ready' ? 'Open' : db.status}
                    </Button>
                  </ListItem>
                ))}
              </List>

              <Button 
                variant="outlined" 
                fullWidth 
                onClick={handleCreateNew}
                disabled={actionLoading}
              >
                {actionLoading ? 'Please wait...' : 'Create New Workspace'}
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};
