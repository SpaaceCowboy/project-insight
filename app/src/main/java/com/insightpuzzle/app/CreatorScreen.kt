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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
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
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt

private sealed interface Grab {
    data class Palette(val type: Char) : Grab
    data class Cell(val pos: Pos, val type: Char) : Grab
    data class Resize(val snapshot: Board, val center: Offset, val grab: Offset, val pitch: Float, val gap: Float) : Grab
}

/** Port of src/Creator.jsx: tile strip on top, resizable grid in the middle, S / T / M steps below. */
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
    var hover by remember { mutableStateOf<Pos?>(null) }
    var grid by remember { mutableStateOf<Grid?>(null) }
    val inks = remember { mutableStateListOf<Ink>() }

    fun rect(c: LayoutCoordinates?): Rect? = c?.takeIf { it.isAttached }?.let { root?.localBoundingBoxOf(it) }
    fun shellOrigin() = rect(shellBox)?.topLeft ?: Offset.Zero
    fun cellAt(x: Offset): Pos? = grid?.hit(x - shellOrigin())
    fun swap(a: Pos, b: Pos) {
        val type = s.board[a.r][a.c]; val g = grid ?: return
        s.board = Rules.swap(s.board, a, b); s.picked = null; s.note = ""
        val ink = Ink(g.center(a), g.center(b), Art.LIGHT.getValue(type), Animatable(0f))
        inks += ink; if (inks.size > 3) inks.removeAt(0)
        scope.launch { ink.t.animateTo(1f, tween(1200, easing = LinearEasing)); inks.remove(ink) }
        m.audio.play(if (s.solved) "win" else "move", type)
    }
    fun choose(at: Pos) {
        val picked = s.picked
        if (picked != null && Rules.isLegal(s.board, picked, at)) { swap(picked, at); return }
        s.picked = if (picked == at) null else at
        m.audio.play("select", s.board[at.r][at.c])
    }
    fun tapCell(at: Pos) {
        if (s.phase != Phase.BUILD) { if (s.board[at.r][at.c] != '.') choose(at); return }
        s.holding?.let { s.place(it, at); m.audio.play("select", it) }
    }

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
            down.consume()
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
                    if (!moved && type != '.' && (last - down.position).getDistance() >= slop) {
                        moved = true; m.audio.play("select", type)
                        if (grab is Grab.Cell) dragFrom = grab.pos
                        if (s.phase != Phase.BUILD) s.picked = null
                    }
                    if (moved) {
                        drag = type to last
                        val at = cellAt(last)
                        hover = if (s.phase == Phase.BUILD || (grab is Grab.Cell && at != null && Rules.isLegal(s.board, grab.pos, at))) at else null
                    }
                }
                change.consume()
                if (!change.pressed) break
            }
            val target = cellAt(last)
            drag = null; dragFrom = null; hover = null
            when (grab) {
                is Grab.Resize -> Unit
                is Grab.Palette -> if (!moved) { s.tapPalette(grab.type); m.audio.play("select", grab.type) } else if (target != null) { s.place(grab.type, target); s.holding = null; m.audio.play("select", grab.type) }
                is Grab.Cell -> when {
                    !moved -> tapCell(grab.pos)
                    s.phase != Phase.BUILD -> if (target != null && Rules.isLegal(s.board, grab.pos, target)) swap(grab.pos, target) else m.audio.play("deny")
                    target != null -> { s.relocate(grab.pos, target); m.audio.play("select", grab.type) }
                    rect(shellBox)?.contains(last) == false -> { s.remove(grab.pos); m.audio.play("deny") }
                }
            }
        }
    }) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.widthIn(max = 560.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                RoundButton("Back", onClick = { m.back() }, icon = backIcon)
                Spacer(Modifier.width(14.dp))
                Column {
                    Label("Create", 24.sp, Modifier.semantics { heading() }, serif = true)
                    Label(s.hint, 12.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = p.muted)
                }
            }
            // Top strip: tiles to place while building, then the Start or Target preview.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().height(84.dp).padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
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
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val label = if (s.phase == Phase.SHAPE) "Start" else "Target"
                        Eyebrow(label)
                        Spacer(Modifier.height(6.dp))
                        TargetMini(Rules.crop(if (s.phase == Phase.SHAPE) s.start!! else s.target!!), 16.dp, 3.dp, Modifier.semantics { contentDescription = "$label arrangement" })
                    }
                }
            }
            // The grid: cells are sized for 5x5 so resizing never changes the cell size under the finger.
            BoxWithConstraints(Modifier.widthIn(max = 560.dp).fillMaxWidth().weight(1f).clip(RoundedCornerShape(24.dp)).background(Brush.radialGradient(p.shell))
                .border(1.dp, if (p.dark) p.line else Color(0x40F3F7E7), RoundedCornerShape(24.dp)).onGloballyPositioned { shellBox = it }) {
                val gap = with(density) { 5.dp.toPx() }; val pad = with(density) { 48.dp.toPx() }
                val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
                val cell = min(with(density) { 100.dp.toPx() }, min((w - pad - 4 * gap) / 5, (h - pad - 4 * gap) / 5))
                val gw = s.cols * cell + (s.cols - 1) * gap; val gh = s.rows * cell + (s.rows - 1) * gap
                val g = Grid(s.rows, s.cols, cell, gap, Offset((w - gw) / 2, (h - gh) / 2)).also { grid = it }
                Canvas(Modifier.fillMaxSize()) {
                    shell(p)
                    for (item in inks) ink(item, item.t.value)
                    var late: (() -> Unit)? = null
                    for (r in 0 until s.rows) for (c in 0 until s.cols) {
                        val pos = Pos(r, c); val type = s.board[r][c]; var o = g.topLeft(pos)
                        if (type == '.') {
                            if (s.phase != Phase.BUILD) continue
                            val fill = if (pos == hover) .24f else .08f
                            drawRoundRect(p.shellInk.copy(alpha = fill), o, Size(cell, cell), CornerRadius(cell * .23f))
                            drawRoundRect(p.shellInk.copy(alpha = .4f), o, Size(cell, cell), CornerRadius(cell * .23f), style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f, 4f))))
                            continue
                        }
                        val isPicked = pos == s.picked
                        if (isPicked) o -= Offset(0f, 5.dp.toPx())
                        val dim = pos == dragFrom
                        val draw = { tile(type, o, cell, m.finish, if (isPicked) p.shellInk else if (s.solved) Art.LIGHT.getValue(type).copy(alpha = .5f) else null, null, if (pos == hover) .1f else 0f) }
                        if (dim) { drawContext.canvas.saveLayer(Rect(o, Size(cell, cell)).inflate(8f), androidx.compose.ui.graphics.Paint().apply { alpha = .35f }); draw(); drawContext.canvas.restore() }
                        else if (isPicked) late = draw else draw()
                    }
                    late?.invoke()
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
                Step("Make", "Make level", StepState.LOCKED, Modifier.weight(1f), soon = true, onClick = null)
            }
        }
        drag?.let { (type, at) ->
            val g = grid
            if (g != null) Canvas(Modifier.fillMaxSize()) { rotate4(at) { tile(type, at - Offset(g.cell / 2, g.cell / 2), g.cell, m.finish) } }
        }
    }
}

private fun DrawScope.rotate4(at: Offset, block: DrawScope.() -> Unit) = rotate(-4f, at) { block() }

private enum class StepState { ON, DONE, IDLE, LOCKED }

@Composable
private fun Step(word: String, description: String, state: StepState, modifier: Modifier, soon: Boolean = false, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(16.dp)
    val active = onClick != null && state != StepState.LOCKED
    Box(
        modifier.alpha(if (state == StepState.LOCKED) .45f else 1f).heightIn(min = 56.dp).clip(shape).background(if (state == StepState.ON) p.accent else p.paper2)
            .border(1.dp, if (state == StepState.ON || state == StepState.DONE) p.accent else p.line, shape)
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
