package com.insightpuzzle.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class Phase { BUILD, SHAPE, CHECK }

/**
 * Port of src/useCreator.js. Build the start grid (S), move tiles to shape the target (T), then test the level.
 * Every move is reversible, so a target reached by moves is always solvable.
 * Kept in the view model so the work survives leaving and reopening the Create screen.
 */
class CreatorState {
    var phase by mutableStateOf(Phase.BUILD); private set
    var board by mutableStateOf(Rules.fit(emptyList(), 3, 3))
    var start by mutableStateOf<Board?>(null); private set
    var target by mutableStateOf<Board?>(null); private set
    var holding by mutableStateOf<Char?>(null)
    var picked by mutableStateOf<Pos?>(null)
    var note by mutableStateOf("")

    val rows get() = board.size
    val cols get() = board[0].length
    val solved get() = phase == Phase.CHECK && Rules.key(board) == Rules.key(target!!)

    val hint get() = note.ifEmpty {
        when (phase) {
            Phase.BUILD -> holding?.let { "Tap the grid to place ${Art.NAME[it]}. Tap the tile again to stop." } ?: "Drag tiles onto the grid, then tap Start."
            Phase.SHAPE -> "Move tiles to shape your target, then tap Target."
            Phase.CHECK -> if (solved) "Target reached. Your level works." else "Play your level. Tap Target or Start to go back."
        }
    }

    fun place(type: Char, p: Pos) { board = Rules.set(board, p, type); note = "" }
    fun remove(p: Pos) { board = Rules.set(board, p, '.'); note = "" }

    /** Build phase: dropping on a tile swaps, dropping on an empty slot moves. */
    fun relocate(from: Pos, to: Pos) {
        if (from == to) return
        val moved = board[from.r][from.c]; val there = board[to.r][to.c]
        board = Rules.set(Rules.set(board, to, moved), from, there); note = ""
    }

    fun resize(rows: Int, cols: Int, from: Board = board) { board = Rules.fit(from, rows.coerceIn(1, 5), cols.coerceIn(1, 5)) }

    fun tapPalette(type: Char) { holding = if (holding == type) null else type; note = "" }

    fun pressStart() {
        if (phase != Phase.BUILD) { phase = Phase.BUILD; board = start!!; start = null; target = null; picked = null; note = ""; return }
        val tiles = board.sumOf { row -> row.count { it != '.' } }
        if (tiles < 2) { note = "Place at least two tiles first."; return }
        val canMove = board.indices.any { r -> board[r].indices.any { c -> Rules.legalMoves(board, Pos(r, c)).isNotEmpty() } }
        if (!canMove) { note = "None of these tiles can move. Add tiles they can swap with."; return }
        start = board; phase = Phase.SHAPE; holding = null; note = ""
    }

    fun pressTarget() {
        when (phase) {
            Phase.SHAPE -> {
                if (Rules.key(board) == Rules.key(start!!)) { note = "Move some tiles first: the target must differ from the start."; return }
                target = board; board = start!!; phase = Phase.CHECK; picked = null; note = ""
            }
            Phase.CHECK -> { board = target!!; target = null; phase = Phase.SHAPE; picked = null; note = "" }
            Phase.BUILD -> Unit
        }
    }

    /** Clears a held palette tile or picked board tile. Returns true when something was cleared. */
    fun cancelSelection(): Boolean {
        if (holding == null && picked == null) return false
        holding = null; picked = null; return true
    }
}
