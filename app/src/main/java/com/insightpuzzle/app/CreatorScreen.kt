package com.insightpuzzle.app

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.em
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private sealed interface Grab {
    data class Palette(val type: Char) : Grab
    data class Cell(val pos: Pos, val type: Char) : Grab
    data class Resize(val center: Offset, val grab: Offset, val pitch: Float, val gap: Float) : Grab
}

/** What the grid looked like in the last frame drawn: where a change of phase morphs from. */
private class DrawnGrid { var phase: Phase? = null; var board: Board = emptyList(); var cell = 0f; var origin = Offset.Zero }

/**
 * The start of a morph between phases. [cell] and [origin] are the old layout, with [origin] placed for the new board's (0, 0) cell, so the same tiles
 * simply move and scale to their new places; [board] (the old grid, whose cell (r, c) is now ([r] - [shiftR], [c] - [shiftC])) lets its empty slots fade out.
 */
private class MorphFrom(val cell: Float, val origin: Offset, val board: Board, val shiftR: Int, val shiftC: Int, val fromBuild: Boolean)

/** Cell size for the start and target phases: the game's own (88dp, 120dp on wide screens) so the grid looks as it does when played. */
internal fun creatorGameCell(width: Float, height: Float, rows: Int, cols: Int, gap: Float, pad: Float, cap: Float): Float =
    min(cap, min((width - pad - (cols - 1) * gap) / cols, (height - pad - (rows - 1) * gap) / rows))

/** How long the grid takes to move between its building layout and its game-sized one. */
private const val MORPH_MS = 260

/* Port of src/Creator.jsx: tile strip on top, resizable grid in the middle, one Start → Target → Create button below. Tiles move like they do in the game. */
/** Tile size for the target shown in phase three: 16dp, smaller when [rows] rows with 3dp gaps would not fit in [height]. */
internal fun creatorTargetCell(rows: Int, height: Dp): Dp = minOf(16.dp, (height - 3.dp * (rows - 1).coerceAtLeast(0)) / rows.coerceAtLeast(1))

@Composable
fun CreatorScreen(m: GameModel) {
    val s = m.creator
    val p = LocalPalette.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var shellBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    // The outline's rectangle as state, so the tips lamp follows it; the tile strip and the phase button are only measured for the tips' borders.
    var shellRect by remember { mutableStateOf<Rect?>(null) }
    var stripBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var buttonBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    DisposableEffect(Unit) { m.endGuide(); onDispose { m.endGuide() } }
    val paletteBoxes = remember { mutableMapOf<Char, LayoutCoordinates>() }
    var drag by remember { mutableStateOf<Pair<Char, Offset>?>(null) }
    var dragFrom by remember { mutableStateOf<Pos?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var hover by remember { mutableStateOf<Pos?>(null) }
    var grid by remember { mutableStateOf<Grid?>(null) }
    val inks = remember { mutableStateListOf<Ink>() }
    var moving by remember { mutableStateOf<Triple<Pos, Pos, Offset>?>(null) }
    val slide = remember { Animatable(0f) }
    var rejected by remember { mutableStateOf<Pos?>(null) }
    val reject = remember { Animatable(0f) }
    var arrived by remember { mutableStateOf(emptyList<Pos>()) }
    val arrive = remember { Animatable(0f) }
    val bloom = remember { Animatable(0f) }
    LaunchedEffect(s.solved) { if (s.solved) bloom.animateTo(1f, tween(900, easing = LinearEasing)) else bloom.snapTo(0f) }
    val reduceMotion by rememberUpdatedState(LocalReduceMotion.current)
    // Creator mode's quiet background loop, for as long as the creator is on screen.
    DisposableEffect(Unit) { m.audio.startProcessing(); onDispose { m.audio.stopProcessing() } }
    // Hold outside the grid: the outline glows, then the phase resets (build clears, target and check slide back to the start).
    val glow = remember { Animatable(0f) }
    val reset = remember { Animatable(0f) }
    var resetting by remember { mutableStateOf(false) }
    var resetPlan by remember { mutableStateOf<Map<Pos, Pos>?>(null) }
    // The drawn size follows rows x cols smoothly, so cells grow in and shrink out instead of popping.
    val shownRows = remember { Animatable(s.rows.toFloat()) }
    val shownCols = remember { Animatable(s.cols.toFloat()) }
    LaunchedEffect(s.rows) { if (reduceMotion) shownRows.snapTo(s.rows.toFloat()) else shownRows.animateTo(s.rows.toFloat(), tween(170, easing = FastOutSlowInEasing)) }
    LaunchedEffect(s.cols) { if (reduceMotion) shownCols.snapTo(s.cols.toFloat()) else shownCols.animateTo(s.cols.toFloat(), tween(170, easing = FastOutSlowInEasing)) }
    // The board that was showing before the latest size change, so tiles cropped by a shrink can fade out with their cells.
    var shownBoard by remember { mutableStateOf(s.board) }
    val before = remember(s.rows, s.cols) { shownBoard }
    SideEffect { shownBoard = s.board }
    // Start and target phases show the grid at the game's size and centred on the cropped board. A change of phase moves the very same tiles from one
    // layout to the other (cell size and position), instead of redrawing the grid cell by cell, so nothing flashes or pops while it settles.
    val drawn = remember { DrawnGrid() }
    val morph = remember(s.phase) { Animatable(if (drawn.phase == null || drawn.phase == s.phase || reduceMotion) 1f else 0f) }
    val morphFrom = remember(s.phase) {
        val old = drawn.phase
        if (old == null || old == s.phase) null else {
            val gapPx = with(density) { 5.dp.toPx() }
            // Building → start: the empty outer rows and columns were cropped away, so the old grid's top-left tile cell is the new (0, 0) plus this shift.
            val (minR, _, minC, _) = if (old == Phase.BUILD && s.phase == Phase.SHAPE) Rules.bounds(drawn.board) else intArrayOf(0, 0, 0, 0)
            MorphFrom(drawn.cell, drawn.origin + Offset(minC * (drawn.cell + gapPx), minR * (drawn.cell + gapPx)), drawn.board, minR, minC, old == Phase.BUILD)
        }
    }
    LaunchedEffect(morph) { if (morph.value < 1f) morph.animateTo(1f, tween(MORPH_MS, easing = FastOutSlowInEasing)) }

    fun rect(c: LayoutCoordinates?): Rect? = c?.takeIf { it.isAttached }?.let { root?.localBoundingBoxOf(it) }
    fun shellOrigin() = rect(shellBox)?.topLeft ?: Offset.Zero
    fun cellAt(x: Offset): Pos? = grid?.hit(x - shellOrigin())
    /** A tile let go anywhere off the grid (the gap between cells does not count) is taken off it. */
    fun outsideGrid(x: Offset): Boolean {
        val g = grid ?: return false
        return g.isOutside(x - shellOrigin(), g.gap)
    }
    fun rejectAt(at: Pos) {
        rejected = at; m.feedback(Cue.INVALID_DROP)
        scope.launch { reject.snapTo(0f); reject.animateTo(1f, tween(240)); rejected = null }
    }
    fun swap(a: Pos, b: Pos, from: Offset = Offset.Zero) {
        val g = grid ?: return
        if (s.solved || moving != null) return
        val type = s.board[a.r][a.c]
        s.picked = null; moving = Triple(a, b, from)
        scope.launch {
            slide.snapTo(0f); slide.animateTo(1f, tween(185))
            val before = s.board
            s.move(a, b); moving = null; m.feedback(Cue.DROP)
            val ink = Ink(g.center(a), g.center(b), Art.LIGHT.getValue(type), Animatable(0f))
            inks += ink; if (inks.size > 3) inks.removeAt(0)
            launch { ink.t.animateTo(1f, tween(1200, easing = LinearEasing)); inks.remove(ink) }
            val after = s.board; val target = s.target
            if (s.solved) m.audio.play(Cue.SUCCESS)
            arrived = if (target == null) emptyList() else listOf(a, b).filter { after[it.r][it.c] == target[it.r][it.c] && before[it.r][it.c] != after[it.r][it.c] }
            if (arrived.isNotEmpty()) launch { arrive.snapTo(0f); arrive.animateTo(1f, tween(420)); arrived = emptyList() }
        }
    }
    fun choose(at: Pos) {
        if (moving != null || s.solved) return
        val picked = s.picked
        if (picked != null && Rules.isLegal(s.board, picked, at)) { swap(picked, at); return }
        if (picked != null && picked != at && Rules.legalMoves(s.board, picked).isNotEmpty()) {
            if (Rules.legalMoves(s.board, at).isNotEmpty()) { s.picked = at; m.feedback(Cue.DRAG_START); return }
            rejectAt(picked); return
        }
        if (picked == null && Rules.legalMoves(s.board, at).isEmpty()) { rejectAt(at); return }
        s.picked = if (picked == at) null else at
        m.feedback(Cue.DRAG_START)
    }
    fun tapCell(at: Pos) {
        if (s.phase != Phase.BUILD) { if (s.board[at.r][at.c] != '.') choose(at); return }
        s.holding?.let { s.place(it, at); m.feedback(Cue.DRAG_START) }
    }

    val removing = dragFrom != null && drag?.let { outsideGrid(it.second) } == true
    fun canReset() = s.canReset && !resetting && moving == null
    fun runReset() {
        if (!canReset()) return
        scope.launch {
            resetting = true
            m.feedback(Cue.REORDER)
            resetPlan = s.start?.takeIf { s.phase != Phase.BUILD }?.let { rewindMoves(s.board, it) }
            reset.snapTo(0f)
            // Clearing a grid being built takes the tiles away at once; the later phases slide them back to where they started.
            if (!reduceMotion && s.phase != Phase.BUILD) reset.animateTo(1f, tween(REWIND_MS))
            s.reset()
            resetPlan = null; resetting = false; reset.snapTo(0f); glow.animateTo(0f, tween(220))
        }
    }
    /**
     * Target: the shaped board slides back to the start grid, tile by tile, as the target is fixed and the last phase opens. It is the restart's movement
     * without its press or lit wall ([glow] stays at rest). A refusal ("Move some tiles first") just shows its note.
     */
    fun runTarget() {
        if (resetting || moving != null) return
        if (!s.canPressTarget()) { s.pressTarget(); return }
        scope.launch {
            resetting = true
            resetPlan = rewindMoves(s.board, s.start!!)
            reset.snapTo(0f)
            if (!reduceMotion) reset.animateTo(1f, tween(REWIND_MS))
            s.pressTarget()
            resetPlan = null; resetting = false; reset.snapTo(0f)
        }
    }
    val resetLabel = when (s.phase) { Phase.BUILD -> "Clear grid"; Phase.SHAPE -> "Reset to start"; Phase.CHECK -> "Restart puzzle" }

    Box(Modifier.fillMaxSize().onGloballyPositioned { root = it }.semantics {
        customActions = if (s.canReset) listOf(CustomAccessibilityAction(tr(resetLabel)) { runReset(); true }) else emptyList()
    }.pointerInput(Unit) {
        val slop = 8.dp.toPx()
        val swipe = 80.dp.toPx()
        /**
         * A press off the grid, the strip and the handle. Inside the outline ([holdable]) and held still for [HOLD_MS] it resets the phase.
         * Anywhere off the grid, a swipe left to right goes back one phase (Target → Start → building); there is no forward swipe.
         */
        suspend fun AwaitPointerEventScope.offGrid(down: PointerInputChange, holdable: Boolean) {
            var still = holdable && canReset()
            val back = s.phase != Phase.BUILD
            if (!still && !back) return
            if (still && !reduceMotion) scope.launch { glow.animateTo(1f, tween(HOLD_MS, easing = LinearEasing)) }
            var held = false; var swiped = false
            while (true) {
                val left = HOLD_MS - (android.os.SystemClock.uptimeMillis() - down.uptimeMillis)
                val event = if (still) withTimeoutOrNull(left.coerceAtLeast(1)) { awaitPointerEvent() } else awaitPointerEvent()
                if (event == null) { held = true; break }
                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                val d = change.position - down.position
                if (back && d.x > swipe && d.x > 2 * kotlin.math.abs(d.y)) { swiped = true; break }
                if (!change.pressed) break
                if (still && d.getDistance() > viewConfiguration.touchSlop) { still = false; scope.launch { glow.animateTo(0f, tween(180)) } }
                if (!still && !back) break
            }
            if (swiped) {
                if (glow.value > 0f) scope.launch { glow.snapTo(0f) }
                s.picked = null
                m.feedback(if (s.stepBack()) Cue.BACK else Cue.INVALID_DROP)
                return
            }
            if (!held || !canReset()) { scope.launch { glow.animateTo(0f, tween(180)) }; return }
            runReset()
        }
        awaitEachGesture {
            val down = awaitFirstDown()
            if (resetting) return@awaitEachGesture
            val g = grid
            val corner = g?.let { shellOrigin() + it.topLeft(Pos(it.rows - 1, it.cols - 1)) + Offset(it.cell, it.cell) }
            val grab: Grab = when {
                s.phase == Phase.BUILD && corner != null && (down.position - corner).getDistance() < 26.dp.toPx() ->
                    Grab.Resize(shellOrigin() + g.topLeft(Pos(0, 0)) + Offset((g.cols * g.cell + (g.cols - 1) * g.gap) / 2, (g.rows * g.cell + (g.rows - 1) * g.gap) / 2), down.position - corner, g.cell + g.gap, g.gap)
                s.phase == Phase.BUILD && paletteBoxes.entries.any { rect(it.value)?.contains(down.position) == true } ->
                    Grab.Palette(paletteBoxes.entries.first { rect(it.value)?.contains(down.position) == true }.key)
                else -> {
                    val at = cellAt(down.position)
                    if (at == null) { if (outsideGrid(down.position)) offGrid(down, rect(shellBox)?.contains(down.position) == true); return@awaitEachGesture }
                    Grab.Cell(at, s.board[at.r][at.c])
                }
            }
            if (moving != null && grab !is Grab.Resize) return@awaitEachGesture
            down.consume()
            if (grab is Grab.Resize) m.feedback(Cue.PRESS)
            val legal = if (grab is Grab.Cell && s.phase != Phase.BUILD) Rules.legalMoves(s.board, grab.pos) else emptyList()
            var moved = false; var last = down.position
            while (true) {
                val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                last = change.position
                if (grab is Grab.Resize) {
                    val cols = ((2 * (last.x - grab.grab.x - grab.center.x) + grab.gap) / grab.pitch).roundToInt().coerceIn(1, 5)
                    val rows = ((2 * (last.y - grab.grab.y - grab.center.y) + grab.gap) / grab.pitch).roundToInt().coerceIn(1, 5)
                    // Tiles outside the smaller grid are only hidden (the state remembers them), so dragging back out, now or later, brings them back.
                    if (rows != s.rows || cols != s.cols) s.resize(rows, cols)
                } else {
                    val type = when (grab) { is Grab.Palette -> grab.type; is Grab.Cell -> grab.type; else -> '.' }
                    if (!moved && type != '.' && (last - down.position).getDistance() >= slop && !(grab is Grab.Cell && s.solved)) {
                        moved = true; m.feedback(Cue.DRAG_START)
                        if (grab is Grab.Cell) dragFrom = grab.pos
                        if (s.phase != Phase.BUILD) s.picked = null
                    }
                    if (moved) {
                        if (grab is Grab.Palette || s.phase == Phase.BUILD) drag = type to last else dragOffset = last - down.position
                        val at = cellAt(last)?.takeIf { it != (grab as? Grab.Cell)?.pos }
                        // Swapping (after Start) uses the game's rule: the tile itself must be over the cell it swaps with.
                        hover = if (s.phase == Phase.BUILD) at else if (grab is Grab.Cell) grid?.let { dropTarget(it, grab.pos, last - down.position, legal) } else null
                    }
                }
                change.consume()
                if (!change.pressed) break
            }
            val target = cellAt(last); val offset = dragOffset
            val dropped = (grab as? Grab.Cell)?.let { g -> grid?.let { dropTarget(it, g.pos, last - down.position, legal) } }
            drag = null; dragFrom = null; hover = null; dragOffset = Offset.Zero
            when (grab) {
                is Grab.Resize -> Unit
                is Grab.Palette -> if (!moved) { s.tapPalette(grab.type); m.feedback(Cue.DRAG_START) } else if (target != null) { s.place(grab.type, target); s.holding = null; m.feedback(Cue.DROP) }
                is Grab.Cell -> when {
                    !moved -> tapCell(grab.pos)
                    s.phase != Phase.BUILD -> when {
                        dropped != null -> swap(grab.pos, dropped, offset)
                        legal.isNotEmpty() -> rejectAt(grab.pos)
                        else -> m.feedback(Cue.INVALID_DROP)
                    }
                    target != null -> { s.relocate(grab.pos, target); m.feedback(Cue.DROP) }
                    outsideGrid(last) -> { s.remove(grab.pos); m.feedback(null) }
                }
            }
        }
    }) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) { BackChevron(m) }
            // No instructions: the line only carries a refusal or result ("Place at least two tiles first.", "Puzzle created."). Its height is fixed so the grid never jumps.
            Box(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(28.dp), contentAlignment = Alignment.Center) {
                if (s.phase == Phase.CHECK && s.limitReached) Label(tr("Daily limit of {0} puzzles reached.", CREATE_DAILY_LIMIT), 13.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = p.accent, align = TextAlign.Center, lines = 1, translate = false)
                else if (s.note.isNotEmpty()) Label(s.note, 13.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = p.muted, align = TextAlign.Center, lines = 1)
            }
            // Top strip: tiles to place while building, nothing while choosing the target, then the target to reach. Its height never changes.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(96.dp).onGloballyPositioned { stripBox = it }.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                if (s.phase == Phase.BUILD) {
                    val size = min(56f, (maxWidth.value - 40f) / 6f).dp
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (type in Rules.TYPES) {
                            val on = s.holding == type
                            TileIcon(type, size, Modifier.offset(y = if (on) (-5).dp else 0.dp).onGloballyPositioned { paletteBoxes[type] = it }
                                .semantics { contentDescription = tr("{0} tile", Art.name(type)); role = Role.Button; selected = on; onClick { s.tapPalette(type); true } }, glow = if (on) p.ink else null)
                        }
                    }
                } else if (s.phase == Phase.CHECK) {
                    val target = Rules.crop(s.target!!)
                    // The strip is 80dp tall inside its padding: tall targets (five rows) shrink their tiles to stay inside it.
                    TargetMini(target, creatorTargetCell(target.size, 80.dp), 3.dp, Modifier.semantics { contentDescription = tr("Target arrangement") })
                }
            }
            // The shared board height, and the phase button below it grows to fill whatever is left at the bottom.
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            val shellHeight = boardShellHeight(maxHeight - 68.dp)
            val buttonHeight = (maxHeight - shellHeight - 12.dp).coerceIn(56.dp, 120.dp)
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            // The grid: while building, cells are sized for 5x5 so resizing never changes the cell size under the finger; the start and target phases use the game's size.
            // A raised platform like the game's board: holding to reset pushes it half way down while its side wall lights up.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(shellHeight).onGloballyPositioned { shellBox = it; shellRect = root?.takeIf { r -> r.isAttached }?.localBoundingBoxOf(it) }
                .plush(RoundedCornerShape(24.dp), glow.value, p.paper2, rest = 6.dp, depth = BOARD_WALL, sheen = false, travel = .5f, sideLight = glow.value)) {
                val gap = with(density) { 5.dp.toPx() }; val pad = with(density) { 48.dp.toPx() }
                val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
                val build = s.phase == Phase.BUILD
                val buildCell = min(with(density) { 100.dp.toPx() }, min((w - pad - 4 * gap) / 5, (h - pad - 4 * gap) / 5))
                val gameCell = creatorGameCell(w, h, s.rows, s.cols, gap, with(density) { 32.dp.toPx() }, with(density) { (if (LocalConfiguration.current.screenWidthDp >= 600) 120.dp else 88.dp).toPx() })
                // Building: centred on the animated size, so the grid glides while it grows or shrinks. Start / target: the cropped board centred at the game's size.
                val sr = shownRows.value; val sc = shownCols.value
                val toCell = if (build) buildCell else gameCell
                val gw = (if (build) sc else s.cols.toFloat()) * (toCell + gap) - gap; val gh = (if (build) sr else s.rows.toFloat()) * (toCell + gap) - gap
                val toOrigin = Offset((w - gw) / 2, (h - gh) / 2)
                // A change of phase morphs from the old layout to this one.
                val t = morph.value
                val cell = morphFrom?.let { androidx.compose.ui.util.lerp(it.cell, toCell, t) } ?: toCell
                val origin = morphFrom?.let { androidx.compose.ui.geometry.lerp(it.origin, toOrigin, t) } ?: toOrigin
                val shownW = if (morphFrom == null) gw else (if (build) sc else s.cols.toFloat()) * (cell + gap) - gap
                val shownH = if (morphFrom == null) gh else (if (build) sr else s.rows.toFloat()) * (cell + gap) - gap
                val g = Grid(s.rows, s.cols, cell, gap, origin).also { grid = it }
                SideEffect { drawn.phase = s.phase; drawn.board = s.board; drawn.cell = cell; drawn.origin = origin }
                Canvas(Modifier.fillMaxSize()) {
                    for (item in inks) ink(item, item.t.value)
                    val mv = moving
                    val late = mutableListOf<() -> Unit>()
                    /**
                     * An empty cell as a raised key on the platform (no border): a soft shadow, a darker side showing under the face, then the face with a faint sheen.
                     * [v] < 1 while it grows in or shrinks out; [fade] fades it in or out with a change of phase.
                     */
                    fun slot(o: Offset, pos: Pos?, v: Float = 1f, fade: Float = 1f) {
                        val k = .7f + .3f * v; val size = cell * k; val at = o + Offset((cell - size) / 2, (cell - size) / 2)
                        val a = v * fade
                        if (a <= 0f) return
                        val radius = CornerRadius(size * .23f); val depth = size * .06f
                        // A little darker than the platform it sits on so it stands out from it, with a side that is darker still but not near-black.
                        val face = if (p.dark) lerp(p.paper2, Color.Black, .22f) else lerp(p.paper2, Color.Black, .07f)
                        val wall = lerp(face, Color.Black, if (p.dark) .18f else .12f)
                        drawRoundRect(Color.Black.copy(alpha = (if (p.dark) .3f else .12f) * a), at + Offset(0f, depth + size * .04f), Size(size, size), radius)
                        drawRoundRect(wall.copy(alpha = a), at + Offset(0f, depth), Size(size, size), radius)
                        drawRoundRect(face.copy(alpha = a), at, Size(size, size), radius)
                        drawRoundRect(Brush.verticalGradient(0f to Color.White.copy(alpha = (if (p.dark) .035f else .35f) * a), .5f to Color.Transparent, startY = at.y, endY = at.y + size), at, Size(size, size), radius)
                        if (pos != null && pos == hover) drawRoundRect(Color.White.copy(alpha = .12f * a), at, Size(size, size), radius)
                    }
                    // Changing from building to the start phase: the old grid's slots fade out under the tiles that move to their new places.
                    if (morphFrom != null && morphFrom.fromBuild && !build && t < 1f) {
                        val pitch = cell + gap
                        for (r in morphFrom.board.indices) for (c in morphFrom.board[r].indices)
                            slot(origin + Offset((c - morphFrom.shiftC) * pitch, (r - morphFrom.shiftR) * pitch), null, 1f, 1f - t)
                    }
                    // The other way (back to building, or a new puzzle after Create), the slots fade in.
                    val slotFade = if (morphFrom != null && build) t else 1f
                    val settling = !build
                    for (r in 0 until (if (settling) s.rows else maxOf(s.rows, ceil(sr).toInt()))) for (c in 0 until (if (settling) s.cols else maxOf(s.cols, ceil(sc).toInt()))) {
                        val v = if (settling) 1f else min((sr - r).coerceIn(0f, 1f), (sc - c).coerceIn(0f, 1f))
                        if (v <= 0f) continue
                        val pos = Pos(r, c); var o = g.topLeft(pos); var size = cell
                        val inside = r < s.rows && c < s.cols
                        val type = if (inside) s.board[r][c] else before.getOrNull(r)?.getOrNull(c) ?: '.'
                        if (build && (type == '.' || v < 1f || pos == dragFrom)) slot(o, pos, v, slotFade)
                        if (type == '.') continue
                        if (pos == dragFrom && s.phase == Phase.BUILD) continue
                        if (v < 1f) { size = cell * v; o += Offset((cell - size) / 2, (cell - size) / 2); tile(type, o, size); continue }
                        resetPlan?.get(pos)?.let { dest -> o += (g.topLeft(dest) - o) * reset.value }
                        var glow: Color? = null; var ring: Color? = null
                        if (mv != null && (pos == mv.first || pos == mv.second)) {
                            val d = g.topLeft(mv.second) - g.topLeft(mv.first)
                            o += if (pos == mv.first) mv.third + (d - mv.third) * slide.value else -d * slide.value
                        }
                        if (pos == s.picked) { o -= Offset(cell * .0175f, cell * .0175f + 5.dp.toPx()); size *= 1.035f; glow = p.shellInk }
                        if (pos == dragFrom) { o += dragOffset - Offset(cell * .0225f, cell * .0225f); size *= 1.045f }
                        if (pos == rejected) ring = Color(0xFFFFB4A8).copy(alpha = sin(reject.value * Math.PI).toFloat() * .85f)
                        if (pos in arrived) ring = Color(0xFFF5FFEA).copy(alpha = sin(arrive.value * Math.PI).toFloat() * .65f)
                        if (s.solved) {
                            // Solved bloom: each tile swells in turn, ordered by r + c, as in the game.
                            val t = ((bloom.value * 900f - (r + c) * 16f) / 650f).coerceIn(0f, 1f)
                            val k = 1f + .035f * sin(t * Math.PI).toFloat()
                            o -= Offset(cell * (k - 1) / 2, cell * (k - 1) / 2); size *= k
                            glow = Art.LIGHT.getValue(type).copy(alpha = .5f)
                        }
                        val highlight = if (pos == hover) .1f else 0f
                        val draw = { tile(type, o, size, glow, ring, highlight) }
                        if (pos == s.picked || pos == dragFrom || (mv != null && pos == mv.first)) late += draw else draw()
                    }
                    late.forEach { it() }
                    if (build) {
                        val corner = g.origin + Offset(shownW, shownH)
                        drawCircle(p.accent.copy(alpha = .25f), 16.dp.toPx(), corner)
                        drawCircle(p.accent, 11.dp.toPx(), corner)
                    }
                }
                // TalkBack nodes for cells and the resize handle.
                for (r in 0 until s.rows) for (c in 0 until s.cols) {
                    val type = s.board[r][c]; if (type == '.' && s.phase != Phase.BUILD) continue
                    val tl = g.topLeft(Pos(r, c))
                    Box(Modifier.offset { IntOffset(tl.x.roundToInt(), tl.y.roundToInt()) }.size(with(density) { cell.toDp() }).semantics {
                        contentDescription = tr("{0}, row {1}, column {2}", if (type == '.') tr("Empty slot") else Art.name(type), r + 1, c + 1)
                        onClick { tapCell(Pos(r, c)); true }
                        if (s.phase == Phase.BUILD && type != '.') customActions = listOf(CustomAccessibilityAction(tr("Remove tile")) { s.remove(Pos(r, c)); true })
                    })
                }
                if (build) {
                    val corner = g.origin + Offset(shownW, shownH)
                    val half = with(density) { 24.dp.toPx() }
                    Box(Modifier.offset { IntOffset((corner.x - half).roundToInt(), (corner.y - half).roundToInt()) }.size(48.dp).semantics {
                        contentDescription = tr("Resize grid, currently {0} by {1}", s.cols, s.rows)
                        customActions = listOf(
                            CustomAccessibilityAction(tr("Add column")) { s.resize(s.rows, s.cols + 1); true },
                            CustomAccessibilityAction(tr("Remove column")) { s.resize(s.rows, s.cols - 1); true },
                            CustomAccessibilityAction(tr("Add row")) { s.resize(s.rows + 1, s.cols); true },
                            CustomAccessibilityAction(tr("Remove row")) { s.resize(s.rows - 1, s.cols); true },
                        )
                    })
                }
            }
            // One button walks the phases: Start fixes the start grid, Target fixes the target, Create publishes. Back steps back.
            val publishable = s.proof.isNotEmpty() && !m.dev && !m.online.busy
            when (s.phase) {
                Phase.BUILD -> MenuButton("Start", Modifier.widthIn(max = 560.dp).padding(top = 12.dp).onGloballyPositioned { buttonBox = it }, height = buttonHeight, primary = true, fontSize = 17.sp, description = "Start position", cue = Cue.START) { s.pressStart(); s.picked = null }
                Phase.SHAPE -> MenuButton("Target", Modifier.widthIn(max = 560.dp).padding(top = 12.dp).onGloballyPositioned { buttonBox = it }, height = buttonHeight, primary = true, fontSize = 17.sp, description = "Target position", cue = Cue.SEEK) { runTarget() }
                Phase.CHECK -> MenuButton("Create", Modifier.widthIn(max = 560.dp).padding(top = 12.dp).onGloballyPositioned { buttonBox = it }, height = buttonHeight, primary = true, enabled = publishable, fontSize = 17.sp, description = "Publish level", cue = Cue.UNLOCK) { m.publishCreator() }
            }
            }
            }
        }
        // A tile lifted from the strip or the grid follows the finger at the board's own tile size, above the shell so it is never clipped; it dims once letting go would remove it.
        drag?.let { (type, at) ->
            val g = grid
            if (g != null) Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (removing) .5f else 1f }) { val size = g.cell * 1.045f; tile(type, at - Offset(size / 2, size / 2), size) }
        }
        // The gameplay tips: the lamp etched into the outline's top right, and the tip for the phase the creator is in.
        shellRect?.let { shell ->
            if (m.guideOn) GuideButton(Modifier.offset { guideLampOffset(shell) }) { m.tapGuide() }
            if (m.guidePhase != 0) CreatorGuide(s.phase, shell, rect(stripBox), rect(buttonBox)) { m.endGuide() }
        }
    }
}
