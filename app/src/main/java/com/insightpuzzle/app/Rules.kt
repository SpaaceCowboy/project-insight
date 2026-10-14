package com.insightpuzzle.app

// Port of src/puzzle-rules.js from the web game. A board is a list of rows; '.' is a hole.
typealias Board = List<String>

data class Pos(val r: Int, val c: Int)

object Rules {
    val MOVES: Map<Char, List<Pos>> = mapOf(
        'R' to listOf(Pos(-1, 0), Pos(1, 0)),
        'B' to listOf(Pos(0, -1), Pos(0, 1)),
        'G' to listOf(Pos(-1, 1), Pos(1, -1)),
        'Y' to listOf(Pos(-1, -1), Pos(1, 1)),
        'P' to listOf(Pos(-2, 0), Pos(2, 0), Pos(0, -2), Pos(0, 2)),
        'W' to emptyList(),
    )
    const val TYPES = "RBGYWP"

    fun active(board: Board, p: Pos) =
        p.r in board.indices && p.c in board[p.r].indices && board[p.r][p.c] != '.'

    fun legalMoves(board: Board, p: Pos): List<Pos> {
        if (!active(board, p)) return emptyList()
        return MOVES.getValue(board[p.r][p.c]).map { Pos(p.r + it.r, p.c + it.c) }.filter { active(board, it) }
    }

    fun isLegal(board: Board, a: Pos, b: Pos) = legalMoves(board, a).contains(b)

    fun swap(board: Board, a: Pos, b: Pos): Board {
        val rows = board.map { it.toCharArray() }
        val t = rows[a.r][a.c]; rows[a.r][a.c] = rows[b.r][b.c]; rows[b.r][b.c] = t
        return rows.map { String(it) }
    }

    fun set(board: Board, p: Pos, type: Char): Board =
        board.mapIndexed { r, row -> if (r != p.r) row else row.substring(0, p.c) + type + row.substring(p.c + 1) }

    fun key(board: Board) = board.joinToString("|")

    /** Crop/pad a board to rows x cols, keeping the top-left corner. */
    fun fit(board: Board, rows: Int, cols: Int): Board =
        List(rows) { r -> String(CharArray(cols) { c -> board.getOrNull(r)?.getOrNull(c) ?: '.' }) }

    /** Occupied area: minR, maxR, minC, maxC (maxR < minR when empty). */
    fun bounds(board: Board): IntArray {
        var minR = Int.MAX_VALUE; var maxR = -1; var minC = Int.MAX_VALUE; var maxC = -1
        board.forEachIndexed { r, row -> row.forEachIndexed { c, t -> if (t != '.') { minR = minOf(minR, r); maxR = maxOf(maxR, r); minC = minOf(minC, c); maxC = maxOf(maxC, c) } } }
        return if (maxR < 0) intArrayOf(0, -1, 0, -1) else intArrayOf(minR, maxR, minC, maxC)
    }

    fun crop(board: Board): Board {
        val (minR, maxR, minC, maxC) = bounds(board)
        if (maxR < minR) return emptyList()
        return board.subList(minR, maxR + 1).map { it.substring(minC, maxC + 1) }
    }
}
