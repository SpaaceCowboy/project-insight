package com.insightpuzzle.app

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotateRad
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.random.Random

@Composable
fun GameScreen(m: GameModel) {
    val spec = m.spec
    val target = Rules.crop(spec.target)
    // The target is what you play from: it scales with the grid instead of staying a thumbnail.
    val targetCell = when (maxOf(target.size, target[0].length)) { 1, 2 -> 30.dp; 3 -> 26.dp; 4 -> 22.dp; else -> 20.dp }
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).semantics { isTraversalGroup = true }) {
        Column(Modifier.fillMaxSize().padding(start = 12.dp, end = 12.dp, top = 60.dp, bottom = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Eyebrow("World ${spec.world} · Level %03d".format(m.level + 1))
            Label(spec.name, 24.sp, Modifier.padding(top = 4.dp).semantics { heading() }, serif = true, align = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Eyebrow("Target")
            Spacer(Modifier.height(6.dp))
            TargetCard(target, targetCell, spec.target)
            Spacer(Modifier.height(12.dp))
            Board(m, Modifier.weight(1f).fillMaxWidth())
            // The result sits under the board, so the arrangement you just made stays lit and visible.
            AnimatedVisibility(Route.Win in m.stack, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) { WinStrip(m) }
        }
        RoundButton("Menu", Modifier.align(Alignment.TopStart).padding(12.dp, 10.dp).semantics { traversalIndex = -2f }, onClick = { m.push(Route.Pause) }, icon = menuIcon)
        RoundButton("Restart level", Modifier.align(Alignment.TopEnd).padding(12.dp, 10.dp).semantics { traversalIndex = -1f }, onClick = { m.restart() }, icon = restartIcon)
        AnimatedVisibility(m.restartUndo != null, Modifier.align(Alignment.TopCenter).padding(top = 10.dp), enter = fadeIn(), exit = fadeOut()) { UndoPebble { m.undoRestart() } }
    }
}

/** The target on the same deep "pool" as the board, so its flat colours keep their contrast in light mode too. */
@Composable
private fun TargetCard(target: Board, cell: Dp, full: Board) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.clip(shape).background(Brush.radialGradient(p.shell)).border(1.dp, if (p.dark) p.line else Color(0x40F3F7E7), shape).padding(10.dp)) {
        TargetMini(target, cell, 4.dp, Modifier.semantics {
            contentDescription = "Target arrangement: " + full.mapIndexed { i, row -> "row ${i + 1}: " + row.map { Art.NAME[it] ?: "gap" }.joinToString(", ") }.joinToString("; ")
        })
    }
}

/** "Restarted · Undo", shown for a few seconds beside the Restart button. */
@Composable
private fun UndoPebble(onUndo: () -> Unit) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(24.dp)
    Row(
        Modifier.heightIn(min = 48.dp).clip(shape).background(p.paper2).border(1.dp, p.line, shape)
            .clickable(role = Role.Button, onClickLabel = "Undo restart", onClick = onUndo)
            .semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "Level restarted. Undo restart" }.padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Label("Restarted", 13.sp, color = p.muted)
        Label("Undo", 14.sp, color = p.accent, weight = FontWeight.SemiBold, spacing = .05.em)
    }
}

private fun dirWords(dr: Int, dc: Int): String {
    val dir = listOfNotNull(if (dr < 0) "up" else if (dr > 0) "down" else null, if (dc < 0) "left" else if (dc > 0) "right" else null).joinToString(" ")
    return if (maxOf(abs(dr), abs(dc)) > 1) "$dir two cells" else dir
}

class Ink(val from: Offset, val to: Offset, val color: Color, val t: Animatable<Float, *>)

/** Board geometry shared by drawing and hit-testing. */
class Grid(val rows: Int, val cols: Int, val cell: Float, val gap: Float, val origin: Offset) {
    fun topLeft(p: Pos) = origin + Offset(p.c * (cell + gap), p.r * (cell + gap))
    fun center(p: Pos) = topLeft(p) + Offset(cell / 2, cell / 2)
    fun hit(x: Offset): Pos? {
        val c = ((x.x - origin.x) / (cell + gap)).toInt(); val r = ((x.y - origin.y) / (cell + gap)).toInt()
        if (x.x < origin.x || x.y < origin.y || r !in 0 until rows || c !in 0 until cols) return null
        val tl = topLeft(Pos(r, c))
        return if (x.x <= tl.x + cell && x.y <= tl.y + cell) Pos(r, c) else null
    }
}

/** Board shell: rounded panel with the faint concentric rings of the web game. */
fun DrawScope.shell(p: Palette) {
    val c = Offset(size.width / 2, size.height / 2); val r = size.width * .39f
    val ring = if (p.dark) p.line else Color(0x40F3F7E7)
    for ((extra, alpha) in listOf(0f to .4f, 35.dp.toPx() to .18f, 70.dp.toPx() to .1f))
        drawCircle(ring.copy(alpha = ring.alpha * alpha / .4f), r + extra, c, style = Stroke(if (extra == 0f) 1.dp.toPx() else 1f))
}

/** Port of src/useGame.js pointer handling: tap to select then tap a destination, or drag to a legal cell. */
@Composable
private fun Board(m: GameModel, modifier: Modifier) {
    val p = LocalPalette.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val board = m.board
    val spec0 = m.spec
    val rows = board.size; val cols = board[0].length
    var selected by remember(m.level) { mutableStateOf<Pos?>(null) }
    var dragFrom by remember(m.level) { mutableStateOf<Pos?>(null) }
    var dragOffset by remember(m.level) { mutableStateOf(Offset.Zero) }
    var hover by remember(m.level) { mutableStateOf<Pos?>(null) }
    var moving by remember(m.level) { mutableStateOf<Triple<Pos, Pos, Offset>?>(null) }
    val slide = remember { Animatable(0f) }
    var rejected by remember { mutableStateOf<Pos?>(null) }
    val reject = remember { Animatable(0f) }
    var arrived by remember { mutableStateOf(emptyList<Pos>()) }
    val arrive = remember { Animatable(0f) }
    val bloom = remember(m.level) { Animatable(0f) }
    val inks = remember { mutableStateListOf<Ink>() }
    val haptic = LocalHapticFeedback.current
    var focused by remember { mutableStateOf<Pos?>(null) }
    var status by remember { mutableStateOf("") }
    var statusCount by remember { mutableIntStateOf(0) }
    // Polite spoken status for TalkBack (swaps, refusals, solve). The zero-width toggle makes repeats announce again.
    fun say(text: String) { statusCount++; status = text + if (statusCount % 2 == 0) "" else "\u200B" }
    val solved = m.solved
    LaunchedEffect(solved, m.level) { if (solved) bloom.animateTo(1f, tween(900, easing = LinearEasing)) else bloom.snapTo(0f) }

    BoxWithConstraints(modifier.clip(RoundedCornerShape(24.dp)).background(Brush.radialGradient(p.shell)).border(1.dp, if (p.dark) p.line else Color(0x40F3F7E7), RoundedCornerShape(24.dp))) {
        val gap = with(density) { 5.dp.toPx() }
        val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
        val pad = with(density) { 32.dp.toPx() }
        val cell = min(with(density) { 88.dp.toPx() }, min((w - pad - (cols - 1) * gap) / cols, (h - pad - (rows - 1) * gap) / rows))
        // Centre the occupied area, not the full grid (holes on one side would push it off centre).
        val (minR, maxR, minC, maxC) = Rules.bounds(board)
        val gridW = cols * cell + (cols - 1) * gap; val gridH = rows * cell + (rows - 1) * gap
        val origin = Offset((w - gridW) / 2 + (cols - 1 - minC - maxC) / 2f * (cell + gap), (h - gridH) / 2 + (rows - 1 - minR - maxR) / 2f * (cell + gap))
        val grid = Grid(rows, cols, cell, gap, origin)
        val current by rememberUpdatedState(board)
        val isSolved by rememberUpdatedState(solved)

        fun rejectAt(at: Pos) {
            rejected = at; m.audio.play("deny"); haptic.performHapticFeedback(HapticFeedbackType.Reject)
            say("${Art.NAME[current[at.r][at.c]]} cannot move there")
            scope.launch { reject.snapTo(0f); reject.animateTo(1f, tween(240)); rejected = null }
        }
        fun move(a: Pos, b: Pos, from: Offset) {
            val type = current[a.r][a.c]
            selected = null; moving = Triple(a, b, from); m.audio.play("move", type)
            scope.launch {
                slide.snapTo(0f); slide.animateTo(1f, tween(185))
                val before = current
                m.move(a, b); moving = null
                haptic.performHapticFeedback(if (m.solved) HapticFeedbackType.Confirm else HapticFeedbackType.GestureEnd)
                say(if (m.solved) "Grid solved" else "${Art.NAME[type]} swapped with ${Art.NAME[before[b.r][b.c]]}")
                val ink = Ink(grid.center(a), grid.center(b), Art.LIGHT.getValue(type), Animatable(0f))
                inks += ink; if (inks.size > 3) inks.removeAt(0)
                launch { ink.t.animateTo(1f, tween(1200, easing = LinearEasing)); inks.remove(ink) }
                val after = m.board
                arrived = listOf(a, b).filter { after[it.r][it.c] == m.spec.target[it.r][it.c] && before[it.r][it.c] != after[it.r][it.c] }
                if (arrived.isNotEmpty()) launch { arrive.snapTo(0f); arrive.animateTo(1f, tween(420)); arrived = emptyList() }
            }
        }
        fun choose(at: Pos) {
            if (moving != null || isSolved) return
            val sel = selected
            if (sel != null && Rules.isLegal(current, sel, at)) { move(sel, at, Offset.Zero); return }
            if (sel != null && sel != at && Rules.legalMoves(current, sel).isNotEmpty()) { rejectAt(sel); return }
            // A stone with no move (White, or boxed in) must not lift as if it could go somewhere.
            if (sel == null && Rules.legalMoves(current, at).isEmpty()) { rejectAt(at); return }
            selected = if (sel == at) null else at
            if (selected != null) haptic.performHapticFeedback(HapticFeedbackType.SegmentTick)
            m.audio.play("select", current[at.r][at.c])
        }

        Canvas(Modifier.fillMaxSize().pointerInput(m.level, cell, origin) {
            val slop = 8.dp.toPx()
            awaitEachGesture {
                val down = awaitFirstDown()
                val at = grid.hit(down.position)
                if (at == null || current[at.r][at.c] == '.') { selected = null; return@awaitEachGesture }
                if (moving != null || isSolved) return@awaitEachGesture
                down.consume()
                val legal = Rules.legalMoves(current, at)
                var moved = false
                var lastPos = down.position
                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    val delta = change.position - down.position
                    if (!moved && hypot(delta.x, delta.y) >= slop) { moved = true; selected = null; dragFrom = at; m.audio.play("select", current[at.r][at.c]); haptic.performHapticFeedback(HapticFeedbackType.SegmentTick) }
                    if (moved) {
                        dragOffset = delta; lastPos = change.position
                        hover = grid.hit(change.position)?.takeIf { it != at }
                        change.consume()
                    }
                    if (!change.pressed) break
                }
                val target = if (moved) legal.firstOrNull { grid.hit(lastPos) == it } else null; val offset = dragOffset
                dragFrom = null; hover = null; dragOffset = Offset.Zero
                when {
                    !moved -> choose(at)
                    target != null -> move(at, target, offset)
                    legal.isNotEmpty() -> rejectAt(at)
                    else -> m.audio.play("deny")
                }
            }
        }) {
            shell(p)
            for (ink in inks) ink(ink, ink.t.value)
            val mv = moving
            val late = mutableListOf<() -> Unit>()
            for (r in 0 until rows) for (c in 0 until cols) {
                val pos = Pos(r, c); val type = board[r][c]
                if (type == '.') continue
                var o = grid.topLeft(pos); var size = cell; var glow: Color? = null; var ring: Color? = null
                if (mv != null && (pos == mv.first || pos == mv.second)) {
                    val d = grid.topLeft(mv.second) - grid.topLeft(mv.first)
                    o += if (pos == mv.first) mv.third + (d - mv.third) * slide.value else -d * slide.value
                }
                if (pos == selected) { o -= Offset(cell * .0175f, cell * .0175f + 5.dp.toPx()); size *= 1.035f; glow = p.shellInk }
                if (pos == dragFrom) { o += dragOffset - Offset(cell * .0225f, cell * .0225f); size *= 1.045f }
                if (pos == rejected) ring = Color(0xFFFFB4A8).copy(alpha = sin(reject.value * Math.PI).toFloat() * .85f)
                if (pos in arrived) ring = Color(0xFFF5FFEA).copy(alpha = sin(arrive.value * Math.PI).toFloat() * .65f)
                if (pos == focused && ring == null) ring = p.shellInk.copy(alpha = .9f)
                if (solved) {
                    // Solved bloom: each tile swells in turn, ordered by r + c (src/styles.css solvedBloom).
                    val t = ((bloom.value * 900f - (r + c) * 16f) / 650f).coerceIn(0f, 1f)
                    val s = 1f + .035f * sin(t * Math.PI).toFloat()
                    o -= Offset(cell * (s - 1) / 2, cell * (s - 1) / 2); size *= s
                    glow = Art.LIGHT.getValue(type).copy(alpha = .5f)
                }
                val highlight = if (pos == hover) .1f else 0f
                val draw = { tile(type, o, size, m.finish, glow, ring, highlight) }
                if (pos == selected || pos == dragFrom || (mv != null && pos == mv.first)) late += draw else draw()
            }
            late.forEach { it() }
        }
        // TalkBack and keyboard: one node per tile, same tap behaviour, with what the tile can do right now and where it belongs.
        for (r in 0 until rows) for (c in 0 until cols) {
            val type = board[r][c]; if (type == '.') continue
            val pos = Pos(r, c)
            val tl = grid.topLeft(pos)
            val legal = Rules.legalMoves(board, pos)
            val moves = when {
                type == 'W' -> "carried only"
                legal.isEmpty() -> "cannot move right now"
                else -> "can move " + legal.joinToString(" or ") { d -> dirWords(d.r - r, d.c - c) }
            }
            val goal = spec0.target[r][c].let { if (it == '.') "target: empty" else "target: ${Art.NAME[it]}" }
            val isSelected = pos == selected
            Box(Modifier.offset { IntOffset(tl.x.roundToInt(), tl.y.roundToInt()) }.size(with(density) { cell.toDp() })
                .onKeyEvent { e -> if (e.type == KeyEventType.KeyUp && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.DirectionCenter || e.key == Key.Spacebar)) { choose(pos); true } else false }
                .onFocusChanged { if (it.isFocused) focused = pos else if (focused == pos) focused = null }
                .focusable()
                .semantics {
                    contentDescription = "${Art.NAME[type]}, row ${r + 1}, column ${c + 1}, $moves, $goal"
                    this.selected = isSelected
                    onClick { choose(pos); true }
                })
        }
        Box(Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = status })
    }
}

/** Colour stroke between the two swapped cells (src/react-ui.jsx ColorStrokes, keyframes inkSpread). */
fun DrawScope.ink(ink: Ink, t: Float) {
    val keys = floatArrayOf(0f, .15f, .65f, 1f)
    val sx = floatArrayOf(.1f, 1f, 1.5f, 1.8f); val sy = floatArrayOf(.05f, .3f, 1.4f, 2f); val op = floatArrayOf(.6f, .45f, .18f, 0f)
    val i = when { t < .15f -> 0; t < .65f -> 1; else -> 2 }
    val k = (t - keys[i]) / (keys[i + 1] - keys[i])
    fun at(a: FloatArray) = a[i] + (a[i + 1] - a[i]) * k
    val center = (ink.from + ink.to) / 2f
    val length = max(36.dp.toPx(), (ink.to - ink.from).getDistance()); val height = 80.dp.toPx()
    val radius = height / 2
    rotateRad(atan2(ink.to.y - ink.from.y, ink.to.x - ink.from.x), center) {
        scale(at(sx) * length / height, at(sy), center) {
            drawCircle(Brush.radialGradient(0f to ink.color, .72f to Color.Transparent, center = center, radius = radius), radius, center, alpha = at(op))
        }
    }
}

/** Win burst (src/react-ui.jsx Particles): coloured sparks from the board centre. */
@Composable
fun Burst(trigger: Int) {
    if (trigger == 0 || LocalReduceMotion.current) return
    val t = remember(trigger) { Animatable(0f) }
    val sparks = remember(trigger) { List(24) { Triple(Random.nextFloat() * 6.283f, 180f + Random.nextFloat() * 420f, Art.LIGHT.values.random()) } }
    LaunchedEffect(trigger) { t.animateTo(1f, tween(1400, easing = LinearEasing)) }
    if (t.value >= 1f) return
    Canvas(Modifier.fillMaxSize()) {
        val origin = Offset(size.width / 2, size.height * .48f); val time = t.value * 1.4f
        for ((angle, speed, color) in sparks) {
            val v = Offset(kotlin.math.cos(angle) * speed, sin(angle) * speed - 260f)
            val pos = origin + v * time + Offset(0f, 520f * time * time)
            drawCircle(color, 5.dp.toPx() * (1 - t.value * .5f), pos, alpha = 1 - t.value)
        }
    }
}

