package com.insightpuzzle.app

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RulesTest {
    private fun resource(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    /** Every campaign level must be solved by its verified optimal route from the web game, using only legal moves. */
    @Test
    fun allLevelsSolvedByVerifiedRoutes() {
        val levels = Levels.parse(java.io.File("src/main/assets/levels.json").readText())
        val routes = JSONArray(resource("solutions.json"))
        assertEquals(206, levels.size)
        assertEquals(levels.size, routes.length())
        levels.forEachIndexed { i, level ->
            val width = level.start[0].length
            var board = level.start
            val route = routes.getJSONArray(i)
            for (m in 0 until route.length()) {
                val move = route.getJSONArray(m)
                val a = Pos(move.getInt(0) / width, move.getInt(0) % width)
                val b = Pos(move.getInt(1) / width, move.getInt(1) % width)
                assertTrue("level ${i + 1} move $m is illegal", Rules.isLegal(board, a, b))
                board = Rules.swap(board, a, b)
            }
            assertEquals("level ${i + 1} not solved", Rules.key(level.target), Rules.key(board))
            assertEquals("level ${i + 1} par", level.par, route.length())
        }
    }

    @Test
    fun movesAreSymmetric() {
        // The creator relies on this: any target reached by moves can be solved back.
        val board = listOf("RBG", "YPW", "RBG")
        for (r in 0..2) for (c in 0..2) for (to in Rules.legalMoves(board, Pos(r, c))) {
            val swapped = Rules.swap(board, Pos(r, c), to)
            assertTrue(Rules.isLegal(swapped, to, Pos(r, c)))
        }
    }

    @Test
    fun fitAndBounds() {
        assertEquals(listOf("R.", ".."), Rules.fit(listOf("R"), 2, 2))
        assertEquals(listOf("R"), Rules.fit(listOf("RB", "GY"), 1, 1))
        assertEquals(listOf("B", "Y"), Rules.crop(listOf("..B", "..Y")))
    }
}
