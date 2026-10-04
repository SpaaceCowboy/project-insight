import React from 'react';
import {createRoot} from 'react-dom/client';
import GameApp from './GameApp.jsx';
import EditorApp from './EditorApp.jsx';
import './achievement-store.js';
import './styles.css';
import './editor.css';

const editor=location.pathname.toLowerCase().endsWith('/editor.html');
createRoot(document.getElementById('root')).render(<React.StrictMode>{editor ? <EditorApp /> : <GameApp />}</React.StrictMode>);
