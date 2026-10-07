import React from 'react';
import {createRoot} from 'react-dom/client';
import GameApp from './GameApp.jsx';
import EditorApp from './EditorApp.jsx';
import {activeGame,loadGame} from './game-state.js';
import './achievement-store.js';
import './styles.css';
import './editor.css';

const editor=location.pathname.toLowerCase().endsWith('/editor.html');
const render=()=>createRoot(document.getElementById('root')).render(<React.StrictMode>{editor ? <EditorApp /> : <GameApp />}</React.StrictMode>);
// Game 2 data is a separate chunk; a failed load falls back to Game 1 in initializeGame.
if(editor)render();else loadGame(activeGame()).catch(error=>console.error(error)).finally(render);
