import React from 'react';
import {createRoot} from 'react-dom/client';
import GameApp from './GameApp.jsx';
import EditorApp from './EditorApp.jsx';
import './styles.css';
import './editor.css';

// Puzzle.html only plays a puzzle handed over by the editor; every other entry opens the studio.
const playtest=location.pathname.toLowerCase().endsWith('/puzzle.html');
createRoot(document.getElementById('root')).render(<React.StrictMode>{playtest ? <GameApp /> : <EditorApp />}</React.StrictMode>);
