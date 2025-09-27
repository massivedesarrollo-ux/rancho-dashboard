import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ChakraProvider } from '@chakra-ui/react' // <-- IMPORTA EL PROVEEDOR

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider> {/* <-- ENVUELVE TU APP */}
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)