import { createSlice } from '@reduxjs/toolkit';

const initialToken = localStorage.getItem('campushub_token') || null;
let initialUser = null;

try {
  const savedUser = localStorage.getItem('campushub_user');
  if (savedUser) {
    initialUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.error('Failed to parse saved user credentials:', e);
}

const initialState = {
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!initialToken,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    authSuccess: (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
      
      // Save details to localStorage
      localStorage.setItem('campushub_token', action.payload.token);
      localStorage.setItem('campushub_user', JSON.stringify(action.payload.user));
    },
    authFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('campushub_user', JSON.stringify(state.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      
      // Clear localStorage
      localStorage.removeItem('campushub_token');
      localStorage.removeItem('campushub_user');
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const { authStart, authSuccess, authFailure, updateUser, logout, clearError } = authSlice.actions;
export default authSlice.reducer;
