package com.insightpuzzle.app

import androidx.compose.animation.core.Animatable
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
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
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
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private sealed interface Grab {
    data class Palette(val type: Char) : Grab
    data class Cell(val pos: Pos, val type: Char) : Grab
    data class Resize(val snapshot: Board, val center: Offset, val grab: Offset, val pitch: Float, val gap: Float) : Grab
}

/** Port of src/Creator.jsx: tile strip on top, resizable grid in the middle, S / T / M steps below. Tiles move like they do in the game. */
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

    fun rect(c: LayoutCoordinates?): Rect? = c?.takeIf { it.isAttached }?.let { root?.localBoundingBoxOf(it) }
    fun shellOrigin() = rect(shellBox)?.topLeft ?: Offset.Zero
    fun cellAt(x: Offset): Pos? = grid?.hit(x - shellOrigin())
    /** A tile let go anywhere off the grid (the gap between cells does not count) is taken off it. */
    fun outsideGrid(x: Offset): Boolean {
        val g = grid ?: return false
        return g.isOutside(x - shellOrigin(), g.gap)
    }
    fun rejectAt(at: Pos) {
        rejected = at; m.audio.play("deny")
        scope.launch { reject.snapTo(0f); reject.animateTo(1f, tween(240)); rejected = null }
    }
    fun swap(a: Pos, b: Pos, from: Offset = Offset.Zero) {
        val g = grid ?: return
        if (s.solved || moving != null) return
        val type = s.board[a.r][a.c]
        s.picked = null; moving = Triple(a, b, from); m.audio.play("move", type)
        scope.launch {
            slide.snapTo(0f); slide.animateTo(1f, tween(185))
            val before = s.board
            s.move(a, b); moving = null
            val ink = Ink(g.center(a), g.center(b), Art.LIGHT.getValue(type), Animatable(0f))
            inks += ink; if (inks.size > 3) inks.removeAt(0)
            launch { ink.t.animateTo(1f, tween(1200, easing = LinearEasing)); inks.remove(ink) }
            val after = s.board; val target = s.target
            if (s.solved) m.audio.play("win")
            arrived = if (target == null) emptyList() else listOf(a, b).filter { after[it.r][it.c] == target[it.r][it.c] && before[it.r][it.c] != after[it.r][it.c] }
            if (arrived.isNotEmpty()) launch { arrive.snapTo(0f); arrive.animateTo(1f, tween(420)); arrived = emptyList() }
        }
    }
    fun choose(at: Pos) {
        if (moving != null || s.solved) return
        val picked = s.picked
        if (picked != null && Rules.isLegal(s.board, picked, at)) { swap(picked, at); return }
        if (picked != null && picked != at && Rules.legalMoves(s.board, picked).isNotEmpty()) {
            if (Rules.legalMoves(s.board, at).isNotEmpty()) { s.picked = at; m.audio.play("select", s.board[at.r][at.c]); return }
            rejectAt(picked); return
        }
        if (picked == null && Rules.legalMoves(s.board, at).isEmpty()) { rejectAt(at); return }
        s.picked = if (picked == at) null else at
        m.audio.play("select", s.board[at.r][at.c])
    }
    fun tapCell(at: Pos) {
        if (s.phase != Phase.BUILD) { if (s.board[at.r][at.c] != '.') choose(at); return }
        s.holding?.let { s.place(it, at); m.audio.play("select", it) }
    }

    val removing = dragFrom != null && drag?.let { outsideGrid(it.second) } == true
    val hint = if (removing) "Release to remove this tile." else s.hint

    Box(Modifier.fillMaxSize().onGloballyPositioned { root = it }.pointerInput(Unit) {
        val slop = 8.dp.toPx()
        awaitEachGesture {
            val down = awaitFirstDown()
            val g = grid
            val corner = g?.let { shellOrigin() + it.topLeft(Pos(it.rows - 1, it.cols - 1)) + Offset(it.cell, it.cell) }
            val grab: Grab = when {
                s.phase == Phase.BUILD && corner != null && (down.position - corner).getDistance() < 26.dp.toPx() ->
                    Grab.Resize(s.board, shellOrigin() + g.topLeft(Pos(0, 0)) + Offset((g.cols * g.cell + (g.cols - 1) * g.gap) / 2, (g.rows * g.cell + (g.rows - 1) * g.gap) / 2), down.position - corner, g.cell + g.gap, g.gap)
                s.phase == Phase.BUILD && paletteBoxes.entries.any { rect(it.value)?.contains(down.position) == true } ->
                    Grab.Palette(paletteBoxes.entries.first { rect(it.value)?.contains(down.position) == true }.key)
                else -> {
                    val at = cellAt(down.position) ?: return@awaitEachGesture
                    Grab.Cell(at, s.board[at.r][at.c])
                }
            }
            if (moving != null && grab !is Grab.Resize) return@awaitEachGesture
            down.consume()
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
                        moved = true; m.audio.play("select", type)
                        if (grab is Grab.Cell) dragFrom = grab.pos
                        if (s.phase != Phase.BUILD) s.picked = null
                    }
                    if (moved) {
                        if (grab is Grab.Palette || s.phase == Phase.BUILD) drag = type to last else dragOffset = last - down.position
                        val at = cellAt(last)?.takeIf { it != (grab as? Grab.Cell)?.pos }
                        hover = if (s.phase == Phase.BUILD || (grab is Grab.Cell && at != null && Rules.isLegal(s.board, grab.pos, at))) at else null
                    }
                }
                change.consume()
                if (!change.pressed) break
            }
            val target = cellAt(last); val offset = dragOffset
            drag = null; dragFrom = null; hover = null; dragOffset = Offset.Zero
            when (grab) {
                is Grab.Resize -> Unit
                is Grab.Palette -> if (!moved) { s.tapPalette(grab.type); m.audio.play("select", grab.type) } else if (target != null) { s.place(grab.type, target); s.holding = null; m.audio.play("select", grab.type) }
                is Grab.Cell -> when {
                    !moved -> tapCell(grab.pos)
                    s.phase != Phase.BUILD -> when {
                        target != null && legal.contains(target) -> swap(grab.pos, target, offset)
                        legal.isNotEmpty() -> rejectAt(grab.pos)
                        else -> m.audio.play("deny")
                    }
                    target != null -> { s.relocate(grab.pos, target); m.audio.play("select", grab.type) }
                    outsideGrid(last) -> { s.remove(grab.pos); m.audio.play("deny") }
                }
            }
        }
    }) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Label(hint, 13.sp, Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite }, color = p.muted, align = TextAlign.Center)
            // Top strip: tiles to place while building, then the Start or Target preview. Its height never changes, so the grid never jumps.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(96.dp).padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                if (s.phase == Phase.BUILD) {
                    val size = min(56f, (maxWidth.value - 40f) / 6f).dp
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (type in Rules.TYPES) {
                            val on = s.holding == type
                            TileIcon(type, size, m.finish, Modifier.offset(y = if (on) (-5).dp else 0.dp).onGloballyPositioned { paletteBoxes[type] = it }
                                .semantics { contentDescription = "${Art.NAME[type]} tile"; role = Role.Button; selected = on; onClick { s.tapPalette(type); true } }, glow = if (on) p.ink else null)
                        }
                    }
                } else {
                    val label = if (s.phase == Phase.SHAPE) "Start" else "Target"
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        TargetMini(Rules.crop(if (s.phase == Phase.SHAPE) s.start!! else s.target!!), 13.dp, 3.dp, Modifier.semantics { contentDescription = "$label arrangement" })
                    }
                }
            }
            // The grid: cells are sized for 5x5 so resizing never changes the cell size under the finger.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().weight(1f).clip(RoundedCornerShape(24.dp)).background(Brush.radialGradient(p.shell))
                .border(1.dp, p.line, RoundedCornerShape(24.dp)).onGloballyPositioned { shellBox = it }) {
                val gap = with(density) { 5.dp.toPx() }; val pad = with(density) { 48.dp.toPx() }
                val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
                val cell = min(with(density) { 100.dp.toPx() }, min((w - pad - 4 * gap) / 5, (h - pad - 4 * gap) / 5))
                val gw = s.cols * cell + (s.cols - 1) * gap; val gh = s.rows * cell + (s.rows - 1) * gap
                val g = Grid(s.rows, s.cols, cell, gap, Offset((w - gw) / 2, (h - gh) / 2)).also { grid = it }
                Canvas(Modifier.fillMaxSize()) {
                    for (item in inks) ink(item, item.t.value)
                    val mv = moving
                    val late = mutableListOf<() -> Unit>()
                    fun slot(o: Offset, pos: Pos) {
                        val fill = if (pos == hover) .24f else .08f
                        drawRoundRect(p.shellInk.copy(alpha = fill), o, Size(cell, cell), CornerRadius(cell * .23f))
                        drawRoundRect(p.shellInk.copy(alpha = .4f), o, Size(cell, cell), CornerRadius(cell * .23f), style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f, 4f))))
                    }
                    for (r in 0 until s.rows) for (c in 0 until s.cols) {
                        val pos = Pos(r, c); val type = s.board[r][c]; var o = g.topLeft(pos); var size = cell
                        if (type == '.') {
                            if (s.phase == Phase.BUILD) slot(o, pos)
                            continue
                        }
                        if (pos == dragFrom && s.phase == Phase.BUILD) { slot(o, pos); continue }
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
                        val draw = { tile(type, o, size, m.finish, glow, ring, highlight) }
                        if (pos == s.picked || pos == dragFrom || (mv != null && pos == mv.first)) late += draw else draw()
                    }
                    late.forEach { it() }
                    if (s.phase == Phase.BUILD) {
                        val corner = g.topLeft(Pos(s.rows - 1, s.cols - 1)) + Offset(cell, cell)
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
                    val corner = g.topLeft(Pos(s.rows - 1, s.cols - 1)) + Offset(cell, cell)
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
            Row(Modifier.widthIn(max = 360.dp).fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Step("Start", "Start position", if (s.phase == Phase.BUILD) StepState.ON else StepState.DONE, Modifier.weight(1f)) { s.pressStart(); s.picked = null }
                Step("Target", "Target position", when (s.phase) { Phase.BUILD -> StepState.LOCKED; Phase.SHAPE -> StepState.ON; Phase.CHECK -> StepState.DONE }, Modifier.weight(1f)) { s.pressTarget() }
                Step("Make", "Publish level", if (s.solved && !m.dev) StepState.ON else StepState.LOCKED, Modifier.weight(1f),
                    onClick = if (s.solved && !m.dev) ({ m.openOnline(Route.Publish) }) else null)
            }
        }
        // A tile lifted from the strip or the grid follows the finger at the board's own tile size, above the shell so it is never clipped; it dims once letting go would remove it.
        drag?.let { (type, at) ->
            val g = grid
            if (g != null) Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (removing) .5f else 1f }) { val size = g.cell * 1.045f; tile(type, at - Offset(size / 2, size / 2), size, m.finish) }
        }
    }
}

private enum class StepState { ON, DONE, IDLE, LOCKED }

@Composable
private fun Step(word: String, description: String, state: StepState, modifier: Modifier, soon: Boolean = false, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(16.dp)
    val active = onClick != null && state != StepState.LOCKED
    Box(
        modifier.alpha(if (state == StepState.LOCKED) .45f else 1f).heightIn(min = 56.dp).clip(shape).background(if (state == StepState.ON) p.accent else p.paper2)
            .border(if (state == StepState.ON) 3.dp else 2.dp, if (state == StepState.ON || state == StepState.DONE) p.accent else p.line, shape)
            .then(if (active) Modifier.clickable(role = Role.Button, onClick = onClick!!) else Modifier.semantics { role = Role.Button; disabled() })
            .semantics { contentDescription = description; if (soon) stateDescription = "Coming soon" },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Label(word, 15.sp, color = when (state) { StepState.ON -> p.accentInk; StepState.DONE -> p.accent; else -> p.ink }, weight = FontWeight.SemiBold, spacing = .03.em)
            if (soon) Label("Soon", 11.sp, color = p.muted)
        }
    }
}
