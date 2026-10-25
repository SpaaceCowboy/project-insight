package com.insightpuzzle.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** What each tile does, in the order the sandbox shows them. Mirrors [Rules.MOVES]. */
private val RULES = listOf(
    'R' to "Red slides one cell up or down.",
    'B' to "Blue slides one cell left or right.",
    'G' to "Green steps diagonally, up-right or down-left.",
    'Y' to "Yellow steps diagonally, up-left or down-right.",
    'P' to "Purple jumps two cells up, down, left or right.",
    'W' to "White never moves itself; other tiles can only swap places with it.",
)

/** Options → Rulebook: six rules on top, a free 3x3 board below. Nothing here is saved or scored. */
@Composable
fun ColumnScope.RulebookTab(m: GameModel) {
    val board = m.rulebookBoard
    Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.SpaceEvenly) {
            for ((type, text) in RULES) {
                Row(Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = "${Art.NAME[type]}: $text" }, verticalAlignment = Alignment.CenterVertically) {
                    TileIcon(type, 30.dp)
                    Label(text, 13.sp, Modifier.padding(start = 12.dp))
                }
            }
        }
        Board(Modifier.weight(1f, fill = false).fillMaxWidth().height(boardShellHeight()), board, "rulebook", null, false, { m.rulebookBoard }) { a, b -> m.rulebookBoard = Rules.swap(m.rulebookBoard, a, b) }
    }
}
