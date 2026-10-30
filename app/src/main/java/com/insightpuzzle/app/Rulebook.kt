package com.insightpuzzle.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** What each tile does, in the order the sandbox shows them. Mirrors [Rules.MOVES]. "{0}" is the tile's colour name ([Art.name]: the standard name in the colour-blind palette). */
private val RULES = listOf(
    'R' to "{0} slides one cell up or down.",
    'B' to "{0} slides one cell left or right.",
    'G' to "{0} steps diagonally, up-right or down-left.",
    'Y' to "{0} steps diagonally, up-left or down-right.",
    'P' to "{0} jumps two cells up, down, left or right.",
    'W' to "{0} never moves itself; other tiles can only swap places with it.",
)

/** Options → Rulebook: six rules on top, a free 3x3 board below. Nothing here is saved or scored. */
@Composable
fun ColumnScope.RulebookTab(m: GameModel) {
    val board = m.rulebookBoard
    BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
    val rulesHeight = maxHeight / 2
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // The rules take only the room they need, with open lines, so the board below gets the rest and stays a true square.
        // Keep room for the board at enlarged text sizes; the rules scroll when they need more.
        // A hair of inset from the page edge, which the tabs above and the board below both reach.
        Column(Modifier.fillMaxWidth().heightIn(max = rulesHeight).verticalScroll(rememberScrollState()).padding(start = 3.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for ((type, template) in RULES) {
                // The tile's name is written in that tile's own colour, wherever the sentence puts it.
                val name = Art.name(type)!!
                val text = tr(template, name)
                val at = text.indexOf(name).coerceAtLeast(0)
                val styled = buildAnnotatedString {
                    append(text.substring(0, at))
                    withStyle(SpanStyle(color = Art.LIGHT.getValue(type), fontWeight = FontWeight.SemiBold)) { append(name) }
                    append(text.substring((at + name.length).coerceAtMost(text.length)))
                }
                Label(styled, 13.sp, Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = text }, lineHeight = 1.4f)
            }
        }
        // The board sits at the bottom of the screen; any spare height goes between it and the rules, not under it. Like the game's outline it spans the
        // page from edge to edge, in line with the tabs above.
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
            val height = minOf(maxWidth, maxHeight, boardShellHeight())
            Board(Modifier.fillMaxWidth().height(height), board, "rulebook", null, false, { m.rulebookBoard }) { a, b -> m.rulebookBoard = Rules.swap(m.rulebookBoard, a, b) }
        }
    }
    }
}
