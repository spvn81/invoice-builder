import { useState, type FC } from 'react';
import { Box, Button, Container, Typography, Paper, TextField, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../state/configureStore';
import { setAuth } from '../../state/authSlice';
import { setDbReady } from '../../state/pageSlice';

export const LoginPage: FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
         dispatch(setAuth(data.data));
         if (!data.data.databaseCreationRequired && !data.data.databaseSelectionRequired) {
             dispatch(setDbReady(true));
         }
         // GuestRoute will handle the redirect based on the updated Redux state
      } else {
         setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'grey.100' }}>
      <Container maxWidth="xs">
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold" align="center">
            Sign In
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            
            <Button 
              type="submit"
              variant="contained" 
              color="primary" 
              size="large"
              fullWidth
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <Button 
              variant="text" 
              fullWidth
              onClick={() => navigate('/register')}
            >
              Don't have an account? Sign up
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};
