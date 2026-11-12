package com.insightpuzzle.app

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.ui.graphics.graphicsLayer
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.runtime.key
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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotateRad
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.random.Random

internal const val HOLD_MS = 450
/** How long a touch inside the outline stays still before the outline starts to glow for a restart. */
internal const val GLOW_DELAY_MS = 120L

/** The like key's heart in a 24-unit box of [u] pixels per unit; also drawn beside a puzzle's like count. */
internal fun heartPath(u: Float) = androidx.compose.ui.graphics.Path().apply {
    moveTo(12 * u, 20 * u)
    cubicTo(3 * u, 14 * u, 2.5f * u, 8 * u, 6 * u, 5.5f * u); cubicTo(8.5f * u, 3.8f * u, 11 * u, 5 * u, 12 * u, 7.5f * u)
    cubicTo(13 * u, 5 * u, 15.5f * u, 3.8f * u, 18 * u, 5.5f * u); cubicTo(21.5f * u, 8 * u, 21 * u, 14 * u, 12 * u, 20 * u); close()
}

/** Like: pressing swells the heart a little, like a beat. */
private fun heartIcon(filled: Boolean) = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    val heart = heartPath(u)
    scale(1f + .18f * t, Offset(12 * u, 12 * u)) {
        if (filled) drawPath(heart, c) else drawPath(heart, c, style = Stroke(1.7f * u, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}
/** Bookmark: pressing dips the ribbon a little. */
private fun bookmarkIcon(filled: Boolean) = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    val mark = androidx.compose.ui.graphics.Path().apply { moveTo(6 * u, 3.5f * u); lineTo(18 * u, 3.5f * u); lineTo(18 * u, 20.5f * u); lineTo(12 * u, 16 * u); lineTo(6 * u, 20.5f * u); close() }
    translate(0f, 2f * u * t) {
        if (filled) drawPath(mark, c) else drawPath(mark, c, style = Stroke(1.7f * u, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

/** One outline height for every board (game, Rulebook, creator): about two thirds of the screen, never more than the room available. */
@Composable
internal fun boardShellHeight(available: Dp = Dp.Infinity): Dp = minOf(available, (LocalConfiguration.current.screenHeightDp * .65f).dp)
internal const val REWIND_MS = 320

/**
 * Extra space between the title key and the target. The key is centred in a 48dp row that starts 64dp down, so its middle is at 88dp; the Back chevron's
 * point is at about 44dp (16 top inset + 14 icon inset + 13.3 for the chevron's depth + stroke). Mirroring that point about the key's middle puts the
 * target's top at 132dp, which is 20dp below where the 48dp row ends (112dp).
 */
private val TARGET_DROP = 20.dp
/** Whenever a game screen appears the outline and its grid start this far up and settle down into place over [BOARD_SETTLE_MS]. */
private val BOARD_LIFT = 8.dp
private const val BOARD_SETTLE_MS = 300
/** Sidewall of the board's outline: deep like the menu keys', so holding to restart sinks it a long way and lights the wall. */
internal val BOARD_WALL = 10.dp
/** How much of its wall the board sinks onto when held. */
internal const val BOARD_TRAVEL = .5f

/** The lamp's art on the outline: [LAMP_ART] square, its right edge [LAMP_INSET] in from the outline's and its top [LAMP_TOP] down (the middle of the 48dp touch area). */
internal val LAMP_ART = 20.dp
internal val LAMP_INSET = 18.dp
internal val LAMP_TOP = 18.dp

/** The solved bloom: [BLOOM_MS] of swelling, then [GLOW_FADE_MS] for the rings to go; together they end before the result bar comes up. */
internal const val BLOOM_MS = 650
internal const val GLOW_FADE_MS = 180
private const val BLOOM_STAGGER_MS = 16f
private const val SOLVE_RING_ALPHA = .35f

/** How far through its swell a tile at [diagonal] (row + column) is at [bloom] (0..1): tiles start [BLOOM_STAGGER_MS] apart and the last one ends with the bloom. */
internal fun solveSwell(bloom: Float, diagonal: Int, maxDiagonal: Int = 8): Float {
    val window = BLOOM_MS - maxDiagonal * BLOOM_STAGGER_MS
    return ((bloom * BLOOM_MS - diagonal * BLOOM_STAGGER_MS) / window).coerceIn(0f, 1f)
}

/** How long a level or puzzle takes to slide out while the next one slides in, and how far its last/first sliver fades at the page margin. */
private const val LEVEL_SLIDE_MS = 340
private const val LEVEL_SLIDE_FADE = .08f
/** The space between the leaving and the arriving platform: the platform's own margin from the screen edge. */
private val PLATFORM_GAP = 16.dp
/** After Next, the result bar sinks for this long before the board starts its slide. */
private const val WIN_EXIT_MS = 350L

/** What the game screen shows of the model: frozen while the screen slides away, so leaving an online puzzle never flashes the Journey board. */
private class GameView(val spec: Level, val board: Board, val community: CommunityAttempt?, val level: Int, val solved: Boolean) {
    /** A level or a community puzzle; a change of this is what animates a swipe or Next. */
    val identity: String get() = community?.let { "c:${it.id}" } ?: "j:$level"
}
private class GameViewHolder { var view: GameView? = null }
/** A swipe or Next has been asked for; the slide starts when the model actually shows the new puzzle. */
private class PendingSwap(val from: GameView, val direction: Int)
/** The slide in flight: [from] is the settled board being left, [direction] 1 for next and -1 for previous. */
private class LevelSwap(val from: GameView, val direction: Int)

@Composable
fun GameScreen(m: GameModel) {
    val exiting = LocalExiting.current
    val held = remember { GameViewHolder() }
    val now = GameView(m.spec, m.board, m.community, m.level, m.solved)
    val view = if (exiting) held.view ?: now else now.also { held.view = it }
    // pointerInput runs once and keeps its first lambdas, so the swipe handler reads the view through this updated state.
    val latestView by rememberUpdatedState(view)
    val spec = view.spec
    val community = view.community
    val solved = view.solved
    val target = Rules.crop(spec.target)
    val targetCell = 16.dp
    val scope = rememberCoroutineScope()
    val glow = remember { Animatable(0f) }
    val rewind = remember { Animatable(0f) }
    var rewinding by remember { mutableStateOf(false) }
    // A swipe or Next is pending until the model shows the new puzzle; then one animation slides the old board out and the new one in.
    var pendingSwap by remember { mutableStateOf<PendingSwap?>(null) }
    var activeSwap by remember { mutableStateOf<LevelSwap?>(null) }
    val swapSlide = remember { Animatable(0f) }
    var advancing by remember { mutableStateOf(false) }
    val canRewind by rememberUpdatedState(!exiting && m.changed && !m.solved && !rewinding && pendingSwap == null && activeSwap == null && !advancing)
    val canSwipe by rememberUpdatedState(m.community.let { it == null || it.casual || it.source != null } && Route.Win !in m.stack && !m.online.busy && !rewinding &&
        m.guidePhase == 0 && pendingSwap == null && activeSwap == null && !advancing)
    val reduceMotion by rememberUpdatedState(LocalReduceMotion.current)
    // Every time the game screen appears (from Home or Worlds, back from Options or the Journey level screen, a level picked there) the outline and its grid
    // start a little up and settle down into place. A screen is composed fresh each time it comes back; moving between puzzles, or winning, does not compose
    // it again, so those do not lift. It is a draw-time offset only, so nothing is laid out again.
    val lift = remember { Animatable(if (!reduceMotion && !exiting) 1f else 0f) }
    // It settles once the screen is fully in place: after it has finished rising, and after any screen that was on top of it has finished sinking away.
    val sheet = LocalSheet.current
    val cover = LocalCover.current
    LaunchedEffect(Unit) {
        if (lift.value <= 0f) return@LaunchedEffect
        androidx.compose.runtime.snapshotFlow { (sheet?.progress?.value ?: 1f) >= 1f && cover() <= .02f }.first { it }
        lift.animateTo(0f, tween(BOARD_SETTLE_MS, easing = FastOutSlowInEasing))
    }
    // The first-play tips wait for the screen to settle, then another half second, so Journey 1 is seen before its borders and text arrive.
    // The first online puzzle's like and bookmark tips wait the same way.
    LaunchedEffect(m.onboardPending, m.onlineGuidePending, m.top) {
        if (!m.onboardPending && !m.onlineGuidePending) return@LaunchedEffect
        androidx.compose.runtime.snapshotFlow { m.top == Route.Game && (sheet?.progress?.value ?: 1f) >= 1f && cover() <= .02f }.first { it }
        delay(500)
        if (m.onboardPending && m.top == Route.Game && m.level == 0 && m.community == null && m.guideOn && !exiting) m.revealOnboardGuide()
        else if (m.onlineGuidePending && m.top == Route.Game && m.community != null && !m.solved && m.guideOn && !exiting) m.revealOnlineGuide()
        else m.cancelOnboardGuide()
    }
    // The model has changed to the puzzle the player swiped or pressed Next for: freeze the old board and slide it away while the new one arrives.
    LaunchedEffect(view.identity) {
        val pending = pendingSwap
        if (pending != null && pending.from.identity != view.identity) {
            pendingSwap = null
            if (reduceMotion) return@LaunchedEffect
            swapSlide.snapTo(0f)
            activeSwap = LevelSwap(pending.from, pending.direction)
            swapSlide.animateTo(1f, tween(LEVEL_SLIDE_MS, easing = FastOutSlowInEasing))
            activeSwap = null
        }
    }
    // A failed online request leaves the old board where it is; a route change (the end of a list, or Back) ends the request too.
    LaunchedEffect(m.online.busy, view.identity) {
        if (!m.online.busy) pendingSwap?.let { if (it.from.identity == view.identity) pendingSwap = null }
    }
    LaunchedEffect(m.top) { if (m.top != Route.Game) pendingSwap = null }
    // The slide shown now. It starts in the very composition in which the model first shows the new puzzle, never a frame later from the effect
    // above: that one late frame drew the new board and target on the old platform for an instant (the flicker at the start of a slide).
    val starting = pendingSwap?.takeIf { it.from.identity != view.identity && !reduceMotion }
    val shownSwap = activeSwap ?: starting?.let { LevelSwap(it.from, it.direction) }
    val slide = if (activeSwap != null) swapSlide.value else 0f
    // Where things are, for telling the hold zone and the swipe zones apart.
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var shellBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var titleBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var titleKey by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var targetBox by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var gridRect by remember { mutableStateOf(Rect.Zero) }
    fun rect(c: LayoutCoordinates?): Rect? = c?.takeIf { it.isAttached }?.let { root?.takeIf { r -> r.isAttached }?.localBoundingBoxOf(it) }
    /** The outline's rectangle as state, so the guide icon and the guide's borders follow it. */
    var shellRect by remember { mutableStateOf<Rect?>(null) }
    fun refresh() { shellRect = rect(shellBox) }
    /** Restart with the tiles sliding back to the start. The hold-to-restart gesture arrives with the platform already lit; the result popup's button lights it first. */
    fun runRestart() {
        if (rewinding) return
        scope.launch {
            rewinding = true
            m.feedbackTriple()
            if (!reduceMotion && glow.value < 1f) glow.animateTo(1f, tween(150))
            rewind.snapTo(0f)
            if (!reduceMotion) rewind.animateTo(1f, tween(REWIND_MS))
            m.restart()
            rewinding = false; rewind.snapTo(0f); glow.animateTo(0f, tween(220))
        }
    }
    /**
     * Next on the result bar: the bar sinks first (as it always did), then the same platform slide opens the next level or puzzle. If the
     * next step leaves the game (the campaign's end, the end of a list), the game's own screen transition takes over instead.
     */
    fun runNext() {
        if (advancing) return
        advancing = true
        val from = view
        m.hideWin()
        scope.launch {
            delay(WIN_EXIT_MS)
            if (m.top == Route.Game) {
                m.next()
                pendingSwap = PendingSwap(from, 1)
                // An online next is a request: if it fails, the bar comes back so the player can retry instead of being left on a solved board.
                if (m.community != null) {
                    androidx.compose.runtime.snapshotFlow { m.online.busy }.first { !it }
                    if (m.top == Route.Game && m.community?.id == from.community?.id && m.solved) {
                        pendingSwap = null
                        m.showWin()
                    }
                }
            }
            advancing = false
        }
    }
    Box(Modifier.fillMaxSize().windowInsetsPadding(appInsets).clipToBounds().onGloballyPositioned { root = it; refresh() }.semantics {
        isTraversalGroup = true
        customActions = if (canRewind) listOf(CustomAccessibilityAction(tr("Restart level")) { m.restart(); true }) else emptyList()
    }
        // Touch and hold anywhere on the outline but on a tile (its edges, the gaps, an empty cell): the outline glows, then the tiles slide back to the start.
        // Tiles take their own touches first (the board consumes them), so they never reach this.
        // A swipe from anywhere but the grid itself (inside the outline above or below the grid, or below the outline) moves along:
        // right to left for the next puzzle or level, left to right for the previous one. The glow waits [GLOW_DELAY_MS] of holding still, so a swipe never lights it.
        .pointerInput(Unit) {
            val swipe = 80.dp.toPx()
            awaitEachGesture {
                val down = awaitFirstDown()
                val shell = rect(shellBox)
                val at = down.position
                val inShell = shell?.contains(at) == true
                val onGrid = shell != null && gridRect.translate(shell.topLeft).contains(at)
                val swipeable = canSwipe && shell != null && !onGrid && (inShell || at.y >= shell.bottom)
                var still = canRewind && inShell
                if (!still && !swipeable) return@awaitEachGesture
                var held = false; var skipped = 0; var glowing = false
                while (true) {
                    val elapsed = android.os.SystemClock.uptimeMillis() - down.uptimeMillis
                    if (still && !glowing && !reduceMotion && elapsed >= GLOW_DELAY_MS) {
                        glowing = true
                        scope.launch { glow.animateTo(1f, tween((HOLD_MS - elapsed).toInt().coerceAtLeast(1), easing = LinearEasing)) }
                    }
                    val wait = if (!still) null else if (!glowing && !reduceMotion) GLOW_DELAY_MS - elapsed else HOLD_MS - elapsed
                    val event = if (wait != null) withTimeoutOrNull(wait.coerceAtLeast(1)) { awaitPointerEvent() } else awaitPointerEvent()
                    if (event == null) {
                        if (android.os.SystemClock.uptimeMillis() - down.uptimeMillis >= HOLD_MS) { held = true; break } else continue
                    }
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    val d = change.position - down.position
                    if (swipeable && abs(d.x) > swipe && abs(d.x) > 2 * abs(d.y)) { skipped = if (d.x < 0) 1 else -1; break }
                    if (!change.pressed) break
                    if (still && d.getDistance() > viewConfiguration.touchSlop) { still = false; if (glowing) scope.launch { glow.animateTo(0f, tween(180)) } }
                    if (!still && !swipeable) break
                }
                if (skipped != 0) {
                    if (glow.value > 0f) scope.launch { glow.snapTo(0f) }
                    val from = latestView
                    val opened = m.swipe(skipped)
                    m.feedback(if (!opened) Cue.INVALID_DROP else if (skipped > 0) Cue.FORWARD else Cue.BACK)
                    if (opened) pendingSwap = PendingSwap(from, skipped)
                    return@awaitEachGesture
                }
                if (!held || !canRewind) { scope.launch { glow.animateTo(0f, tween(180)) }; return@awaitEachGesture }
                runRestart()
            }
        }) {
        // On tablets and landscape windows the play area stays board-sized and centred instead of stretching edge to edge.
        Column(Modifier.align(Alignment.TopCenter).widthIn(max = 720.dp).fillMaxSize()) {
            // 16dp at the sides: the outline's edges line up with Options and Profile above it.
            Column(Modifier.weight(1f).fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 64.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                // Journey: "Journey N" above the target opens the level screen.
                if (community == null) {
                    val p = LocalPalette.current
                    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                    Box(Modifier.height(48.dp).onGloballyPositioned { titleBox = it }.pressOnTouch(source)
                        .clickable(source, null, role = Role.Button, onClickLabel = tr("Open levels")) { m.feedback(Cue.FORWARD); m.showLevels() }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                        // A small raised key that covers the whole "Journey" and its number (1 to the campaign size).
                        Box(Modifier.onGloballyPositioned { titleKey = it }.plush(RoundedCornerShape(10.dp), pressProgress(source), p.paper2, rest = 3.dp, depth = TITLE_WALL).padding(horizontal = 12.dp, vertical = 5.dp)) {
                            Label(tr("Journey {0}", view.level + 1), 13.sp, weight = FontWeight.SemiBold, lines = 1, translate = false)
                        }
                    }
                }
                // Creator and their puzzle number on a small raised key like Journey's above the target; tapping it opens their profile.
                community?.let { c ->
                    val p = LocalPalette.current
                    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                    val number = c.grid.optInt("levelNumber")
                    val creator = c.grid.optString("username", "Creator") + if (number > 0) " $number" else ""
                    Box(Modifier.height(48.dp).onGloballyPositioned { titleBox = it }.pressOnTouch(source)
                        .clickable(source, null, role = Role.Button, onClickLabel = tr("Open profile")) { m.feedback(Cue.FORWARD); m.push(Route.Profile(c.grid.getString("ownerId"))) }
                        .padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                        Box(Modifier.widthIn(max = 300.dp).onGloballyPositioned { titleKey = it }.plush(RoundedCornerShape(10.dp), pressProgress(source), p.paper2, rest = 3.dp, depth = TITLE_WALL).padding(horizontal = 12.dp, vertical = 5.dp)) {
                            Label(creator, 13.sp, weight = FontWeight.SemiBold, lines = 1, translate = false)
                        }
                    }
                }
                // The target sits as far below the key as the key sits below the Back chevron's point (see [TARGET_DROP]).
                Spacer(Modifier.height(TARGET_DROP))
                Box(Modifier.onGloballyPositioned { targetBox = it }.semantics {
                    contentDescription = tr("Target arrangement") + ": " + spec.target.mapIndexed { i, row -> tr("row {0}", i + 1) + ": " + row.map { Art.name(it) ?: tr("gap") }.joinToString(", ") }.joinToString("; ")
                }) {
                    val swap = shownSwap
                    if (swap != null) MorphTarget(Rules.crop(swap.from.spec.target), target, slide, targetCell, 2.6.dp)
                    else TargetMini(target, targetCell, 2.6.dp)
                }
                Spacer(Modifier.height(12.dp))
                // The outline keeps the shared board height and sits at the bottom, so it is shorter from the top.
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    val p = LocalPalette.current
                    // The lamp is etched into the outline under the tiles, so a tile dragged over it covers it; it sinks with the platform. It keeps its colour
                    // when the puzzle is solved (the lamp only stops answering), and it is drawn on both platforms of a slide, so it travels with each one.
                    val lampInk = lerp(p.paper2, p.ink, .5f)
                    fun lamp(lit: Boolean): (DrawScope.() -> Unit)? = if (m.guideOn && !exiting) {
                        { lampArt(lampInk, lit, Offset(size.width - LAMP_INSET.toPx() - LAMP_ART.toPx(), LAMP_TOP.toPx()), LAMP_ART.toPx(), if (p.dark) Color.White else p.ink) }
                    } else null
                    val boardHeight = boardShellHeight(maxHeight)
                    val swap = shownSwap
                    // The old platform and the next one travel together, one platform width plus the side margin apart: the space between them is the
                    // same space as between a platform and the screen edge, so their sides never meet.
                    val travel = constraints.maxWidth.toFloat() + with(LocalDensity.current) { PLATFORM_GAP.toPx() }
                    val t = slide
                    // Each platform is keyed by its puzzle, so the board being left is the very one that was resting (nothing is composed again when a
                    // slide starts or ends, which flashed its tiles), and the arriving one stays the resting board afterwards.
                    if (swap != null) key(swap.from.identity) {
                        val from = swap.from
                        val oldAlpha = ((1f - t) / LEVEL_SLIDE_FADE).coerceIn(0f, 1f)
                        Board(Modifier.clearAndSetSemantics { }.graphicsLayer {
                                translationY = -lift.value * BOARD_LIFT.toPx(); translationX = -swap.direction * travel * t; alpha = oldAlpha
                            }.fillMaxWidth().height(boardHeight), from.board, Pair(from.level, from.community?.id), from.spec.target, from.solved, { from.board },
                            beneath = lamp(false), interactive = false) { _, _ -> }
                    }
                    key(view.identity) {
                        val newAlpha = if (swap == null) 1f else (t / LEVEL_SLIDE_FADE).coerceIn(0f, 1f)
                        Board(Modifier.graphicsLayer {
                                translationY = -lift.value * BOARD_LIFT.toPx(); translationX = if (swap == null) 0f else swap.direction * travel * (1f - t); alpha = newAlpha
                            }.fillMaxWidth().height(boardHeight).onGloballyPositioned { shellBox = it; refresh() }, view.board, Pair(view.level, community?.id), spec.target, solved, { m.board },
                            holdGlow = if (swap == null) glow.value else 0f, rewindTo = if (rewinding && swap == null) spec.start else null, rewindProgress = rewind.value,
                            onGrid = { gridRect = it }, beneath = lamp(m.guidePhase != 0 && swap == null)) { a, b -> m.move(a, b) }
                    }
                }
            }
            // The bar grows in from below while the board area shrinks, so the outline's bottom lifts in step with it; Next and Restart send it back down the same way.
            val motion = !LocalReduceMotion.current
            androidx.compose.animation.AnimatedVisibility(Route.Win in m.stack,
                enter = if (motion) androidx.compose.animation.expandVertically(tween(260), expandFrom = Alignment.Top) + androidx.compose.animation.fadeIn(tween(260)) + androidx.compose.animation.slideInVertically(tween(260)) { it / 4 } else androidx.compose.animation.EnterTransition.None,
                exit = if (motion) shrinkVertically(tween(260), shrinkTowards = Alignment.Top) + fadeOut(tween(200)) + androidx.compose.animation.slideOutVertically(tween(260)) { it / 4 } else androidx.compose.animation.ExitTransition.None) {
                // While the tiles slide back after Restart, nothing in the popup can be pressed again.
                WinPopup(m, interactive = transition.targetState == androidx.compose.animation.EnterExitState.Visible && !rewinding && !advancing, onRestart = ::runRestart, onNext = ::runNext)
            }
        }
        // Same corners as Home and every page: 16dp in from the safe edges.
        HomeIconButton("Options", Modifier.align(Alignment.TopStart).padding(16.dp).semantics { traversalIndex = -3f }, { m.push(Route.Options) }, optionsIcon, Cue.STOP)
        BackChevron(m, Modifier.align(Alignment.TopCenter).padding(top = 16.dp).semantics { traversalIndex = -2f })
        HomeIconButton("Profile", Modifier.align(Alignment.TopEnd).padding(16.dp).semantics { traversalIndex = -1f }, { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
        // The gameplay tips: the lamp's touch area over the top right of the outline (its art is drawn on the board, under the tiles; dimmed and off while the
        // level is solved) and, while a step is showing, its borders and text. The touch area follows the platform as a hold sinks it.
        LaunchedEffect(m.solved) { if (m.solved) m.endGuide() }
        shellRect?.let { shell ->
            val dp = LocalDensity.current.density
            val sink = glow.value * BOARD_TRAVEL * BOARD_WALL.value * dp - lift.value * BOARD_LIFT.value * dp
            val lampAt = Rect(shell.right - 52 * dp, shell.top + 4 * dp + sink, shell.right - 4 * dp, shell.top + 52 * dp + sink)
            if (m.guideOn && !exiting && shownSwap == null) GuideButton(Modifier.offset { guideLampOffset(shell).let { IntOffset(it.x, it.y + sink.roundToInt()) } }, enabled = !solved) { m.tapGuide() }
            if (m.guidePhase != 0 && !solved && !exiting && shownSwap == null) {
                val size = root?.size
                val own = community?.grid?.optString("ownerId") == m.online.user?.id
                val like = if (!own) Rect(16 * dp, 72 * dp, 64 * dp, 120 * dp) else null
                val bookmark = size?.let { Rect(it.width - 64 * dp, 72 * dp, it.width - 16 * dp, 120 * dp) }
                GameGuide(m, shell, gridRect.translate(shell.topLeft), rect(titleKey), like.takeIf { community != null }, bookmark.takeIf { community != null }, rect(targetBox), community != null && own, lampAt)
            }
        }
        // Online puzzles: like (under Options, not on your own puzzles) and bookmark (under Profile). Filled when on.
        community?.let { c ->
            if (c.grid.optString("ownerId") != m.online.user?.id)
                HomeIconButton(if (m.liked) "Unlike puzzle" else "Like puzzle", Modifier.align(Alignment.TopStart).padding(start = 16.dp, top = 72.dp), { m.toggleLike() }, heartIcon(m.liked), Cue.CHECK)
            HomeIconButton(if (m.bookmarked) "Remove bookmark" else "Bookmark puzzle", Modifier.align(Alignment.TopEnd).padding(end = 16.dp, top = 72.dp), { m.toggleBookmark() }, bookmarkIcon(m.bookmarked), Cue.CHECK)
        }
    }
}

/** Where each tile of [from] slides so the board becomes [to]: tiles already in place stay, the rest go to the nearest free cell of the same colour. */
internal fun rewindMoves(from: Board, to: Board): Map<Pos, Pos> {
    val moves = HashMap<Pos, Pos>()
    val loose = ArrayList<Pos>()
    for (r in from.indices) for (c in from[r].indices) {
        val p = Pos(r, c)
        if (from[r][c] == '.') continue
        if (to.getOrNull(r)?.getOrNull(c) == from[r][c]) moves[p] = p else loose += p
    }
    val open = ArrayList<Pos>()
    for (r in to.indices) for (c in to[r].indices) if (to[r][c] != '.' && from.getOrNull(r)?.getOrNull(c) != to[r][c]) open += Pos(r, c)
    for (p in loose) {
        val type = from[p.r][p.c]
        val best = open.filter { to[it.r][it.c] == type }.minByOrNull { abs(it.r - p.r) + abs(it.c - p.c) } ?: continue
        open.remove(best); moves[p] = best
    }
    return moves
}

private fun dirWords(dr: Int, dc: Int): String {
    val dir = listOfNotNull(if (dr < 0) tr("up") else if (dr > 0) tr("down") else null, if (dc < 0) tr("left") else if (dc > 0) tr("right") else null).joinToString(" ")
    return if (maxOf(abs(dr), abs(dc)) > 1) tr("{0} two cells", dir) else dir
}

class Ink(val from: Offset, val to: Offset, val color: Color, val t: Animatable<Float, *>)

/**
 * The finger's movement [raw] from a tile's lifted top-left [home], kept so the [lifted]-sized tile stays [edge] inside the room (left, top, right, bottom). Shared by the
 * game and the creator's later phases: a tile can be dragged to the platform's edge but no further.
 */
internal fun clampDrag(raw: Offset, home: Offset, lifted: Float, edge: Float, left: Float, top: Float, right: Float, bottom: Float): Offset {
    val at = home + raw
    return Offset(at.x.coerceIn(left + edge, (right - edge - lifted).coerceAtLeast(left + edge)), at.y.coerceIn(top + edge, (bottom - edge - lifted).coerceAtLeast(top + edge))) - home
}

/** Where a tile lifted from [at] and dragged by [drag] lands: the legal cell its centre is over (within 0.6 of a cell of that cell's centre), else nowhere. */
internal fun dropTarget(grid: Grid, at: Pos, drag: Offset, legal: List<Pos>): Pos? {
    val centre = grid.center(at) + drag
    return legal.map { it to (grid.center(it) - centre).getDistance() }.filter { it.second <= grid.cell * .6f }.minByOrNull { it.second }?.first
}

/** Board geometry shared by drawing and hit-testing. */
class Grid(val rows: Int, val cols: Int, val cell: Float, val gap: Float, val origin: Offset) {
    fun topLeft(p: Pos) = origin + Offset(p.c * (cell + gap), p.r * (cell + gap))
    fun center(p: Pos) = topLeft(p) + Offset(cell / 2, cell / 2)
    /** True when [x] lies beyond the rows x cols rectangle grown by [slack] on every side. */
    fun isOutside(x: Offset, slack: Float): Boolean {
        val width = cols * cell + (cols - 1) * gap; val height = rows * cell + (rows - 1) * gap
        return x.x < origin.x - slack || x.y < origin.y - slack || x.x > origin.x + width + slack || x.y > origin.y + height + slack
    }
    fun hit(x: Offset): Pos? {
        val c = ((x.x - origin.x) / (cell + gap)).toInt(); val r = ((x.y - origin.y) / (cell + gap)).toInt()
        if (x.x < origin.x || x.y < origin.y || r !in 0 until rows || c !in 0 until cols) return null
        val tl = topLeft(Pos(r, c))
        return if (x.x <= tl.x + cell && x.y <= tl.y + cell) Pos(r, c) else null
    }
}

/** Port of src/useGame.js pointer handling: tap to select then tap a destination, or drag to a legal cell. */
@Composable
fun Board(
    modifier: Modifier, board: Board, key: Any, target: Board?, solved: Boolean,
    latest: () -> Board, holdGlow: Float = 0f, rewindTo: Board? = null, rewindProgress: Float = 0f, onGrid: ((Rect) -> Unit)? = null,
    beneath: (DrawScope.() -> Unit)? = null, interactive: Boolean = true, onMove: (Pos, Pos) -> Unit,
) {
    val rewindPlan = remember(key, rewindTo) { rewindTo?.let { rewindMoves(latest(), it) } }
    val busy by rememberUpdatedState(rewindTo != null)
    val p = LocalPalette.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val rows = board.size; val cols = board[0].length
    var selected by remember(key) { mutableStateOf<Pos?>(null) }
    var dragFrom by remember(key) { mutableStateOf<Pos?>(null) }
    var dragOffset by remember(key) { mutableStateOf(Offset.Zero) }
    var hover by remember(key) { mutableStateOf<Pos?>(null) }
    var moving by remember(key) { mutableStateOf<Triple<Pos, Pos, Offset>?>(null) }
    val slide = remember { Animatable(0f) }
    var rejected by remember { mutableStateOf<Pos?>(null) }
    val reject = remember { Animatable(0f) }
    var arrived by remember { mutableStateOf(emptyList<Pos>()) }
    val arrive = remember { Animatable(0f) }
    val bloom = remember(key) { Animatable(0f) }
    val solveGlow = remember(key) { Animatable(0f) }
    val reduceMotion = LocalReduceMotion.current
    val inks = remember { mutableStateListOf<Ink>() }
    val feedback = LocalFeedback.current
    var focused by remember { mutableStateOf<Pos?>(null) }
    var status by remember { mutableStateOf("") }
    var statusCount by remember { mutableIntStateOf(0) }
    // Polite spoken status for TalkBack (swaps, refusals, solve). The zero-width toggle makes repeats announce again.
    fun say(text: String) { statusCount++; status = text + if (statusCount % 2 == 0) "" else "\u200B" }
    LaunchedEffect(solved, key, reduceMotion) {
        bloom.snapTo(0f)
        solveGlow.snapTo(0f)
        if (solved && !reduceMotion) {
            // Over before the result bar comes up (GameModel shows it [WIN_DELAY_MS] after the winning move): the board is settled when it arrives.
            solveGlow.snapTo(1f)
            bloom.animateTo(1f, tween(BLOOM_MS, easing = LinearEasing))
            solveGlow.animateTo(0f, tween(GLOW_FADE_MS))
        }
    }

    // The board is a raised platform like the app's keys: holding to restart sinks it half way down onto its wall (it does not shrink, so no edge rises)
    // while the wall lights up.
    BoxWithConstraints(modifier.plush(RoundedCornerShape(24.dp), holdGlow, p.paper2, rest = 6.dp, depth = BOARD_WALL, sheen = false, travel = BOARD_TRAVEL, sideLight = holdGlow, shrink = false)) {
        val gap = with(density) { 5.dp.toPx() }
        val w = constraints.maxWidth.toFloat(); val h = constraints.maxHeight.toFloat()
        val pad = with(density) { 32.dp.toPx() }
        val cell = min(with(density) { (if (LocalConfiguration.current.screenWidthDp >= 600) 120.dp else 88.dp).toPx() }, min((w - pad - (cols - 1) * gap) / cols, (h - pad - (rows - 1) * gap) / rows))
        // Centre the occupied area, not the full grid (holes on one side would push it off centre).
        val (minR, maxR, minC, maxC) = Rules.bounds(board)
        val gridW = cols * cell + (cols - 1) * gap; val gridH = rows * cell + (rows - 1) * gap
        val origin = Offset((w - gridW) / 2 + (cols - 1 - minC - maxC) / 2f * (cell + gap), (h - gridH) / 2 + (rows - 1 - minR - maxR) / 2f * (cell + gap))
        val grid = Grid(rows, cols, cell, gap, origin)
        // The whole rows x cols area, gaps included, grown by one gap: touches here belong to the grid, never to hold-to-restart.
        if (onGrid != null) androidx.compose.runtime.SideEffect { onGrid(Rect(origin.x - gap, origin.y - gap, origin.x + gridW + gap, origin.y + gridH + gap)) }
        val current by rememberUpdatedState(board)
        val isSolved by rememberUpdatedState(solved)

        fun rejectAt(at: Pos) {
            rejected = at; feedback(Cue.INVALID_DROP)
            say(tr("{0} cannot move there", Art.name(current[at.r][at.c])))
            scope.launch { reject.snapTo(0f); reject.animateTo(1f, tween(240)); rejected = null }
        }
        fun move(a: Pos, b: Pos, from: Offset) {
            val type = current[a.r][a.c]
            selected = null; moving = Triple(a, b, from)
            scope.launch {
                slide.snapTo(0f); slide.animateTo(1f, tween(185))
                val before = current
                onMove(a, b); moving = null
                val won = target != null && Rules.key(latest()) == Rules.key(target)
                feedback(Cue.DROP)
                say(if (won) tr("Grid solved") else tr("{0} swapped with {1}", Art.name(type), Art.name(before[b.r][b.c])))
                val ink = Ink(grid.center(a), grid.center(b), Art.LIGHT.getValue(type), Animatable(0f))
                inks += ink; if (inks.size > 3) inks.removeAt(0)
                launch { ink.t.animateTo(1f, tween(1200, easing = LinearEasing)); inks.remove(ink) }
                val after = latest()
                arrived = if (target == null) emptyList() else listOf(a, b).filter { after[it.r][it.c] == target[it.r][it.c] && before[it.r][it.c] != after[it.r][it.c] }
                if (arrived.isNotEmpty()) launch { arrive.snapTo(0f); arrive.animateTo(1f, tween(420)); arrived = emptyList() }
            }
        }
        fun choose(at: Pos) {
            if (moving != null || isSolved || busy) return
            val sel = selected
            if (sel != null && Rules.isLegal(current, sel, at)) { move(sel, at, Offset.Zero); return }
            if (sel != null && sel != at && Rules.legalMoves(current, sel).isNotEmpty()) {
                if (Rules.legalMoves(current, at).isNotEmpty()) { selected = at; feedback(Cue.DRAG_START); return }
                rejectAt(sel); return
            }
            // A stone with no move (White, or boxed in) must not lift as if it could go somewhere.
            if (sel == null && Rules.legalMoves(current, at).isEmpty()) { rejectAt(at); return }
            selected = if (sel == at) null else at
            feedback(Cue.DRAG_START)
        }

        Canvas(Modifier.fillMaxSize().pointerInput(key, cell, origin, w, h) {
            if (!interactive) return@pointerInput
            val slop = 8.dp.toPx()
            val edge = 4.dp.toPx()
            awaitEachGesture {
                val down = awaitFirstDown()
                val at = grid.hit(down.position)
                if (at == null || current[at.r][at.c] == '.') { selected = null; return@awaitEachGesture }
                if (moving != null || isSolved || busy) return@awaitEachGesture
                down.consume()
                val legal = Rules.legalMoves(current, at)
                var moved = false
                var lastDelta = Offset.Zero
                // The lifted tile is drawn a little larger and up-left of its cell; it can be dragged to the platform's edge but no further.
                val lifted = cell * 1.045f
                val home = grid.topLeft(at) - Offset(cell * .0225f, cell * .0225f)
                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    val raw = change.position - down.position
                    if (!moved && hypot(raw.x, raw.y) >= slop) { moved = true; selected = null; dragFrom = at; feedback(Cue.DRAG_START) }
                    if (moved) {
                        val delta = clampDrag(raw, home, lifted, edge, 0f, 0f, w.toFloat(), h.toFloat())
                        dragOffset = delta; lastDelta = delta
                        hover = dropTarget(grid, at, delta, legal)
                        change.consume()
                    }
                    if (!change.pressed) break
                }
                // Only a drop with the tile over a cell it can swap with counts; merely heading that way does not.
                val target = if (moved) dropTarget(grid, at, lastDelta, legal) else null; val offset = dragOffset
                dragFrom = null; hover = null; dragOffset = Offset.Zero
                when {
                    !moved -> choose(at)
                    target != null -> move(at, target, offset)
                    legal.isNotEmpty() -> rejectAt(at)
                    else -> feedback(Cue.INVALID_DROP)
                }
            }
        }) {
            beneath?.invoke(this)
            for (ink in inks) ink(ink, ink.t.value)
            val mv = moving
            val late = mutableListOf<() -> Unit>()
            for (r in 0 until rows) for (c in 0 until cols) {
                val pos = Pos(r, c); val type = board[r][c]
                if (type == '.') continue
                var o = grid.topLeft(pos); var size = cell; var glow: Color? = null; var ring: Color? = null
                rewindPlan?.get(pos)?.let { dest -> o += (grid.topLeft(dest) - o) * rewindProgress }
                if (mv != null && (pos == mv.first || pos == mv.second)) {
                    val d = grid.topLeft(mv.second) - grid.topLeft(mv.first)
                    o += if (pos == mv.first) mv.third + (d - mv.third) * slide.value else -d * slide.value
                }
                if (pos == selected) { o -= Offset(cell * .0175f, cell * .0175f + 5.dp.toPx()); size *= 1.035f; glow = p.shellInk }
                if (pos == dragFrom) { o += dragOffset - Offset(cell * .0225f, cell * .0225f); size *= 1.045f }
                if (pos == rejected) ring = Color(0xFFFFB4A8).copy(alpha = sin(reject.value * Math.PI).toFloat() * .85f)
                if (pos in arrived) ring = (if (p.dark) Color(0xFFF5FFEA) else p.ink).copy(alpha = sin(arrive.value * Math.PI).toFloat() * .65f)
                if (pos == focused && ring == null) ring = p.shellInk.copy(alpha = .9f)
                if (solved && !reduceMotion && solveGlow.value > 0f) {
                    // Solved bloom: each tile swells in turn, ordered by r + c (src/styles.css solvedBloom), with a thin ring of its own colour.
                    val t = solveSwell(bloom.value, r + c)
                    val s = 1f + .035f * sin(t * Math.PI).toFloat()
                    o -= Offset(cell * (s - 1) / 2, cell * (s - 1) / 2); size *= s
                    glow = Art.LIGHT.getValue(type).copy(alpha = SOLVE_RING_ALPHA * solveGlow.value)
                }
                val highlight = if (pos == hover) .1f else 0f
                val draw = { tile(type, o, size, glow, ring, highlight) }
                if (pos == selected || pos == dragFrom || (mv != null && pos == mv.first)) late += draw else draw()
            }
            late.forEach { it() }
        }
        // TalkBack and keyboard: one node per tile, same tap behaviour, with what the tile can do right now and where it belongs.
        if (interactive) for (r in 0 until rows) for (c in 0 until cols) {
            val type = board[r][c]; if (type == '.') continue
            val pos = Pos(r, c)
            val tl = grid.topLeft(pos)
            val legal = Rules.legalMoves(board, pos)
            val moves = when {
                type == 'W' -> tr("carried only")
                legal.isEmpty() -> tr("cannot move right now")
                else -> tr("can move {0}", legal.joinToString(tr(" or ")) { d -> dirWords(d.r - r, d.c - c) })
            }
            val goal = target?.get(r)?.get(c)?.let { if (it == '.') ", " + tr("target: empty") else ", " + tr("target: {0}", Art.name(it)) } ?: ""
            val isSelected = pos == selected
            Box(Modifier.offset { IntOffset(tl.x.roundToInt(), tl.y.roundToInt()) }.size(with(density) { cell.toDp() })
                .onKeyEvent { e -> if (e.type == KeyEventType.KeyUp && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.DirectionCenter || e.key == Key.Spacebar)) { choose(pos); true } else false }
                .onFocusChanged { if (it.isFocused) focused = pos else if (focused == pos) focused = null }
                .focusable()
                .semantics {
                    contentDescription = tr("{0}, row {1}, column {2}", Art.name(type), r + 1, c + 1) + ", $moves$goal"
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
