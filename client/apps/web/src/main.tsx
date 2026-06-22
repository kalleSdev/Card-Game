import { createRoot } from 'react-dom/client'
import './index.css'
import './backgrounds' // kicks off all image preloads before any screen renders
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
