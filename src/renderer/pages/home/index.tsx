import type { FC } from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export const HomePage: FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'grey.100' }}>
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" color="primary">
            Invoice Builder
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" paragraph>
            Create, manage, and share professional invoices with ease.
          </Typography>
          
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              onClick={() => navigate('/login')}
              fullWidth
            >
              Sign In
            </Button>
            <Button 
              variant="outlined" 
              color="primary" 
              size="large"
              onClick={() => navigate('/register')}
              fullWidth
            >
              Create an Account
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};
