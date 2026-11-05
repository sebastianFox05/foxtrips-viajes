/* Punto de entrada de FoxTrips (React). */
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import 'leaflet/dist/leaflet.css';
import './styles/styles.css';
import App from './App.jsx';
import { SessionProvider } from './session/SessionContext.jsx';
import { UiProvider } from './ui/UiContext.jsx';
import { LightboxProvider } from './ui/LightboxContext.jsx';

// Service worker (app instalable y consultable sin conexion): se actualiza solo
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <SessionProvider>
      <UiProvider>
        <LightboxProvider>
          <App />
        </LightboxProvider>
      </UiProvider>
    </SessionProvider>
  </HashRouter>
);
