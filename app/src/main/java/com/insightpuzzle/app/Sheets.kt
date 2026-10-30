package com.insightpuzzle.app

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.clearAndSetSemantics
import kotlinx.coroutines.launch

/** One screen that rises from the bottom: [progress] is 1 when it covers the screen and 0 when it is below the edge. */
class SheetHandle(start: Float) {
    val progress = Animatable(start)
    var height = 1f
    /** False once its screen has left the stack and is only sinking away. */
    var live = true
}

/** The sheet the composable is drawn in; null on Home, which does not slide. */
val LocalSheet = staticCompositionLocalOf<SheetHandle?> { null }

/** The game and its win bar are one screen. */
private fun slot(route: Route): Route = if (route == Route.Win) Route.Game else route

/** Every screen but Home rises from the bottom over the one it was opened from, and sinks back on Back (sign-in included, with its chevron draggable too). */
internal fun rises(route: Route) = route != Route.Home

private val SheetMotion = tween<Float>(320, easing = FastOutSlowInEasing)
/** As round as the big buttons and then some, so it reads while a sheet is dragged down or rising. */
private val SHEET_CORNER = 28.dp
/** The corners are fully round until a sheet is this close (as a fraction of its travel) to covering the screen, then straighten. */
private const val SHEET_STRAIGHTEN = .02f
/** A sheet on the move casts a soft shadow so its curved top corners show against a screen of the same colour. The screen under it is not dimmed: that read as a sudden darkening of the whole screen on every open and Back. */
private val SHEET_SHADOW = 20.dp
private const val SHEET_DIM = 0f

/** What the last composition showed, so a screen counts as newly opened only after the first one (not when the activity is recreated). */
private class NavMemory { var stack = emptyList<Route>(); var started = false }

/**
 * The screens, as layers drawn in the order they were opened. A screen that leaves the stack stays on top, sliding down, until it is below the edge;
 * that is what lets it cover the screen it reveals (Home's buttons included). Only the top screen is composed once it has settled;
 * the one beneath is composed only while the top one is moving or being dragged.
 */
@Composable
fun Screens(m: GameModel) {
    val reduce = LocalReduceMotion.current
    val stack = m.stack.map(::slot).asReversed().distinct().asReversed()
    val top = stack.last()
    val memory = remember { NavMemory() }
    val handles = remember { mutableMapOf<Route, SheetHandle>() }
    val leaving = remember { mutableStateListOf<Route>() }
    // Only a screen pushed on top of the one that was showing rises in. When the old top left the stack instead (a level picked from Journey,
    // Back to Home), the new top is just revealed under the departing one. Signing in pops the sign-in sheet and opens where the player was going: that
    // screen is simply revealed as sign-in sinks away.
    val pushed = memory.started && memory.stack.lastOrNull()?.let { it in stack || !rises(it) } == true
    fun handleFor(route: Route) = handles.getOrPut(route) { SheetHandle(if (rises(route) && !reduce && pushed && route == top && route !in memory.stack) 0f else 1f) }
    val topHandle = handleFor(top)
    val covering by remember(topHandle) { derivedStateOf { topHandle.progress.value < 1f } }
    val below = stack.getOrNull(stack.size - 2)
    val shown = listOfNotNull(below?.takeIf { covering }, top)
    // Screens that were up a moment ago and are gone from the stack: they slide down over the new top.
    val departed = memory.stack.filter { it !in stack && it !in leaving && rises(it) && !reduce && it in handles }
    val order = shown + (leaving + departed).filter { it !in shown }.distinct()
    SideEffect {
        leaving.removeAll { it in stack }
        leaving.addAll(departed.filter { it !in leaving })
        memory.stack = stack; memory.started = true
        handles.keys.retainAll(order.toSet())
    }
    for (route in order) key(route) {
        Layer(route, handleFor(route), exiting = route !in stack, covered = route != top, reduce, onGone = { leaving.remove(route) }, dim = {
            // A screen under a sheet that is moving darkens in step with it.
            if (route !in stack) 0f
            else (1f - (order.filter { it != route && (it !in stack || it == top) }.mapNotNull { handles[it]?.progress?.value }.minOrNull() ?: 1f)) * SHEET_DIM
        }) { RouteContent(m, route) }
    }
}

@Composable
private fun Layer(route: Route, handle: SheetHandle, exiting: Boolean, covered: Boolean, reduce: Boolean, onGone: () -> Unit, dim: () -> Float, content: @Composable () -> Unit) {
    SideEffect { handle.live = !exiting }
    LaunchedEffect(exiting, reduce) {
        val spec = if (reduce) snap<Float>() else SheetMotion
        if (exiting) { handle.progress.animateTo(0f, spec); onGone() }
        else if (handle.progress.value < 1f) handle.progress.animateTo(1f, spec)
    }
    Box(
        Modifier.fillMaxSize()
            .graphicsLayer {
                val progress = handle.progress.value
                translationY = (1f - progress) * size.height
                // A sheet on the move has rounded top corners like the buttons; they straighten over the last of the rise so a covering sheet is square.
                val corner = SHEET_CORNER.toPx() * ((1f - progress) / SHEET_STRAIGHTEN).coerceIn(0f, 1f)
                if (corner > 0f && route != Route.Home) {
                    shape = RoundedCornerShape(corner, corner, 0f, 0f); clip = true
                    shadowElevation = SHEET_SHADOW.toPx() * (corner / SHEET_CORNER.toPx())
                    ambientShadowColor = Color.Black; spotShadowColor = Color.Black
                } else { clip = false; shadowElevation = 0f }
            }
            .drawWithContent { drawContent(); dim().let { if (it > 0f) drawRect(Color.Black.copy(alpha = it)) } }
            .onSizeChanged { handle.height = it.height.toFloat() }
            // A screen under another one is neither touched nor read out; the empty pointer input stops touches falling through.
            // A screen on its way out takes no touches at all, so a second tap cannot go Back twice.
            .then(if (covered) Modifier.clearAndSetSemantics { } else Modifier)
            .then(when {
                exiting -> Modifier.pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } } }
                route != Route.Home -> Modifier.pointerInput(Unit) { }
                else -> Modifier
            }),
    ) {
        CompositionLocalProvider(LocalSheet provides handle.takeIf { rises(route) }) {
            // A rising screen carries its own page background, so the screen beneath never shows through while it moves.
            if (route == Route.Home) content() else Backdrop { content() }
        }
    }
}

@Composable
private fun RouteContent(m: GameModel, route: Route) {
    when (route) {
        Route.Home -> HomeScreen(m)
        Route.Levels -> LevelsScreen(m)
        Route.Game, Route.Win -> GameScreen(m)
        Route.Options -> OptionsScreen(m)
        Route.Achievements -> AchievementsScreen(m)
        Route.Online -> WorldsScreen(m)
        Route.Create -> CreatorScreen(m)
        is Route.Auth -> AuthScreen(m, route.destination)
        is Route.Profile -> ProfileScreen(m, route.id)
        Route.Bookmarks -> BookmarksScreen(m)
        is Route.Players -> PlayersScreen(m, route.kind)
        is Route.Feedback -> FeedbackScreen(m, route.kind)
        Route.Licences -> LicencesScreen(m)
    }
}

/**
 * Lets the Back chevron be pulled down: the screen follows the finger, revealing the one beneath, and sinks away when let go past the middle or flung;
 * otherwise it springs back. A tap is left to the button. Does nothing on screens that do not slide.
 */
@Composable
fun Modifier.sheetDrag(m: GameModel): Modifier {
    val sheet = LocalSheet.current ?: return this
    val scope = rememberCoroutineScope()
    val feedback = LocalFeedback.current
    var box by remember { mutableStateOf<LayoutCoordinates?>(null) }
    return this.onGloballyPositioned { box = it }.pointerInput(sheet) {
        awaitEachGesture {
            // Positions are read in the window's frame: the chevron moves with the screen, so its own frame would swallow the drag.
            fun rootY(position: Offset) = box?.takeIf { it.isAttached }?.localToRoot(position)?.y
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            if (!sheet.live) return@awaitEachGesture
            val startY = rootY(down.position) ?: return@awaitEachGesture
            val slop = viewConfiguration.touchSlop
            val tracker = VelocityTracker()
            var dragging = false
            while (true) {
                val change = awaitPointerEvent(PointerEventPass.Initial).changes.firstOrNull { it.id == down.id } ?: break
                val y = rootY(change.position) ?: break
                tracker.addPosition(change.uptimeMillis, Offset(0f, y))
                if (!dragging && y - startY > slop) dragging = true
                if (dragging) change.consume()
                if (dragging && change.pressed) {
                    val to = (1f - (y - startY - slop) / sheet.height).coerceIn(0f, 1f)
                    scope.launch { sheet.progress.snapTo(to) }
                } else if (!change.pressed) {
                    if (dragging) {
                        val fling = tracker.calculateVelocity().y
                        scope.launch {
                            if (sheet.progress.value < .6f || fling > 1800f) {
                                sheet.progress.animateTo(0f, tween(160))
                                feedback(Cue.BACK)
                                val depth = m.stack.size; val before = m.top
                                m.back()
                                // Back may only have stepped back inside the screen (the creator's phases): then it comes back up.
                                if (m.stack.size == depth && m.top == before) sheet.progress.animateTo(1f, spring(dampingRatio = .8f, stiffness = 400f))
                            } else sheet.progress.animateTo(1f, spring(dampingRatio = .8f, stiffness = 400f))
                        }
                    }
                    break
                }
            }
        }
    }
}
