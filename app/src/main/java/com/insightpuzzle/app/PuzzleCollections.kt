package com.insightpuzzle.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.net.URLEncoder

/** One cell size for every miniature in a list, so a 2x2 and a 5x5 target use identical tiles. [area] is the square the mini may fill. */
internal fun miniCell(cols: Int, rows: Int, area: Dp, gap: Dp = MINI_GAP, cap: Dp = 14.dp): Dp =
    minOf(cap, (area - gap * (cols - 1)) / cols, (area - gap * (rows - 1)) / rows).coerceAtLeast(2.dp)

internal val MINI_GAP = 2.dp
private val CARD_PADDING = 6.dp
private val CARD_NUMBER = 14.dp
private val NUMBER_BOTTOM = 2.dp

/** Usable miniature area inside a square card [side] wide. The mini sits in the exact middle, so it keeps clear of a number-sized band at the bottom and the same band at the top. */
internal fun miniArea(side: Dp, fontScale: Float = 1f): Dp = side - (CARD_NUMBER * fontScale + NUMBER_BOTTOM) * 2

/** Square level / puzzle card: miniature in the middle, number at the bottom. A solved card glows; a locked one is dimmed. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun CollectionCard(
    number: String, target: Board, cell: Dp, description: String, modifier: Modifier = Modifier,
    solved: Boolean = false, dimmed: Boolean = false, current: Boolean = false, enabled: Boolean = true,
    onLongClick: () -> Unit, onClick: () -> Unit,
) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier.aspectRatio(1f)
            .then(if (solved) Modifier.drawBehind {
                for ((grow, alpha) in listOf(7.dp to .1f, 4.dp to .16f, 2.dp to .24f)) {
                    val g = grow.toPx()
                    drawRoundRect(p.accent, androidx.compose.ui.geometry.Offset(-g, -g), androidx.compose.ui.geometry.Size(size.width + 2 * g, size.height + 2 * g), androidx.compose.ui.geometry.CornerRadius(12.dp.toPx() + g), alpha = alpha)
                }
            } else Modifier)
            .alpha(if (dimmed) .4f else 1f)
            .clip(shape)
            .background(if (solved) androidx.compose.ui.graphics.lerp(p.paper, p.accent, .14f) else p.paper)
            .border(if (current) 3.dp else 2.dp, if (current || solved) p.accent else p.line, shape)
            .combinedClickable(role = Role.Button, enabled = enabled, onLongClickLabel = "Details", onLongClick = { feedback(Cue.LONG_PRESS); onLongClick() }, onClick = { feedback(Cue.SELECT); onClick() })
            .semantics { contentDescription = description }
            .padding(horizontal = CARD_PADDING),
        contentAlignment = Alignment.Center,
    ) {
        // The mini is centred in the whole card; the number sits low, centred along the bottom edge.
        TargetMini(target, cell, MINI_GAP)
        Label(number, 12.sp, Modifier.align(Alignment.BottomCenter).padding(bottom = NUMBER_BOTTOM), lines = 1)
    }
}

/** Tile size for a four-column puzzle list [width] wide. Server boards are at most 5x5, so every card uses the size that fits 5x5. */
@Composable
internal fun puzzleCell(width: Dp): Dp = miniCell(5, 5, miniArea((width - 12.dp - 8.dp * 3) / 4, LocalDensity.current.fontScale))

/** Up to four community puzzle cards, numbered by list position from [startIndex]; tap plays, long-press (or a hidden puzzle) asks [onDetail]. */
@Composable
internal fun PuzzleRow(m: GameModel, row: List<JSONObject>, cell: Dp, startIndex: Int, source: DiscoveryListState?, onDetail: (JSONObject) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(4) { column ->
            val grid = row.getOrNull(column)
            if (grid == null) Spacer(Modifier.weight(1f)) else {
                val unavailable = grid.optBoolean("hidden") || grid.optBoolean("moderated")
                val solved = grid.optBoolean("completed") || grid.getString("id") in m.communityDone
                val rank = startIndex + column + 1
                CollectionCard(
                    formatted(rank), Rules.crop(grid.board("target")), cell,
                    "Puzzle $rank" + if (unavailable) ", hidden" else if (solved) ", solved" else "",
                    Modifier.weight(1f), solved = solved, dimmed = unavailable, enabled = !m.online.busy,
                    onLongClick = { onDetail(grid) }, onClick = { if (unavailable) onDetail(grid) else playPuzzle(m, grid, source) },
                )
            }
        }
    }
}

/** Four-column grid of community puzzles. Pull down to refresh. */
@Composable
internal fun PuzzleGrid(m: GameModel, state: DiscoveryListState, modifier: Modifier = Modifier, onDetail: (JSONObject) -> Unit) {
    val rows = state.items.chunked(4)
    BoxWithConstraints(modifier) {
        val cell = puzzleCell(maxWidth)
        Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize(), state = state.scroll, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                itemsIndexed(rows, key = { _, row -> row.first().getString("id") }) { index, row -> PuzzleRow(m, row, cell, index * 4, state, onDetail) }
                item { DiscoveryFooter(m, state) }
            }
        }
    }
}

/** Puzzles inline on a profile (its own, or your bookmarks), in the same cards. Not lazy, because the whole profile page scrolls. Loading happens in the caller. */
@Composable
internal fun PuzzleCardList(m: GameModel, state: DiscoveryListState, empty: String?, onDetail: (JSONObject) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cell = puzzleCell(maxWidth)
        Column(Modifier.fillMaxWidth().padding(horizontal = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            state.items.chunked(4).forEachIndexed { index, row -> PuzzleRow(m, row, cell, index * 4, state, onDetail) }
            if (state.items.isEmpty() && !state.loading && !state.failed && state.settled) { if (empty != null) Label(empty, 14.sp, color = LocalPalette.current.muted) }
            else DiscoveryFooter(m, state)
        }
    }
}

@Composable
internal fun PuzzleDetails(m: GameModel, grid: JSONObject, dismiss: () -> Unit) {
    val context = LocalContext.current
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    // One clean row: creator (opens their profile), the code itself, then small Copy and Share buttons. Tap outside or Back closes it.
    Overlay("Puzzle details", dismiss, padding = 12.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button, onClickLabel = "Open profile") { feedback(Cue.CHECK); dismiss(); m.push(Route.Profile(grid.getString("ownerId"))) }
                .padding(horizontal = 8.dp), contentAlignment = Alignment.CenterStart) {
                Label(grid.getString("username"), 15.sp, weight = androidx.compose.ui.text.font.FontWeight.SemiBold, lines = 1)
            }
            Label(grid.getString("code"), 12.sp, Modifier.semantics { contentDescription = "Code " + grid.getString("code") }, color = p.muted, lines = 1)
            SmallIconButton("Copy code", copyIcon) { feedback(Cue.CHECK); (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Insight puzzle code", grid.getString("code"))) }
            SmallIconButton("Share code", shareIcon) { feedback(Cue.CHECK); context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "Play puzzle ${grid.getInt("levelNumber")} by ${grid.getString("username")} in Insight: ${grid.getString("code")}"), "Share puzzle")) }
        }
    }
}

/** A half-height bordered button with line art; the touch target stays 48dp wide. */
@Composable
private fun SmallIconButton(label: String, icon: androidx.compose.ui.graphics.drawscope.DrawScope.(androidx.compose.ui.graphics.Color) -> Unit, onClick: () -> Unit) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(10.dp)
    Box(Modifier.size(48.dp).clickable(role = Role.Button, onClickLabel = label, onClick = onClick).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(36.dp, 28.dp).clip(shape).background(p.paper).border(2.dp, p.line, shape), contentAlignment = Alignment.Center) {
            androidx.compose.foundation.Canvas(Modifier.size(16.dp)) { icon(p.ink) }
        }
    }
}

private val copyIcon: androidx.compose.ui.graphics.drawscope.DrawScope.(androidx.compose.ui.graphics.Color) -> Unit = { c ->
    val u = size.width / 24f; val line = androidx.compose.ui.graphics.drawscope.Stroke(2 * u)
    drawRoundRect(c, androidx.compose.ui.geometry.Offset(8 * u, 8 * u), androidx.compose.ui.geometry.Size(12 * u, 12 * u), androidx.compose.ui.geometry.CornerRadius(2.5f * u), style = line)
    drawRoundRect(c, androidx.compose.ui.geometry.Offset(4 * u, 4 * u), androidx.compose.ui.geometry.Size(12 * u, 12 * u), androidx.compose.ui.geometry.CornerRadius(2.5f * u), style = line)
}
private val shareIcon: androidx.compose.ui.graphics.drawscope.DrawScope.(androidx.compose.ui.graphics.Color) -> Unit = { c ->
    val u = size.width / 24f
    polyline(c, 17f, 6f, 7f, 12f, 17f, 18f)
    for ((x, y) in listOf(17f to 6f, 7f to 12f, 17f to 18f)) drawCircle(c, 2.6f * u, androidx.compose.ui.geometry.Offset(x * u, y * u))
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LevelsScreen(m: GameModel, visible: Boolean = true) {
    var detail by remember { mutableStateOf<Int?>(null) }
    val targets = m.levelTargets
    val rows = remember(m.levels) { m.levels.indices.toList().chunked(4) }
    val largest = remember(targets) { targets.maxOf { it[0].length } to targets.maxOf { it.size } }
    // Hidden under a Journey game it stays composed but invisible, silent to TalkBack and out of focus order.
    val hidden = if (visible) Modifier else Modifier.alpha(0f).clearAndSetSemantics { }
    Box(Modifier.fillMaxSize().then(hidden)) { Page("Levels", 560.dp) {
        CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Ltr) {
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                HomeIconButton("Options", Modifier.align(Alignment.CenterStart), { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                Box(Modifier.align(Alignment.Center).heightIn(min = 48.dp).clickable(role = Role.Button, onClickLabel = "Return to the level") { m.feedback(Cue.CHECK); m.nowPlaying() }
                    .padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    Label("Now Playing", 13.sp, color = LocalPalette.current.muted, weight = androidx.compose.ui.text.font.FontWeight.SemiBold, lines = 1)
                }
                HomeIconButton("Profile", Modifier.align(Alignment.CenterEnd), { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
            }
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            // One tile size for every card, taken from the biggest target, so equal tiles look equal on every level.
            val cell = miniCell(largest.first, largest.second, miniArea((maxWidth - 12.dp - 10.dp * 3) / 4, LocalDensity.current.fontScale))
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(rows, key = { it.first() }) { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        repeat(4) { column ->
                            val i = row.getOrNull(column)
                            if (i == null) Spacer(Modifier.weight(1f)) else {
                                val solved = i + 1 in m.done
                                val locked = !m.canAccess(i)
                                CollectionCard(
                                    "%02d".format(java.util.Locale.ROOT, i + 1), targets[i], cell,
                                    "Level ${i + 1}" + if (locked) ", locked" else if (solved) ", solved" else "",
                                    Modifier.weight(1f), solved = solved, dimmed = locked, current = i == m.level,
                                    onLongClick = { detail = i }, onClick = { if (!locked) m.start(i) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    detail?.let { i -> Overlay("Level details", { detail = null }) {
        Label(m.levelTitle(i), 24.sp, serif = true)
        TargetMini(Rules.crop(m.levels[i].target), 24.dp, 3.dp)
        Label(if (!m.canAccess(i)) "Complete earlier levels to unlock this puzzle." else if (i + 1 in m.done) "Solved" else "Unsolved", 14.sp)
        MenuButton("Play", enabled = m.canAccess(i)) { detail = null; m.start(i) }
        MenuButton("Close") { detail = null }
    } }
    }
}
