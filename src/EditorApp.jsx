import React from 'react';
import useEditor from './useEditor.js';
import {Palette,EditorBoard,Counts,Tile} from './views.jsx';
import {CORE_LEVELS,PuzzleArt} from './data.js';
import {ColorStrokes} from './react-ui.jsx';
import {createPortal} from 'react-dom';
import FeedbackUI from './FeedbackUI.jsx';

export default function EditorApp() {
  const editor=useEditor(),{draft,dialogs}=editor;
  function tabKeys(event,name){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['paint','puzzles','files'],i=tabs.indexOf(name),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;editor.showPanel(tabs[next]);document.getElementById(tabs[next]+'Tab').focus()}
  return <>
<div className="ambient-lights" aria-hidden="true"><span></span><span></span></div>
<div className="editor-app" inert={!!dialogs.active} onPointerMove={editor.pointerMove} onPointerUp={editor.pointerUp} onPointerCancel={editor.cancelPlacement} onLostPointerCapture={()=>{if(editor.drag)editor.cancelPlacement()}}>
  <header className="topbar"><div className="editor-brand">INSIGHT <span id="editorSubtitle">{draft.name.trim() || 'Untitled puzzle'}</span></div><div className="top-actions"><span id="saveState" role="status">{editor.saved?'Saved':'Export to keep'}</span><a className="ui-btn" href="Puzzle.html">Game</a></div></header>
  <main className="editor-main">
    <aside className="studio-tools" aria-label="Puzzle tools">
      <div className="studio-tabs" role="tablist" aria-label="Editor tools">
        <button id="paintTab" role="tab" tabIndex={editor.panel==='paint'?0:-1} aria-controls="paintPanel" aria-selected={editor.panel==='paint'} data-panel="paint" onClick={()=>editor.showPanel('paint')} onKeyDown={event=>tabKeys(event,'paint')}>Build</button>
        <button id="puzzlesTab" role="tab" tabIndex={editor.panel==='puzzles'?0:-1} aria-controls="puzzlesPanel" aria-selected={editor.panel==='puzzles'} data-panel="puzzles" onClick={()=>editor.showPanel('puzzles')} onKeyDown={event=>tabKeys(event,'puzzles')}>Puzzles</button>
        <button id="filesTab" role="tab" tabIndex={editor.panel==='files'?0:-1} aria-controls="filesPanel" aria-selected={editor.panel==='files'} data-panel="files" onClick={()=>editor.showPanel('files')} onKeyDown={event=>tabKeys(event,'files')}>Files</button>
      </div>
      <section id="paintPanel" role="tabpanel" aria-labelledby="paintTab" hidden={editor.panel!=='paint'}>
        <div className="tool-heading">Tiles · drag onto the board</div>
        <div id="palette" role="group" aria-label="Tiles to drag onto the board"><Palette editor={editor} /></div>
        <div className="studio-row paint-actions"><button id="copyBoard" onClick={()=>editor.change(next=>{next[editor.side==='start'?'target':'start']=next[editor.side].slice()})} className="ui-btn">{editor.side==='start'?'Start → Target':'Target → Start'}</button><button id="swapBoards" onClick={()=>editor.change(next=>{[next.start,next.target]=[next.target,next.start]})} className="ui-btn">Swap boards</button></div>
        <div id="tileCounts" aria-label="Board tile counts"><Counts counts={editor.counts} /></div>
      </section>
      <section id="puzzlesPanel" role="tabpanel" aria-labelledby="puzzlesTab" hidden={editor.panel!=='puzzles'}>
        <label className="studio-field">Puzzle name<input id="puzzleName" value={draft.name} onChange={event=>editor.change(next=>{next.name=event.currentTarget.value})} maxLength="60" autoComplete="off" /></label>
        <label className="studio-field">My puzzles<select id="draftSelect" value={draft.id} onChange={event=>editor.switchDraft(event.currentTarget.value)}>{editor.library.drafts.map(item=><option key={item.id} value={item.id}>{item.name.trim() || 'Untitled puzzle'}</option>)}</select></label>
        <div className="studio-row"><button id="newDraft" onClick={editor.newDraft} className="ui-btn">New</button><button id="duplicateDraft" onClick={editor.duplicateDraft} className="ui-btn">Duplicate</button><button id="deleteDraft" onClick={editor.deleteDraft} className="ui-btn">Delete</button></div>
        <div className="studio-row sizes"><label>Columns<select id="boardWidth" value={draft.start[0].length} onChange={event=>editor.resize(+event.currentTarget.value,draft.start.length)} aria-label="Board columns"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Rows<select id="boardHeight" value={draft.start.length} onChange={event=>editor.resize(draft.start[0].length,+event.currentTarget.value)} aria-label="Board rows"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><button id="clearBoard" onClick={editor.clear} className="ui-btn">Clear</button></div>
        <div className="studio-row"><select id="seedLevel" value={editor.seed} onChange={event=>editor.setSeed(event.currentTarget.value)} aria-label="Built-in puzzle to copy">{CORE_LEVELS.map((level,i)=><option key={i} value={i}>{String(i+1).padStart(3,'0')+' · '+level.name}</option>)}</select><button id="copyLevel" onClick={editor.copyLevel} className="ui-btn">Copy level</button></div>
        <button id="shuffleStart" onClick={editor.shuffle} className="ui-btn">Shuffle Start from Target</button>
      </section>
      <section id="filesPanel" role="tabpanel" aria-labelledby="filesTab" hidden={editor.panel!=='files'}>
        <div className="studio-row"><select id="exportScope" value={editor.exportScope} onChange={event=>editor.setExportScope(event.currentTarget.value)} aria-label="Export scope"><option value="one">This puzzle</option><option value="all">All my puzzles</option></select><button id="exportFile" onClick={editor.exportFile} className="ui-btn">Export</button><button id="importFile" onClick={()=>editor.fileRef.current.click()} className="ui-btn">Import file</button></div>
        <input id="fileInput" ref={editor.fileRef} onChange={editor.importFile} type="file" accept=".json,application/json" hidden={true} />
        <label className="studio-field">Puzzle JSON<textarea id="importText" value={editor.importText} onChange={event=>editor.setImportText(event.currentTarget.value)} spellCheck="false" placeholder="Paste a puzzle or collection"></textarea></label>
        <button id="importPaste" onClick={()=>editor.importJSON(editor.importText)} className="ui-btn">Import pasted JSON</button>
      </section>
    </aside>
    <section className="studio-canvas" aria-label="Puzzle design">
      <div className="canvas-heading"><h1 id="draftTitle">{draft.name.trim() || 'Untitled puzzle'}</h1><span id="boardDimensions">{draft.start[0].length+' × '+draft.start.length}</span></div>
      <div className="studio-row canvas-toolbar"><div className="board-switch" role="group" aria-label="Board to edit"><button id="editStart" onClick={()=>editor.changeSide('start')} aria-pressed={editor.side==='start'}>Start</button><button id="editTarget" onClick={()=>editor.changeSide('target')} aria-pressed={editor.side==='target'}>Target</button></div><div className="studio-row"><button id="editUndo" onClick={()=>editor.undoEdit()} className="ui-btn" disabled={!editor.edits.undo.length} aria-label="Undo edit">↶ Undo</button><button id="editRedo" onClick={()=>editor.undoEdit(true)} className="ui-btn" disabled={!editor.edits.redo.length} aria-label="Redo edit">↷ Redo</button></div></div>
      <div className="studio-board-shell" ref={editor.shellRef}><div id="editorBoard" ref={editor.boardRef} role="group" aria-label={(editor.side==='start'?'Start':'Target')+' board'} style={{'--cols':draft.start[0].length,'--rows':draft.start.length}}><EditorBoard editor={editor} /></div><ColorStrokes ink={editor.ink} /></div>
    </section>
    <footer className="studio-footer">
      <div id="validationStatus" role="status" aria-live="polite" data-state={editor.status.tone}>{editor.status.text}</div>
      <div className="studio-row"><button id="validatePuzzle" onClick={editor.validate} className="control-btn">{editor.checking?'Cancel check':'Validate'}</button><button id="playtestPuzzle" onClick={editor.playtest} className="control-btn primary" disabled={!draft.proof?.par || editor.checking}>Playtest</button></div>
    </footer>
  </main>
</div>
<FeedbackUI dialogs={dialogs} feedback={editor.feedback} />
<a ref={editor.downloadRef} href={editor.download?.url} download={editor.download?.name} hidden={true}>Download puzzle</a>
{editor.drag && createPortal(<Tile type={editor.drag.type} className={'tile '+PuzzleArt.META[editor.drag.type].cls+' drag-preview'+(editor.discarding?' discarding':'')} aria-hidden="true" tabIndex={-1} style={{left:editor.drag.x,top:editor.drag.y,'--cell':editor.drag.size+'px'}} />,document.body)}
  </>;
}
