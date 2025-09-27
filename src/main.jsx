// CÓDIGO CORREGIDO (VERSIÓN SIMPLE)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Es buena práctica importar los estilos base si los tienes

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)