import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './redux/store.js';
import App from './App.jsx';

// Import Bootstrap 5 CSS and JavaScript bundle
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Import custom styles
import './index.css';

import { ChatNotificationProvider } from './context/ChatNotificationContext.jsx';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <ChatNotificationProvider>
      <App />
    </ChatNotificationProvider>
  </Provider>
);
