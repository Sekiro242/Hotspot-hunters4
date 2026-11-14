import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './app/ErrorBoundary';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/main.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
