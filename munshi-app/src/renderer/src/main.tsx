import React from 'react'
import ReactDOM from 'react-dom/client'
import './assets/globals.css'
import './assets/app.css'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/sonner'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="munshi-theme">
      <App />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  </React.StrictMode>
)
