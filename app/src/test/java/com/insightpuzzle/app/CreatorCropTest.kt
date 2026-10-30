package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class CreatorCropTest {
    @Test fun startDropsEmptyOuterRowsAndColumns() {
        val s = CreatorState()
        s.resize(5, 5)
        // Tiles only in the middle 2x2 of a 5x5 grid; R and B can swap, so the start is valid.
        s.place('R', Pos(1, 1)); s.place('B', Pos(1, 2)); s.place('B', Pos(2, 1)); s.place('R', Pos(2, 2))
        s.pressStart()
        assertEquals(Phase.SHAPE, s.phase)
        assertEquals(listOf("RB", "BR"), s.start)
        assertEquals(2, s.rows); assertEquals(2, s.cols)
    }

    @Test fun shrinkingHidesTilesAndGrowingBringsThemBack() {
        val s = CreatorState()
        s.resize(5, 5)
        s.place('B', Pos(0, 0)); s.place('R', Pos(4, 4))
        s.resize(3, 3)
        assertEquals(listOf("B..", "...", "..."), s.board)
        // A later drag out again: the hidden tile is where it was.
        s.resize(5, 5)
        assertEquals('R', s.board[4][4]); assertEquals('B', s.board[0][0])
    }

    @Test fun memorySurvivesARestoredDraftAndIsClearedByReset() {
        var saved: String? = null
        val s = CreatorState(null) { saved = it }
        s.resize(5, 5); s.place('R', Pos(3, 3)); s.resize(2, 2)
        val restored = CreatorState(saved)
        assertEquals(2, restored.rows)
        restored.resize(5, 5)
        assertEquals('R', restored.board[3][3])
        // Holding to restart empties everything, hidden tiles included.
        restored.resize(2, 2); restored.reset(); restored.resize(5, 5)
        assertTrue(restored.board.all { row -> row.all { it == '.' } })
    }

    @Test fun removingATileForgetsIt() {
        val s = CreatorState()
        s.resize(4, 4); s.place('R', Pos(3, 3)); s.remove(Pos(3, 3)); s.resize(2, 2); s.resize(4, 4)
        assertEquals('.', s.board[3][3])
    }

    @Test fun innerHolesStay() {
        val s = CreatorState()
        s.resize(4, 4)
        // R and B side by side can swap; the empty middle row is inside the used area, so it stays.
        s.place('R', Pos(0, 1)); s.place('B', Pos(0, 2)); s.place('B', Pos(2, 1))
        s.pressStart()
        assertEquals(listOf("RB", "..", "B."), s.start)
    }
}
