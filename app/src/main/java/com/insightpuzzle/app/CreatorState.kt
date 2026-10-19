package com.insightpuzzle.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject

enum class Phase { BUILD, SHAPE, CHECK }

/**
 * Port of src/useCreator.js. Build the start grid (S), move tiles to shape the target (T), then test the level.
 * Every move is reversible, so a target reached by moves is always solvable.
 * Kept in the view model so the work survives leaving and reopening the Create screen.
 */
class CreatorState(saved: String? = null, private val persist: (String) -> Unit = {}) {
    var phase by mutableStateOf(Phase.BUILD); private set
    var board by mutableStateOf(Rules.fit(emptyList(), 3, 3)); private set
    var start by mutableStateOf<Board?>(null); private set
    var target by mutableStateOf<Board?>(null); private set
    var holding by mutableStateOf<Char?>(null)
    var picked by mutableStateOf<Pos?>(null)
    var note by mutableStateOf("")
    private val checkPath = mutableListOf<Pair<Int, Int>>()
    val proof get() = checkPath.toList()

    init {
        if (saved != null) {
            try {
                val json = JSONObject(saved)
                fun rows(key: String): Board? = json.optJSONArray(key)?.let { a -> List(a.length()) { a.getString(it) } }
                phase = Phase.valueOf(json.getString("phase")); board = rows("board")!!
                start = rows("start"); target = rows("target")
                require(board.size in 1..5 && board.all { it.length == board[0].length && it.length in 1..5 && it.all { c -> c in Rules.TYPES || c == '.' } })
                require(phase == Phase.BUILD || start != null)
                require(phase != Phase.CHECK || target != null)
                val path = json.optJSONArray("path") ?: JSONArray()
                for (i in 0 until path.length()) path.getJSONArray(i).let { checkPath += it.getInt(0) to it.getInt(1) }
            } catch (error: Exception) {
                android.util.Log.e("InsightCreator", "draft_restore_failed type=${error.javaClass.simpleName}")
                phase = Phase.BUILD; board = Rules.fit(emptyList(), 3, 3); start = null; target = null; checkPath.clear()
                note = "Your saved draft could not be restored. Please start a new grid."
            }
        }
    }
    private fun save() {
        persist(JSONObject().put("phase", phase.name).put("board", JSONArray(board)).put("start", start?.let { JSONArray(it) })
            .put("target", target?.let { JSONArray(it) }).put("path", JSONArray(checkPath.map { listOf(it.first, it.second) })).toString())
    }
    fun move(from: Pos, to: Pos) {
        if (phase == Phase.BUILD || solved || !Rules.isLegal(board, from, to)) return
        val width = cols
        board = Rules.swap(board, from, to)
        if (phase == Phase.CHECK) checkPath += (from.r * width + from.c) to (to.r * width + to.c)
        picked = null; note = ""; save()
    }

    val rows get() = board.size
    val cols get() = board[0].length
    val solved get() = phase == Phase.CHECK && Rules.key(board) == Rules.key(target!!)

    val hint get() = note.ifEmpty {
        when (phase) {
            Phase.BUILD -> holding?.let { "Tap the grid to place ${Art.NAME[it]}. Tap the tile again to stop." } ?: "Drag tiles onto the grid, then tap Start. Drag a tile off the grid to remove it."
            Phase.SHAPE -> "Move tiles to shape your target, then tap Target."
            Phase.CHECK -> if (solved) "Target reached. Your level works. Tap Make to publish." else "Play your level. Tap Target or Start to go back."
        }
    }

    fun place(type: Char, p: Pos) { board = Rules.set(board, p, type); note = ""; checkPath.clear(); save() }
    fun remove(p: Pos) { board = Rules.set(board, p, '.'); note = ""; checkPath.clear(); save() }

    /** Build phase: dropping on a tile swaps, dropping on an empty slot moves. */
    fun relocate(from: Pos, to: Pos) {
        if (from == to) return
        val moved = board[from.r][from.c]; val there = board[to.r][to.c]
        board = Rules.set(Rules.set(board, to, moved), from, there); note = ""; checkPath.clear(); save()
    }

    fun resize(rows: Int, cols: Int, from: Board = board) { board = Rules.fit(from, rows.coerceIn(1, 5), cols.coerceIn(1, 5)); checkPath.clear(); save() }

    fun tapPalette(type: Char) { holding = if (holding == type) null else type; note = "" }

    fun pressStart() {
        if (phase != Phase.BUILD) { phase = Phase.BUILD; board = start!!; start = null; target = null; picked = null; note = ""; checkPath.clear(); save(); return }
        val tiles = board.sumOf { row -> row.count { it != '.' } }
        if (tiles < 2) { note = "Place at least two tiles first."; return }
        val canMove = board.indices.any { r -> board[r].indices.any { c -> Rules.legalMoves(board, Pos(r, c)).isNotEmpty() } }
        if (!canMove) { note = "None of these tiles can move. Add tiles they can swap with."; return }
        start = board; phase = Phase.SHAPE; holding = null; note = ""; checkPath.clear(); save()
    }

    fun pressTarget() {
        when (phase) {
            Phase.SHAPE -> {
                if (Rules.key(board) == Rules.key(start!!)) { note = "Move some tiles first: the target must differ from the start."; return }
                target = board; board = start!!; phase = Phase.CHECK; picked = null; note = ""; checkPath.clear(); save()
            }
            Phase.CHECK -> { board = target!!; target = null; phase = Phase.SHAPE; picked = null; note = ""; checkPath.clear(); save() }
            Phase.BUILD -> Unit
        }
    }

    /** Clears a held palette tile or picked board tile. Returns true when something was cleared. */
    fun cancelSelection(): Boolean {
        if (holding == null && picked == null) return false
        holding = null; picked = null; return true
    }
}
