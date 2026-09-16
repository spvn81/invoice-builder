import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  user: {
    userId: string;
    workspaceId: string;
    username: string;
    email: string;
  } | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<AuthState['user']>) => {
      state.isAuthenticated = !!action.payload;
      state.user = action.payload;
      state.isInitialized = true;
    },
    clearAuth: state => {
      state.isAuthenticated = false;
      state.user = null;
      state.isInitialized = true;
    },
    setInitialized: state => {
      state.isInitialized = true;
    }
  }
});

export const { setAuth, clearAuth, setInitialized } = authSlice.actions;
export default authSlice.reducer;
