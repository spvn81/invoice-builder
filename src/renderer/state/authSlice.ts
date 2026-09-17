import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  databaseSelectionRequired: boolean;
  databaseCreationRequired: boolean;
  user: {
    userId: string;
    workspaceId: string;
    username: string;
    email: string;
  } | null;
  databaseSelectionRequired?: boolean;
  databaseCreationRequired?: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isInitialized: false,
  databaseSelectionRequired: false,
  databaseCreationRequired: false,
  user: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<AuthState['user'] & { databaseSelectionRequired?: boolean; databaseCreationRequired?: boolean }>) => {
      state.isAuthenticated = !!action.payload;
      if (action.payload) {
        state.user = {
          userId: action.payload.userId,
          workspaceId: action.payload.workspaceId,
          username: action.payload.username,
          email: action.payload.email
        };
        state.databaseSelectionRequired = !!action.payload.databaseSelectionRequired;
        state.databaseCreationRequired = !!action.payload.databaseCreationRequired;
      } else {
        state.user = null;
        state.databaseSelectionRequired = false;
        state.databaseCreationRequired = false;
      }
      state.isInitialized = true;
    },
    clearAuth: state => {
      state.isAuthenticated = false;
      state.user = null;
      state.isInitialized = true;
      state.databaseSelectionRequired = false;
      state.databaseCreationRequired = false;
    },
    setInitialized: state => {
      state.isInitialized = true;
    },
    setDatabaseSelectionRequired: (state, action: PayloadAction<boolean>) => {
      state.databaseSelectionRequired = action.payload;
    },
    setDatabaseCreationRequired: (state, action: PayloadAction<boolean>) => {
      state.databaseCreationRequired = action.payload;
    }
  }
});

export const { setAuth, clearAuth, setInitialized, setDatabaseSelectionRequired, setDatabaseCreationRequired } = authSlice.actions;
export default authSlice.reducer;
