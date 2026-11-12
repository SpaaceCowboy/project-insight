import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './styles/tokens.css';
import './styles/site.css';
import App from './App.jsx';
import {installPress} from './ui.jsx';

installPress();

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
