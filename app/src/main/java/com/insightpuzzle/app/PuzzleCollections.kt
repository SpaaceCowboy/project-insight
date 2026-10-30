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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.IntOffset
import kotlin.math.roundToInt
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
private val CARD_NUMBER_SIZE = 7.8.sp
private val CARD_NUMBER = 10.5.dp
/** The current Journey level's side wall is plain white (in both themes), so it can be told apart at a glance. */
private val CURRENT_WALL = androidx.compose.ui.graphics.Color.White
private val NUMBER_BOTTOM = 3.dp

/** Usable miniature area inside a square card [side] wide. The mini sits in the exact middle, so it keeps clear of a number-sized band at the bottom and the same band at the top. */
internal fun miniArea(side: Dp, fontScale: Float = 1f): Dp = side - (CARD_NUMBER * fontScale + NUMBER_BOTTOM) * 2

/** Square level / puzzle card: miniature in the middle, number at the bottom. A solved card glows; a locked one is dimmed. Only online cards have a long press. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun CollectionCard(
    number: String, target: Board, cell: Dp, description: String, modifier: Modifier = Modifier,
    solved: Boolean = false, dimmed: Boolean = false, current: Boolean = false, enabled: Boolean = true,
    onLongClick: (() -> Unit)? = null, onClick: () -> Unit,
) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(12.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    // A pedestal with the miniature stamped on its face: it sinks when pressed. A solved card has a tinted face whose side wall keeps the usual darkness
    // (so it is no taller than the others); the current level's side wall is lit.
    val face = if (solved) androidx.compose.ui.graphics.lerp(p.paper2, p.accent, .14f) else p.paper2
    Box(
        modifier.aspectRatio(1f)
            .alpha(if (dimmed) .4f else 1f)
            .plush(shape, pressProgress(source), face, rest = 4.dp, side = if (solved) sideFor(face) else p.side, sideLight = if (current) 1f else 0f, sideLightColor = CURRENT_WALL)
            .then(if (enabled) Modifier.pressOnTouch(source) else Modifier)
            .combinedClickable(interactionSource = source, indication = null, role = Role.Button, enabled = enabled, onLongClickLabel = onLongClick?.let { tr("Details") },
                onLongClick = onLongClick?.let { long -> { feedback(Cue.LONG_PRESS); long() } }, onClick = { feedback(Cue.SELECT); onClick() })
            .semantics { contentDescription = description }
            .padding(horizontal = CARD_PADDING),
        contentAlignment = Alignment.Center,
    ) {
        // The mini is centred in the whole card; the number sits in the bottom right corner.
        TargetMini(target, cell, MINI_GAP)
        Label(number, CARD_NUMBER_SIZE, Modifier.align(Alignment.BottomEnd).padding(bottom = NUMBER_BOTTOM), lines = 1)
    }
}

/** Tile size for a four-column puzzle list [width] wide. Server boards are at most 5x5, so every card uses the size that fits 5x5. */
@Composable
internal fun puzzleCell(width: Dp): Dp = miniCell(5, 5, miniArea(cardSide(width), LocalDensity.current.fontScale))

/** The puzzle whose code menu is open, and where its card is on screen, so the menu can open beside it. [above]: the card is in its page's bottom row. */
internal class DetailAnchor(val grid: JSONObject, val bounds: Rect?, val column: Int, val above: Boolean)

/** Up to four community puzzle cards, numbered by list position from [startIndex]; tap plays, long-press (or a hidden puzzle) asks [onDetail]. */
@Composable
internal fun PuzzleRow(m: GameModel, row: List<JSONObject>, cell: Dp, startIndex: Int, source: DiscoveryListState?, bottomRow: Boolean = false, onDetail: (DetailAnchor) -> Unit) {
    val places = remember { arrayOfNulls<LayoutCoordinates>(CARD_COLUMNS) }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(4) { column ->
            val grid = row.getOrNull(column)
            if (grid == null) Spacer(Modifier.weight(1f)) else {
                val unavailable = grid.optBoolean("hidden") || grid.optBoolean("moderated")
                val solved = grid.optBoolean("completed") || grid.getString("id") in m.communityDone
                val rank = startIndex + column + 1
                // Cropped once per puzzle, not on every recomposition of every card on every kept page.
                val target = remember(grid) { Rules.crop(grid.board("target")) }
                fun detail() = onDetail(DetailAnchor(grid, places[column]?.takeIf { it.isAttached }?.boundsInRoot(), column, bottomRow))
                CollectionCard(
                    formatted(rank), target, cell,
                    tr("Puzzle {0}", rank) + if (unavailable) ", " + tr("hidden") else if (solved) ", " + tr("solved") else "",
                    Modifier.weight(1f).onGloballyPositioned { places[column] = it }, solved = solved, dimmed = unavailable, enabled = !m.online.busy,
                    onLongClick = { detail() }, onClick = { if (unavailable) detail() else playPuzzle(m, grid, source) },
                )
            }
        }
    }
}

/** An empty raised card standing in for a puzzle whose page has not arrived yet, so a swipe never meets a blank page. */
@Composable
private fun SkeletonCard(modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    Box(modifier.aspectRatio(1f).alpha(.5f).plush(RoundedCornerShape(12.dp), 0f, p.paper2, rest = 4.dp))
}

/** Space between the cards of a row. */
internal val CARD_GAP = 8.dp

/** Side of a square card in a four-column list [width] wide (which includes [ShadowRoom] at each side). */
internal fun cardSide(width: Dp): Dp = (width - ShadowRoom * 2 - CARD_GAP * 3) / 4

/** The cards of one page, four to a row, numbered from [first]. */
@Composable
private fun PuzzlePage(m: GameModel, items: List<JSONObject>, first: Int, cell: Dp, source: DiscoveryListState, modifier: Modifier = Modifier, skeletonRows: Int = 0, onDetail: (DetailAnchor) -> Unit) {
    val rows = items.chunked(CARD_COLUMNS)
    Column(modifier.fillMaxWidth().padding(horizontal = ShadowRoom), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEachIndexed { index, row -> PuzzleRow(m, row, cell, first + index * CARD_COLUMNS, source, bottomRow = index > 0 && index == rows.lastIndex, onDetail = onDetail) }
        // The page after the last loaded one: raised blanks until its puzzles arrive.
        if (items.isEmpty()) repeat(skeletonRows) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { repeat(CARD_COLUMNS) { SkeletonCard(Modifier.weight(1f)) } } }
    }
}

/** Height of [rows] rows of cards [side] wide with the gaps between them and the lip under the last one. */
internal fun cardRowsHeight(side: Dp, rows: Int): Dp = side * rows + 10.dp * (rows - 1).coerceAtLeast(0) + 4.dp

/**
 * Community puzzles in pages of [rows] rows of four: swipe sideways for the next page, up and down inside a page that is taller than the screen. Pull down to refresh.
 * [header] sits above the pages inside the pull; [scroll] sees a page's scrolling first (Worlds' hidden search); [minTop] keeps the first row at least that far
 * below the header (the open search bar leaves no spare room, and the players list has the same 8dp there).
 */
@Composable
internal fun PuzzleGrid(m: GameModel, state: DiscoveryListState, modifier: Modifier = Modifier, rows: Int = WORLD_ROWS, empty: String = "No results for these settings.", header: @Composable () -> Unit = {},
                        scroll: androidx.compose.ui.input.nestedscroll.NestedScrollConnection? = null, minTop: Dp = 0.dp, onDetail: (DetailAnchor) -> Unit) {
    BoxWithConstraints(modifier.bleed()) {
        val width = maxWidth
        val cell = puzzleCell(width)
        val side = cardSide(width)
        Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.fillMaxSize()) { Column(Modifier.fillMaxSize()) {
            // The grid bleeds past the page edge by the shadow room; the header (Worlds' search bar) stays on the page edge.
            Box(Modifier.padding(horizontal = ShadowRoom)) { header() }
            PagedItems(state, rows * CARD_COLUMNS, Modifier.weight(1f).fillMaxWidth().then(if (scroll != null) Modifier.nestedScroll(scroll) else Modifier), lookahead = true) { items, first ->
                // The rows sit in the middle of the room the page has, so the space above the first row equals the space below the last one.
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    val free = (maxHeight - cardRowsHeight(side, rows)).coerceAtLeast(0.dp)
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = maxOf(free / 2, minTop), bottom = (8.dp - free / 2).coerceIn(0.dp, 8.dp))) {
                        PuzzlePage(m, items, first, cell, state, skeletonRows = if (state.items.isNotEmpty()) rows else 0, onDetail = onDetail)
                        if (items.isEmpty()) Box(Modifier.padding(horizontal = ShadowRoom)) { DiscoveryFooter(m, state, empty) }
                    }
                }
            }
        } }
    }
}

/** Puzzles inline on a profile (its own): one page of [PROFILE_ROWS] rows of four, swipe sideways for more. The whole profile page scrolls, so the pager has a fixed height. Loading happens in the caller. */
@Composable
internal fun PuzzleCardList(m: GameModel, state: DiscoveryListState, empty: String?, onDetail: (DetailAnchor) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth().bleed()) {
        val cell = puzzleCell(maxWidth)
        // The same height with or without puzzles, so every profile lays out alike.
        // 8dp more than the rows themselves: room under the last row for the raised cards' lip and shadow.
        val height = cardSide(maxWidth) * PROFILE_ROWS + 10.dp * (PROFILE_ROWS - 1) + 8.dp
        if (state.items.isEmpty()) {
            Box(Modifier.fillMaxWidth().height(height)) {
                if (state.settled && !state.loading && !state.failed && empty != null) Label(empty, 14.sp, Modifier.padding(horizontal = 6.dp), color = LocalPalette.current.muted)
            }
        } else {
            PagedItems(state, PROFILE_ROWS * CARD_COLUMNS, Modifier.fillMaxWidth().height(height)) { items, first -> PuzzlePage(m, items, first, cell, state, Modifier.padding(vertical = 4.dp), onDetail = onDetail) }
        }
    }
}

/**
 * Where the code menu's top-left corner goes, in the same coordinates as [anchor] (the card it belongs to). A card in the first column gets the menu on
 * its right, one in the last column on its left (so the menu covers the other three columns of that row); the two middle columns get it below, centred
 * on the card, or above it when [above] (the card is in its page's bottom row). [gapX] and [gapY] are the spaces between cards across and down.
 */
internal fun detailPlacement(anchor: Rect, column: Int, above: Boolean, size: Size, gapX: Float, gapY: Float): Offset = when (column) {
    0 -> Offset(anchor.right + gapX, anchor.top)
    CARD_COLUMNS - 1 -> Offset(anchor.left - gapX - size.width, anchor.top)
    else -> Offset(anchor.center.x - size.width / 2, if (above) anchor.top - gapY - size.height else anchor.bottom + gapY)
}

/**
 * The code menu: a raised card three puzzle buttons wide and one tall, with the creator's name (opens their profile) on the left and Share over Copy on the right.
 * It opens beside the puzzle button it belongs to ([detailPlacement]). Tap outside or Back closes it.
 */
@Composable
internal fun PuzzleDetails(m: GameModel, anchor: DetailAnchor, dismiss: () -> Unit) {
    val grid = anchor.grid
    val context = LocalContext.current
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val density = LocalDensity.current
    androidx.activity.compose.BackHandler { feedback(Cue.BACK); dismiss() }
    var layer by remember { mutableStateOf<LayoutCoordinates?>(null) }
    Box(Modifier.fillMaxSize().onGloballyPositioned { layer = it }) {
        // Everything outside the card closes it; hidden from TalkBack (Back closes it too).
        Box(Modifier.fillMaxSize().clickable(interactionSource = null, indication = null) { feedback(null); dismiss() }.clearAndSetSemantics { })
        val bounds = anchor.bounds
        val area = layer?.takeIf { it.isAttached }?.boundsInRoot()
        if (bounds != null && area != null) {
            val gapX = with(density) { 8.dp.toPx() }; val gapY = with(density) { 10.dp.toPx() }
            val size = Size(bounds.width * 3 + gapX * 2, bounds.height)
            val spot = detailPlacement(bounds, anchor.column, anchor.above, size, gapX, gapY)
            // Kept inside the screen layer, whatever the page scrolled to.
            val x = spot.x.coerceIn(area.left, (area.right - size.width).coerceAtLeast(area.left)) - area.left
            val y = spot.y.coerceIn(area.top, (area.bottom - size.height).coerceAtLeast(area.top)) - area.top
            Row(Modifier.offset { IntOffset(x.roundToInt(), y.roundToInt()) }.size(with(density) { size.width.toDp() }, with(density) { size.height.toDp() })
                .plush(RoundedCornerShape(12.dp), 0f, p.paper2, rest = 8.dp, depth = 6.dp)
                .pointerInput(Unit) { detectTapGestures { } }.semantics { paneTitle = tr("Puzzle details") }.padding(start = 12.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).fillMaxHeight().clickable(role = Role.Button, onClickLabel = tr("Open profile")) { feedback(Cue.CHECK); dismiss(); m.push(Route.Profile(grid.getString("ownerId"))) },
                    contentAlignment = Alignment.CenterStart) {
                    Label(grid.getString("username"), 14.sp, weight = androidx.compose.ui.text.font.FontWeight.SemiBold, lines = 1, translate = false)
                }
                Column(Modifier.fillMaxHeight()) {
                    SmallIconButton("Share code", shareIcon, Modifier.weight(1f)) { feedback(Cue.CHECK); context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, tr("Play puzzle {0} by {1} in Midori: {2}", grid.getInt("levelNumber"), grid.getString("username"), grid.getString("code"))), tr("Share puzzle"))) }
                    SmallIconButton("Copy code", copyIcon, Modifier.weight(1f)) { feedback(Cue.CHECK); (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Midori puzzle code", grid.getString("code"))) }
                }
            }
        }
    }
}

/** A small raised key with line art. Two of them share the menu's height, so each is about 36dp tall to touch. */
@Composable
private fun SmallIconButton(label: String, icon: androidx.compose.ui.graphics.drawscope.DrawScope.(androidx.compose.ui.graphics.Color) -> Unit, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(10.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    Box(modifier.width(44.dp).pressOnTouch(source).clickable(source, null, role = Role.Button, onClickLabel = tr(label), onClick = onClick).semantics { contentDescription = tr(label) }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(36.dp, 26.dp).plush(shape, pressProgress(source), p.paper2, rest = 3.dp, depth = 2.dp), contentAlignment = Alignment.Center) {
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

@Composable
fun LevelsScreen(m: GameModel) {
    val targets = m.levelTargets
    val largest = remember(targets) { targets.maxOf { it[0].length } to targets.maxOf { it.size } }
    val pageSize = JOURNEY_ROWS * CARD_COLUMNS
    var page by remember { mutableIntStateOf(m.level / pageSize) }
    val indices = remember(m.levels) { m.levels.indices.toList() }
    Page("Levels", 560.dp) {
        CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Ltr) {
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                HomeIconButton("Options", Modifier.align(Alignment.CenterStart), { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                BackChevron(m, Modifier.align(Alignment.Center))
                HomeIconButton("Profile", Modifier.align(Alignment.CenterEnd), { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
            }
        }
        Spacer(Modifier.height(ScreenGap))
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().bleed()) {
            // Eight rows of four fit without scrolling: the card side comes from the width (the same cards as Worlds, edge to edge with the keys above),
            // or from the height when that is smaller.
            val gap = 10.dp
            val side = minOf(cardSide(maxWidth), (maxHeight - 16.dp - gap * (JOURNEY_ROWS - 1)) / JOURNEY_ROWS)
            // One tile size for every card, taken from the biggest target, so equal tiles look equal on every level.
            val cell = miniCell(largest.first, largest.second, miniArea(side, LocalDensity.current.fontScale))
            Paged(indices, pageSize, page, { page = it }, Modifier.fillMaxSize()) { levels, _ ->
                Column(Modifier.fillMaxSize().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap)) {
                    for (row in levels.chunked(CARD_COLUMNS)) Row(horizontalArrangement = Arrangement.spacedBy(CARD_GAP)) {
                        for (i in row) {
                            val solved = i + 1 in m.done
                            val locked = !m.canAccess(i)
                            CollectionCard(
                                formatted(i + 1), targets[i], cell,
                                tr("Level {0}", i + 1) + if (locked) ", " + tr("locked") else if (solved) ", " + tr("solved") else "",
                                Modifier.size(side), solved = solved, dimmed = locked, current = i == m.level,
                                onClick = { if (!locked) m.start(i) },
                            )
                        }
                    }
                }
            }
        }
    }
}
