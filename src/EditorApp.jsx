import React, {useEffect} from 'react';
import {View} from './views.jsx';
import {initEditor} from '../editor.js';
import FeedbackUI from './FeedbackUI.jsx';

export default function EditorApp() {
  useEffect(() => {
    let cleanup;
    const timer=setTimeout(() => {cleanup=initEditor();document.documentElement.dataset.ready="true";document.getElementById("root").inert=false},0);
    return () => {clearTimeout(timer);cleanup?.()};
  },[]);
  return <>
<div className="ambient-lights" aria-hidden="true"><span></span><span></span></div>
<div className="editor-app">
  <header className="topbar"><div className="editor-brand">INSIGHT <span id="editorSubtitle">Puzzle Studio</span></div><div className="top-actions"><span id="saveState" role="status">Saved</span><a className="ui-btn" href="Puzzle.html">Game</a></div></header>
  <main className="editor-main">
    <aside className="studio-tools" aria-label="Puzzle tools">
      <div className="studio-tabs" role="tablist" aria-label="Editor tools">
        <button id="paintTab" role="tab" aria-controls="paintPanel" aria-selected="true" data-panel="paint">Build</button>
        <button id="puzzlesTab" role="tab" aria-controls="puzzlesPanel" aria-selected="false" data-panel="puzzles" tabIndex="-1">Puzzles</button>
        <button id="filesTab" role="tab" aria-controls="filesPanel" aria-selected="false" data-panel="files" tabIndex="-1">Files</button>
      </div>
      <section id="paintPanel" role="tabpanel" aria-labelledby="paintTab">
        <div className="tool-heading">Tiles · drag onto the board</div>
        <div id="palette" role="group" aria-label="Tiles to drag onto the board"><View name="palette" /></div>
        <div className="studio-row paint-actions"><button id="copyBoard" className="ui-btn">Start → Target</button><button id="swapBoards" className="ui-btn">Swap boards</button></div>
        <div id="tileCounts" aria-label="Board tile counts"><View name="counts" /></div>
      </section>
      <section id="puzzlesPanel" role="tabpanel" aria-labelledby="puzzlesTab" hidden={true}>
        <label className="studio-field">Puzzle name<input id="puzzleName" maxLength="60" autoComplete="off" /></label>
        <label className="studio-field">My puzzles<select id="draftSelect"><View name="drafts" /></select></label>
        <div className="studio-row"><button id="newDraft" className="ui-btn">New</button><button id="duplicateDraft" className="ui-btn">Duplicate</button><button id="deleteDraft" className="ui-btn">Delete</button></div>
        <div className="studio-row sizes"><label>Columns<select id="boardWidth" aria-label="Board columns"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Rows<select id="boardHeight" aria-label="Board rows"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><button id="clearBoard" className="ui-btn">Clear</button></div>
        <div className="studio-row"><select id="seedLevel" aria-label="Built-in puzzle to copy"><View name="seeds" /></select><button id="copyLevel" className="ui-btn">Copy level</button></div>
        <button id="shuffleStart" className="ui-btn">Shuffle Start from Target</button>
      </section>
      <section id="filesPanel" role="tabpanel" aria-labelledby="filesTab" hidden={true}>
        <div className="studio-row"><select id="exportScope" aria-label="Export scope"><option value="one">This puzzle</option><option value="all">All my puzzles</option></select><button id="exportFile" className="ui-btn">Export</button><button id="importFile" className="ui-btn">Import file</button></div>
        <input id="fileInput" type="file" accept=".json,application/json" hidden={true} />
        <label className="studio-field">Puzzle JSON<textarea id="importText" spellCheck="false" placeholder="Paste a puzzle or collection"></textarea></label>
        <button id="importPaste" className="ui-btn">Import pasted JSON</button>
      </section>
    </aside>
    <section className="studio-canvas" aria-label="Puzzle design">
      <div className="canvas-heading"><h1 id="draftTitle">My first puzzle</h1><span id="boardDimensions">2 × 2</span></div>
      <div className="studio-row canvas-toolbar"><div className="board-switch" role="group" aria-label="Board to edit"><button id="editStart" aria-pressed="true">Start</button><button id="editTarget" aria-pressed="false">Target</button></div><div className="studio-row"><button id="editUndo" className="ui-btn" disabled={true} aria-label="Undo edit">↶ Undo</button><button id="editRedo" className="ui-btn" disabled={true} aria-label="Redo edit">↷ Redo</button></div></div>
      <div className="studio-board-shell"><div id="editorBoard" role="group" aria-label="Start board"><View name="editorBoard" /></div></div>
    </section>
    <footer className="studio-footer">
      <div id="validationStatus" role="status" aria-live="polite">Validate to check your puzzle.</div>
      <div className="studio-row"><button id="validatePuzzle" className="control-btn">Validate</button><button id="playtestPuzzle" className="control-btn primary" disabled={true}>Playtest</button></div>
    </footer>
  </main>
</div>
<FeedbackUI />
  </>;
}
