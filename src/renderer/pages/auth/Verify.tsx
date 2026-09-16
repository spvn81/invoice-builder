import { useState, type FC } from 'react';
import { Box, Button, Container, Typography, Paper, TextField, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

export const VerifyPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || '';
  
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token })
      });
      const data = await res.json();
      
      if (data.success) {
         setSuccess('Email verified successfully! You can now log in.');
         setTimeout(() => {
           navigate('/login');
         }, 2000);
      } else {
         setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (data.success) {
         setSuccess('Verification email resent.');
      } else {
         setError(data.message || 'Failed to resend verification email');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'grey.100' }}>
      <Container maxWidth="xs">
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold" align="center">
            Verify Email
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph align="center">
            Enter the verification token sent to your email address.
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          
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
              label="Verification Token"
              type="text"
              fullWidth
              margin="normal"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
            />
            
            <Button 
              type="submit"
              variant="contained" 
              color="primary" 
              size="large"
              fullWidth
              sx={{ mt: 3, mb: 1 }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
            
            <Button 
              variant="outlined" 
              fullWidth
              onClick={handleResend}
              disabled={loading || !email}
              sx={{ mb: 2 }}
            >
              Resend Token
            </Button>
            
            <Button 
              variant="text" 
              fullWidth
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};
