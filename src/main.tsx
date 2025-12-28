import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Add error boundary for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (error) {
  console.error('Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0A0A0A;
      color: #E0E0E0;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="max-width: 600px; text-align: center;">
        <h2 style="color: #FF6B6B; margin-bottom: 1rem;">Application Error</h2>
        <p style="margin-bottom: 1rem;">An error occurred while loading the application.</p>
        <p style="color: #888; font-size: 0.9rem;">Please check the browser console for details.</p>
        <button 
          onclick="window.location.reload()" 
          style="
            margin-top: 1rem;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #0080FF 0%, #40E0D0 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
          "
        >
          Reload Page
        </button>
      </div>
    </div>
  `;
}
