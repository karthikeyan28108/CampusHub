import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import chatbotReducer from './slices/chatbotSlice.js';
import oversightReducer from './slices/oversightSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chatbot: chatbotReducer,
    oversight: oversightReducer
  }
});

export default store;
