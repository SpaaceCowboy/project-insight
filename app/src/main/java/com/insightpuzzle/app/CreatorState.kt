package com.insightpuzzle.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject

enum class Phase { BUILD, SHAPE, CHECK }

/** The creator's biggest grid, and an empty board of that size. */
private const val MAX = 5
private val EMPTY_STASH: Board = List(MAX) { ".".repeat(MAX) }

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
    /** The server refused the last publish: today's puzzle limit is used up. Shown at the top of the last phase until the player leaves it or publishes again. */
    var limitReached by mutableStateOf(false)
    var creationId = java.util.UUID.randomUUID().toString(); private set
    var previousTarget: Board? = null; private set
    /**
     * Every tile placed while building, at its cell of the biggest grid (5x5), including those outside the visible rows x cols: shrinking the grid only
     * hides tiles and growing it brings them back, in the same drag or a later one. Only dragging a tile off the grid, Clear (hold to restart),
     * or creating the puzzle empties it.
     */
    private var stash: Board = EMPTY_STASH
    private val constructionPath = mutableListOf<Pair<Int, Int>>()
    private val checkPath = mutableListOf<Pair<Int, Int>>()
    val proof get() = constructionPath.toList()

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
                // Older drafts have no stash: the visible tiles are all there is. The visible grid always wins over a stale stash.
                stash = merged(rows("stash")?.takeIf { s -> s.size == MAX && s.all { it.length == MAX } } ?: EMPTY_STASH, board)
                val path = json.optJSONArray("path") ?: JSONArray()
                for (i in 0 until path.length()) path.getJSONArray(i).let { checkPath += it.getInt(0) to it.getInt(1) }
                creationId = json.optString("creationId", creationId)
                previousTarget = rows("previousTarget")
                val construction = json.optJSONArray("construction")
                if (construction != null) for (i in 0 until construction.length()) construction.getJSONArray(i).let { constructionPath += it.getInt(0) to it.getInt(1) }
                else if (phase == Phase.CHECK && solved && checkPath.isNotEmpty()) constructionPath.addAll(checkPath)
                else if (phase != Phase.BUILD) {
                    previousTarget = target ?: board; board = start!!; target = null; phase = Phase.SHAPE
                    note = tr("Your draft is kept. Move tiles to choose the target again.")
                }
            } catch (error: Exception) {
                android.util.Log.e("InsightCreator", "draft_restore_failed type=${error.javaClass.simpleName}")
                phase = Phase.BUILD; board = Rules.fit(emptyList(), 3, 3); start = null; target = null; checkPath.clear(); constructionPath.clear()
                note = tr("Your saved draft could not be restored. Please start a new grid.")
                stash = EMPTY_STASH
            }
        }
    }

    /** [top] laid over [base] (both anchored at the top-left): [top]'s cells win, the rest of [base] shows through. */
    private fun merged(base: Board, top: Board): Board =
        List(MAX) { r -> String(CharArray(MAX) { c -> top.getOrNull(r)?.getOrNull(c) ?: base.getOrNull(r)?.getOrNull(c) ?: '.' }) }

    /** Makes [next] the visible grid and remembers its tiles. */
    private fun show(next: Board) { board = next; stash = merged(stash, next) }

    private fun save() {
        persist(JSONObject().put("phase", phase.name).put("board", JSONArray(board)).put("stash", JSONArray(stash)).put("start", start?.let { JSONArray(it) })
            .put("target", target?.let { JSONArray(it) }).put("path", JSONArray(checkPath.map { listOf(it.first, it.second) }))
            .put("construction", constructionPath.jsonMoves()).put("creationId", creationId).put("previousTarget", previousTarget?.let { JSONArray(it) }).toString())
    }
    fun move(from: Pos, to: Pos) {
        if (phase == Phase.BUILD || !Rules.isLegal(board, from, to)) return
        val width = cols
        board = Rules.swap(board, from, to)
        if (phase == Phase.CHECK) checkPath += (from.r * width + from.c) to (to.r * width + to.c)
        if (phase == Phase.SHAPE) constructionPath += (from.r * width + from.c) to (to.r * width + to.c)
        picked = null; note = ""; save()
    }

    val rows get() = board.size
    val cols get() = board[0].length
    val solved get() = phase == Phase.CHECK && Rules.key(board) == Rules.key(target!!)

    /** Hold-to-reset is possible: a tile to clear while building (even one hidden outside a shrunk grid), otherwise a board that has left the start. */
    val canReset get() = if (phase == Phase.BUILD) stash.any { row -> row.any { it != '.' } } || board.any { row -> row.any { it != '.' } } else board != start

    /** Build: empty every cell, hidden ones too, keeping the size. Target / check: back to the start grid, forgetting the moves. */
    fun reset() {
        when (phase) {
            Phase.BUILD -> { stash = EMPTY_STASH; board = Rules.fit(emptyList(), rows, cols); constructionPath.clear() }
            Phase.SHAPE -> { board = start!!; constructionPath.clear() }
            Phase.CHECK -> board = start!!
        }
        checkPath.clear(); picked = null; holding = null; note = ""; save()
    }

    /** System Back inside the creator: check → target phase → build. False once already building. */
    fun stepBack(): Boolean = when (phase) {
        Phase.CHECK -> { pressTarget(); true }
        Phase.SHAPE -> { pressStart(); true }
        Phase.BUILD -> false
    }

    fun place(type: Char, p: Pos) { show(Rules.set(board, p, type)); note = ""; checkPath.clear(); constructionPath.clear(); save() }
    fun remove(p: Pos) { show(Rules.set(board, p, '.')); note = ""; checkPath.clear(); constructionPath.clear(); save() }

    /** Build phase: dropping on a tile swaps, dropping on an empty slot moves. */
    fun relocate(from: Pos, to: Pos) {
        if (from == to) return
        val moved = board[from.r][from.c]; val there = board[to.r][to.c]
        show(Rules.set(Rules.set(board, to, moved), from, there)); note = ""; checkPath.clear(); constructionPath.clear(); save()
    }

    /** Shows the top-left [rows] x [cols] of everything placed, so tiles hidden by an earlier shrink come back. */
    fun resize(rows: Int, cols: Int) {
        val r = rows.coerceIn(1, MAX); val c = cols.coerceIn(1, MAX)
        if (r == this.rows && c == this.cols) return
        board = Rules.fit(stash, r, c); checkPath.clear(); constructionPath.clear(); save()
    }

    fun tapPalette(type: Char) { holding = if (holding == type) null else type; note = "" }

    fun pressStart() {
        if (phase != Phase.BUILD) { phase = Phase.BUILD; board = start!!; stash = merged(EMPTY_STASH, board); previousTarget = target; start = null; target = null; picked = null; note = ""; limitReached = false; checkPath.clear(); constructionPath.clear(); save(); return }
        val tiles = board.sumOf { row -> row.count { it != '.' } }
        if (tiles < 2) { note = tr("Place at least two tiles first."); return }
        val canMove = board.indices.any { r -> board[r].indices.any { c -> Rules.legalMoves(board, Pos(r, c)).isNotEmpty() } }
        if (!canMove) { note = tr("None of these tiles can move. Add tiles they can swap with."); return }
        // Empty outer rows and columns are dropped, so the puzzle is only as big as the tiles it uses.
        board = Rules.crop(board); start = board; phase = Phase.SHAPE; holding = null; note = ""; checkPath.clear(); constructionPath.clear(); save()
    }

    /** The move after which the shaped board first equals the board now showing, or -1 when no construction move reaches it. */
    private fun firstArrival(): Int {
        var replay = start!!
        val width = cols
        return constructionPath.indexOfFirst { (a, b) ->
            replay = Rules.swap(replay, Pos(a / width, a % width), Pos(b / width, b % width))
            replay == board
        }
    }

    /** True when Target will be accepted now, so the screen can slide the tiles back to the start before it changes phase. */
    fun canPressTarget() = phase == Phase.SHAPE && Rules.key(board) != Rules.key(start!!) && firstArrival() >= 0

    fun pressTarget() {
        when (phase) {
            Phase.SHAPE -> {
                if (Rules.key(board) == Rules.key(start!!)) { note = tr("Move some tiles first: the target must differ from the start."); return }
                val chosen = board
                val firstArrival = firstArrival()
                if (firstArrival < 0) { note = tr("Move tiles to choose your target again."); return }
                while (constructionPath.size > firstArrival + 1) constructionPath.removeAt(constructionPath.lastIndex)
                target = chosen; board = start!!; phase = Phase.CHECK; picked = null; note = ""; checkPath.clear()
                creationId = java.util.UUID.randomUUID().toString(); save()
            }
            Phase.CHECK -> { board = target!!; target = null; phase = Phase.SHAPE; picked = null; note = ""; limitReached = false; checkPath.clear(); save() }
            Phase.BUILD -> Unit
        }
    }

    fun created() {
        phase = Phase.BUILD; board = Rules.fit(emptyList(), 3, 3); stash = EMPTY_STASH; start = null; target = null; previousTarget = null
        holding = null; picked = null; checkPath.clear(); constructionPath.clear()
        creationId = java.util.UUID.randomUUID().toString(); note = tr("Puzzle created."); limitReached = false; save()
    }

    /** Clears a held palette tile or picked board tile. Returns true when something was cleared. */
    fun cancelSelection(): Boolean {
        if (holding == null && picked == null) return false
        holding = null; picked = null; return true
    }
}
