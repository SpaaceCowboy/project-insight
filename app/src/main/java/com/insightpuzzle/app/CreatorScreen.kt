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
    data class Resize(val snapshot: Board, val center: Offset, val grab: Offset, val pitch: Float, val gap: Float) : Grab
}

/** Port of src/Creator.jsx: tile strip on top, resizable grid in the middle, one Start → Target → Create button below. Tiles move like they do in the game. */
@Composable
fun CreatorScreen(m: GameModel) {
    val s = m.creator
    val p = LocalPalette.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var shellBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
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
            s.move(a, b); moving = null; m.feedback(null)
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
            if (!reduceMotion) reset.animateTo(1f, tween(REWIND_MS))
            s.reset()
            resetPlan = null; resetting = false; reset.snapTo(0f); glow.animateTo(0f, tween(220))
        }
    }
    val resetLabel = when (s.phase) { Phase.BUILD -> "Clear grid"; Phase.SHAPE -> "Reset to start"; Phase.CHECK -> "Restart puzzle" }

    Box(Modifier.fillMaxSize().onGloballyPositioned { root = it }.semantics {
        customActions = if (s.canReset) listOf(CustomAccessibilityAction(resetLabel) { runReset(); true }) else emptyList()
    }.pointerInput(Unit) {
        val slop = 8.dp.toPx()
        /** A press off the grid, the strip and the handle: held still for [HOLD_MS] it resets the phase. */
        suspend fun AwaitPointerEventScope.hold(down: PointerInputChange) {
            if (!canReset()) return
            if (!reduceMotion) scope.launch { glow.animateTo(1f, tween(HOLD_MS, easing = LinearEasing)) }
            val released = withTimeoutOrNull(HOLD_MS.toLong()) {
                while (true) {
                    val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                    if (!change.pressed || (change.position - down.position).getDistance() > viewConfiguration.touchSlop) break
                }
                true
            }
            if (released != null || !canReset()) { scope.launch { glow.animateTo(0f, tween(180)) }; return }
            runReset()
        }
        awaitEachGesture {
            val down = awaitFirstDown()
            if (resetting) return@awaitEachGesture
            val g = grid
            val corner = g?.let { shellOrigin() + it.topLeft(Pos(it.rows - 1, it.cols - 1)) + Offset(it.cell, it.cell) }
            val grab: Grab = when {
                s.phase == Phase.BUILD && corner != null && (down.position - corner).getDistance() < 26.dp.toPx() ->
                    Grab.Resize(s.board, shellOrigin() + g.topLeft(Pos(0, 0)) + Offset((g.cols * g.cell + (g.cols - 1) * g.gap) / 2, (g.rows * g.cell + (g.rows - 1) * g.gap) / 2), down.position - corner, g.cell + g.gap, g.gap)
                s.phase == Phase.BUILD && paletteBoxes.entries.any { rect(it.value)?.contains(down.position) == true } ->
                    Grab.Palette(paletteBoxes.entries.first { rect(it.value)?.contains(down.position) == true }.key)
                else -> {
                    val at = cellAt(down.position)
                    if (at == null) { if (outsideGrid(down.position)) hold(down); return@awaitEachGesture }
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
                    // Sized from the snapshot, so dragging back out restores cropped tiles.
                    if (rows != s.rows || cols != s.cols) s.resize(rows, cols, grab.snapshot)
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
                is Grab.Palette -> if (!moved) { s.tapPalette(grab.type); m.feedback(Cue.DRAG_START) } else if (target != null) { s.place(grab.type, target); s.holding = null; m.feedback(null) }
                is Grab.Cell -> when {
                    !moved -> tapCell(grab.pos)
                    s.phase != Phase.BUILD -> when {
                        dropped != null -> swap(grab.pos, dropped, offset)
                        legal.isNotEmpty() -> rejectAt(grab.pos)
                        else -> m.feedback(Cue.INVALID_DROP)
                    }
                    target != null -> { s.relocate(grab.pos, target); m.feedback(null) }
                    outsideGrid(last) -> { s.remove(grab.pos); m.feedback(null) }
                }
            }
        }
    }) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            // No instructions: the line only carries a refusal or result ("Place at least two tiles first.", "Puzzle created."). Its height is fixed so the grid never jumps.
            Box(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(28.dp), contentAlignment = Alignment.Center) {
                if (s.note.isNotEmpty()) Label(s.note, 13.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = p.muted, align = TextAlign.Center, lines = 1)
            }
            // Top strip: tiles to place while building, nothing while choosing the target, then the target to reach. Its height never changes.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(96.dp).padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                if (s.phase == Phase.BUILD) {
                    val size = min(56f, (maxWidth.value - 40f) / 6f).dp
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (type in Rules.TYPES) {
                            val on = s.holding == type
                            TileIcon(type, size, Modifier.offset(y = if (on) (-5).dp else 0.dp).onGloballyPositioned { paletteBoxes[type] = it }
                                .semantics { contentDescription = "${Art.NAME[type]} tile"; role = Role.Button; selected = on; onClick { s.tapPalette(type); true } }, glow = if (on) p.ink else null)
                        }
                    }
                } else if (s.phase == Phase.CHECK) {
                    TargetMini(Rules.crop(s.target!!), 16.dp, 3.dp, Modifier.semantics { contentDescription = "Target arrangement" })
                }
            }
            // The shared board height, and the phase button below it grows to fill whatever is left at the bottom.
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            val shellHeight = boardShellHeight(maxHeight - 68.dp)
            val buttonHeight = (maxHeight - shellHeight - 12.dp).coerceIn(56.dp, 120.dp)
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            // The grid: cells are sized for 5x5 so resizing never changes the cell size under the finger.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(shellHeight).clip(RoundedCornerShape(24.dp)).background(Brush.radialGradient(p.shell))
                .border((1 + 2 * glow.value).dp, lerp(p.line, p.shellInk, glow.value), RoundedCornerShape(24.dp)).onGloballyPositioned { shellBox = it }) {
                val gap = with(density) { 5.dp.toPx() }; val pad = with(density) { 48.dp.toPx() }
                val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
                val cell = min(with(density) { 100.dp.toPx() }, min((w - pad - 4 * gap) / 5, (h - pad - 4 * gap) / 5))
                // Centred on the animated size, so the grid glides while it grows or shrinks.
                val sr = shownRows.value; val sc = shownCols.value
                val gw = sc * (cell + gap) - gap; val gh = sr * (cell + gap) - gap
                val g = Grid(s.rows, s.cols, cell, gap, Offset((w - gw) / 2, (h - gh) / 2)).also { grid = it }
                Canvas(Modifier.fillMaxSize()) {
                    if (glow.value > 0f) drawRoundRect(p.shellInk.copy(alpha = .3f * glow.value), cornerRadius = CornerRadius(24.dp.toPx()), style = Stroke(16.dp.toPx()))
                    for (item in inks) ink(item, item.t.value)
                    val mv = moving
                    val late = mutableListOf<() -> Unit>()
                    /** An empty cell: a faint fill inside one unbroken rounded outline. [v] < 1 while it grows in or shrinks out. */
                    fun slot(o: Offset, pos: Pos, v: Float = 1f) {
                        val k = .7f + .3f * v; val size = cell * k; val at = o + Offset((cell - size) / 2, (cell - size) / 2)
                        val fill = if (pos == hover) .24f else .08f
                        drawRoundRect(p.shellInk.copy(alpha = fill * v), at, Size(size, size), CornerRadius(size * .23f))
                        drawRoundRect(p.shellInk.copy(alpha = .32f * v), at, Size(size, size), CornerRadius(size * .23f), style = Stroke(1.5.dp.toPx()))
                    }
                    val reach = resetting && s.phase == Phase.BUILD
                    for (r in 0 until maxOf(s.rows, ceil(sr).toInt())) for (c in 0 until maxOf(s.cols, ceil(sc).toInt())) {
                        val v = min((sr - r).coerceIn(0f, 1f), (sc - c).coerceIn(0f, 1f))
                        if (v <= 0f) continue
                        val pos = Pos(r, c); var o = g.topLeft(pos); var size = cell
                        val inside = r < s.rows && c < s.cols
                        val type = if (inside) s.board[r][c] else before.getOrNull(r)?.getOrNull(c) ?: '.'
                        if (s.phase == Phase.BUILD && (type == '.' || v < 1f || reach || pos == dragFrom)) slot(o, pos, v)
                        if (type == '.') continue
                        if (pos == dragFrom && s.phase == Phase.BUILD) continue
                        if (v < 1f) { size = cell * v; o += Offset((cell - size) / 2, (cell - size) / 2); tile(type, o, size); continue }
                        if (reach) { size = cell * (1f - reset.value); o += Offset((cell - size) / 2, (cell - size) / 2) }
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
                    if (s.phase == Phase.BUILD) {
                        val corner = g.origin + Offset(gw, gh)
                        drawCircle(p.accent.copy(alpha = .25f), 16.dp.toPx(), corner)
                        drawCircle(p.accent, 11.dp.toPx(), corner)
                        val k = 3.6.dp.toPx(); val head = 2.4.dp.toPx(); val sw = 1.6.dp.toPx()
                        drawLine(p.accentInk, corner + Offset(-k, -k), corner + Offset(k, k), sw, StrokeCap.Round)
                        drawLine(p.accentInk, corner + Offset(k, k), corner + Offset(k - head, k), sw, StrokeCap.Round); drawLine(p.accentInk, corner + Offset(k, k), corner + Offset(k, k - head), sw, StrokeCap.Round)
                        drawLine(p.accentInk, corner + Offset(-k, -k), corner + Offset(-k + head, -k), sw, StrokeCap.Round); drawLine(p.accentInk, corner + Offset(-k, -k), corner + Offset(-k, -k + head), sw, StrokeCap.Round)
                    }
                }
                // TalkBack nodes for cells and the resize handle.
                for (r in 0 until s.rows) for (c in 0 until s.cols) {
                    val type = s.board[r][c]; if (type == '.' && s.phase != Phase.BUILD) continue
                    val tl = g.topLeft(Pos(r, c))
                    Box(Modifier.offset { IntOffset(tl.x.roundToInt(), tl.y.roundToInt()) }.size(with(density) { cell.toDp() }).semantics {
                        contentDescription = (if (type == '.') "Empty slot" else Art.NAME.getValue(type)) + ", row ${r + 1}, column ${c + 1}"
                        onClick { tapCell(Pos(r, c)); true }
                        if (s.phase == Phase.BUILD && type != '.') customActions = listOf(CustomAccessibilityAction("Remove tile") { s.remove(Pos(r, c)); true })
                    })
                }
                if (s.phase == Phase.BUILD) {
                    val corner = g.origin + Offset(gw, gh)
                    val half = with(density) { 24.dp.toPx() }
                    Box(Modifier.offset { IntOffset((corner.x - half).roundToInt(), (corner.y - half).roundToInt()) }.size(48.dp).semantics {
                        contentDescription = "Resize grid, currently ${s.cols} by ${s.rows}"
                        customActions = listOf(
                            CustomAccessibilityAction("Add column") { s.resize(s.rows, s.cols + 1); true },
                            CustomAccessibilityAction("Remove column") { s.resize(s.rows, s.cols - 1); true },
                            CustomAccessibilityAction("Add row") { s.resize(s.rows + 1, s.cols); true },
                            CustomAccessibilityAction("Remove row") { s.resize(s.rows - 1, s.cols); true },
                        )
                    })
                }
            }
            // One button walks the phases: Start fixes the start grid, Target fixes the target, Create publishes. Back steps back.
            val publishable = s.proof.isNotEmpty() && !m.dev && !m.online.busy
            when (s.phase) {
                Phase.BUILD -> MenuButton("Start", Modifier.widthIn(max = 560.dp).padding(top = 12.dp), height = buttonHeight, primary = true, fontSize = 17.sp, description = "Start position", cue = Cue.START) { s.pressStart(); s.picked = null }
                Phase.SHAPE -> MenuButton("Target", Modifier.widthIn(max = 560.dp).padding(top = 12.dp), height = buttonHeight, primary = true, fontSize = 17.sp, description = "Target position", cue = Cue.SEEK) { s.pressTarget() }
                Phase.CHECK -> MenuButton("Create", Modifier.widthIn(max = 560.dp).padding(top = 12.dp), height = buttonHeight, primary = true, enabled = publishable, fontSize = 17.sp, description = "Publish level", cue = Cue.UNLOCK) { m.publishCreator() }
            }
            }
            }
        }
        // A tile lifted from the strip or the grid follows the finger at the board's own tile size, above the shell so it is never clipped; it dims once letting go would remove it.
        drag?.let { (type, at) ->
            val g = grid
            if (g != null) Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (removing) .5f else 1f }) { val size = g.cell * 1.045f; tile(type, at - Offset(size / 2, size / 2), size) }
        }
    }
}
