import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api.js';

// Look up conversation messages between two users by register numbers
export const lookupConversation = createAsyncThunk(
  'oversight/lookupConversation',
  async ({ registerNumberA, registerNumberB, reason }, { rejectWithValue }) => {
    try {
      const response = await api.post('/admin/messages/oversight', {
        registerNumberA,
        registerNumberB,
        reason
      });
      return response.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to lookup conversation history.';
      return rejectWithValue(message);
    }
  }
);

// Fetch previous oversight audit logs
export const fetchOversightLogs = createAsyncThunk(
  'oversight/fetchOversightLogs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/messages/oversight/logs');
      return response.data.logs;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch audit logs.';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  result: null,
  loading: false,
  error: null,
  logs: [],
  logsLoading: false,
  logsError: null
};

const oversightSlice = createSlice({
  name: 'oversight',
  initialState,
  reducers: {
    clearOversightResult: (state) => {
      state.result = null;
      state.error = null;
    },
    clearOversightError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // lookupConversation
      .addCase(lookupConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(lookupConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.result = action.payload;
        state.error = null;
      })
      .addCase(lookupConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'An error occurred during lookup.';
      })

      // fetchOversightLogs
      .addCase(fetchOversightLogs.pending, (state) => {
        state.logsLoading = true;
        state.logsError = null;
      })
      .addCase(fetchOversightLogs.fulfilled, (state, action) => {
        state.logsLoading = false;
        state.logs = action.payload;
        state.logsError = null;
      })
      .addCase(fetchOversightLogs.rejected, (state, action) => {
        state.logsLoading = false;
        state.logsError = action.payload || 'Failed to fetch audit logs.';
      });
  }
});

export const { clearOversightResult, clearOversightError } = oversightSlice.actions;
export default oversightSlice.reducer;
