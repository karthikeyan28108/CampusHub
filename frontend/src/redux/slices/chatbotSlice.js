import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api.js';

export const sendChatMessage = createAsyncThunk(
  'chatbot/sendChatMessage',
  async ({ question }, { rejectWithValue }) => {
    try {
      const response = await api.post('/chatbot/ask', { question });
      return response.data; // { status: 'success', answer, sources }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to get response from AI Assistant.';
      return rejectWithValue(errorMessage);
    }
  }
);

const initialWelcomeMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: "Hello! I am CampusHub's AI Assistant. Ask me anything about syllabus notes, academic materials, active placement drives, eligibility criteria, or the campus project documentation.",
  sources: [],
  timestamp: new Date().toISOString()
};

const initialState = {
  messages: [initialWelcomeMessage],
  loading: false,
  error: null,
  isOpen: false
};

const chatbotSlice = createSlice({
  name: 'chatbot',
  initialState,
  reducers: {
    toggleChatbot: (state) => {
      state.isOpen = !state.isOpen;
    },
    openChatbot: (state) => {
      state.isOpen = true;
    },
    closeChatbot: (state) => {
      state.isOpen = false;
    },
    clearChat: (state) => {
      state.messages = [{
        ...initialWelcomeMessage,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toISOString()
      }];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Add user question to messages list immediately
        state.messages.push({
          id: `user-${Date.now()}`,
          sender: 'user',
          text: action.meta.arg.question,
          sources: [],
          timestamp: new Date().toISOString()
        });
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.messages.push({
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: action.payload.answer,
          sources: action.payload.sources || [],
          timestamp: new Date().toISOString()
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.messages.push({
          id: `bot-err-${Date.now()}`,
          sender: 'assistant',
          text: `Sorry, I ran into an issue: ${action.payload || 'Unable to retrieve answer.'}`,
          sources: [],
          isError: true,
          timestamp: new Date().toISOString()
        });
      });
  }
});

export const { toggleChatbot, openChatbot, closeChatbot, clearChat } = chatbotSlice.actions;
export default chatbotSlice.reducer;
