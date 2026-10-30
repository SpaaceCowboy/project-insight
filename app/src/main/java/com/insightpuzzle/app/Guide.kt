package com.insightpuzzle.app

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

/** What each step of the tips says on a game screen (English keys; [tr] gives the other languages). */
internal fun guideText(step: Int, online: Boolean): String = tr(when (step) {
    1 -> "Drag a tile onto another to swap them."
    2 -> "Hold the board anywhere but on a tile to restart."
    3 -> if (online) "Swipe to move between puzzles." else "Swipe to switch between unlocked levels."
    4 -> if (online) "Tap here to see who made this puzzle." else "Tap here to see your Journey levels."
    else -> "Like a puzzle so others can see it. Bookmark it to save it."
})

/** The creator's tips, step by step for each of its three stages. Building the board has no swipe step: there is no stage before it. */
internal fun creatorGuideSteps(phase: Phase): List<String> = when (phase) {
    Phase.BUILD -> listOf(
        "This is your grid. Drag its corner to resize it.",
        "Pick tiles from the shelf and drag them onto the grid.",
        "Hold the board to clear it.",
        "Press Next when your start position is ready.",
    )
    Phase.SHAPE -> listOf(
        "Move the tiles to find the target you want.",
        "Hold the board to go back to the start position.",
        "Swipe right to go back a stage.",
        "Press Next to keep this target.",
    )
    Phase.CHECK -> listOf(
        "Preview your puzzle: solve it before you create it.",
        "Hold the board to restart the preview.",
        "Swipe right to go back a stage.",
        "Press Create to publish your puzzle.",
    )
}

/** A fat rounded border round [rect], grown by [grow]. [wall] is the height of the key's side wall under [rect]: the border goes round it too, as thick below as above. */
class GuideBox(val rect: Rect, val radius: Dp, val grow: Dp = 0.dp, val wall: Dp = 0.dp)

/** One step of the tips: its sentence and the borders round what it explains. */
class GuideFrame(val text: String, val boxes: List<GuideBox>)

private const val BORDER_OUT_MS = 140
private const val BORDER_IN_MS = 200
private const val TEXT_SWAP_MS = 220

/**
 * The tips: fat light borders round whatever is being explained, one line of text and a "Tap to continue" line. The overlay takes every touch: a tap
 * anywhere moves on ([onTap]), a tap on the lamp ([lamp], in this overlay's coordinates) ends the tips ([onLamp]). [frame] gives any step's text and borders.
 * Between steps the old borders fade away before the new ones fade in, never both at once and never a flash; the text is swapped in place by a crossfade.
 */
@Composable
fun GuideOverlay(step: Int, frame: (Int) -> GuideFrame, textBand: Rect, hintBand: Rect, lamp: Rect?, onLamp: () -> Unit, onTap: () -> Unit) {
    val density = LocalDensity.current
    val reduce = LocalReduceMotion.current
    val p = LocalPalette.current
    val frames by rememberUpdatedState(frame)
    val tap by rememberUpdatedState(onTap)
    val endTips by rememberUpdatedState(onLamp)
    val lampArea by rememberUpdatedState(lamp)
    // The step whose borders are on screen: it changes only once the old borders have faded out.
    var shown by remember { mutableIntStateOf(step) }
    val lit = remember { Animatable(0f) }
    val appear = remember { Animatable(0f) }
    LaunchedEffect(Unit) { if (reduce) appear.snapTo(1f) else appear.animateTo(1f, tween(BORDER_IN_MS)) }
    LaunchedEffect(step) {
        if (lit.value > 0f && !reduce) lit.animateTo(0f, tween(BORDER_OUT_MS))
        shown = step
        if (reduce) lit.snapTo(1f) else lit.animateTo(1f, tween(BORDER_IN_MS))
    }
    Box(Modifier.fillMaxSize()
        .pointerInput(Unit) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                down.consume()
                val onLampKey = lampArea?.contains(down.position) == true
                waitForUpOrCancellation(PointerEventPass.Initial)?.let { it.consume(); if (onLampKey) endTips() else tap() }
            }
        }.semantics { onClick(label = tr("Continue")) { tap(); true } }) {
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = lit.value }) { for (b in frames(shown).boxes) border(b.rect, b.radius.toPx(), b.grow.toPx(), b.wall.toPx()) }
        GuideLine(textBand, Modifier.graphicsLayer { alpha = appear.value }.semantics { liveRegion = LiveRegionMode.Polite }) {
            Crossfade(step, animationSpec = if (reduce) snap() else tween(TEXT_SWAP_MS), label = "guide text") { s ->
                Label(frames(s).text, 14.sp, color = p.ink, weight = FontWeight.SemiBold, align = TextAlign.Center, lines = 2, translate = false)
            }
        }
        GuideLine(hintBand, Modifier.graphicsLayer { alpha = appear.value }) {
            Label(tr("Tap to continue"), 12.sp, color = p.muted, weight = FontWeight.Medium, align = TextAlign.Center, lines = 2, translate = false)
        }
    }
}

/** A line of the tips, centred in [band]. */
@Composable
private fun GuideLine(band: Rect, modifier: Modifier, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    Box(Modifier.offset { IntOffset(band.left.roundToInt(), band.top.roundToInt()) }
        .width(with(density) { band.width.toDp() }).height(with(density) { band.height.toDp() }).then(modifier), contentAlignment = Alignment.Center) { content() }
}

/**
 * The tips on a game screen (Journey or an online puzzle). [shell] is the outline's face, [grid] the tiles' area, [title] the key above the target
 * and [like]/[bookmark] the two keys of an online puzzle, all in this overlay's coordinates (faces only: their side walls are added here). [lamp] is the lamp's touch area.
 */
@Composable
fun GameGuide(m: GameModel, shell: Rect, grid: Rect, title: Rect?, like: Rect?, bookmark: Rect?, lamp: Rect?) {
    val density = LocalDensity.current
    val step = m.guidePhase
    val edge = with(density) { 6.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val bandTop = Rect(shell.left + edge, shell.top + edge, shell.right - edge, grid.top - edge * .5f)
    val bandBottom = Rect(shell.left + edge, grid.bottom + edge * .5f, shell.right - edge, shell.bottom - edge)
    val freeTop = Rect(shell.left, shell.top, shell.right, grid.top)
    // One place for the text in every step, so a new sentence replaces the last one where it stood: the free strip of the outline above the tiles when
    // that is tall enough, else just above the outline (never under the lamp).
    val textBand = freeTop.let { room ->
        val y = if (room.height >= lineHeight + edge * 2) room.top + (room.height - lineHeight) / 2 else shell.top - lineHeight - edge
        Rect(shell.left + inset, y, shell.right - inset, y + lineHeight)
    }
    // "Tap to continue" lives on the lower part of the outline, where a swipe or a hold also works.
    val hintBand = if (bandBottom.height >= with(density) { 28.dp.toPx() }) Rect(bandBottom.left + inset, bandBottom.top, bandBottom.right - inset, bandBottom.bottom)
        else Rect(shell.left + inset, shell.bottom + edge, shell.right - inset, shell.bottom + edge + lineHeight * .6f)
    val online = m.community != null
    fun boxes(s: Int) = when (s) {
        1 -> listOf(GuideBox(grid, 18.dp))
        // Holding works on the whole platform but its tiles: the outline and every empty cell.
        2 -> listOf(GuideBox(shell, 24.dp, 3.dp, BOARD_WALL))
        3 -> listOfNotNull(bandTop.takeIf { it.height > edge * 2 }, bandBottom.takeIf { it.height > edge * 2 }).map { GuideBox(it, 14.dp) }
        4 -> listOfNotNull(title?.let { GuideBox(it, 12.dp, 3.dp, TITLE_WALL) })
        else -> listOfNotNull(like, bookmark).map { GuideBox(it, 16.dp, 3.dp, ICON_WALL) }
    }
    GuideOverlay(step, { s -> GuideFrame(guideText(s, online), boxes(s)) }, textBand, hintBand, lamp, onLamp = { m.endGuide() }) { m.advanceGuide() }
}

/**
 * The tips on the creator screen, step by step for its current stage ([creatorGuideSteps]). [grid] is the outline's face, [corner] the resize handle,
 * [strip] the tile shelf, [button] the stage's button face, [swipe] the band a swipe back starts in.
 */
@Composable
fun CreatorGuide(m: GameModel, phase: Phase, grid: Rect, corner: Rect?, strip: Rect?, button: Rect?, swipe: Rect?, lamp: Rect?) {
    val density = LocalDensity.current
    val edge = with(density) { 6.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val texts = creatorGuideSteps(phase)
    val hold = GuideBox(grid, 24.dp, 3.dp, BOARD_WALL)
    val next = button?.let { GuideBox(it, 14.dp, 3.dp, MENU_WALL) }
    fun boxes(s: Int): List<GuideBox> = when (phase) {
        Phase.BUILD -> when (s) {
            1 -> listOfNotNull(GuideBox(grid, 24.dp, 3.dp, BOARD_WALL), corner?.let { GuideBox(it, 14.dp) })
            2 -> listOfNotNull(strip?.let { GuideBox(it, 16.dp) })
            3 -> listOf(hold)
            else -> listOfNotNull(next)
        }
        else -> when (s) {
            1 -> listOf(GuideBox(grid, 24.dp, 3.dp, BOARD_WALL))
            2 -> listOf(hold)
            3 -> listOfNotNull(swipe?.let { GuideBox(it, 14.dp) })
            else -> listOfNotNull(next)
        }
    }
    // The text in the middle of the outline, the hint at its foot.
    val textBand = Rect(grid.left + inset, grid.center.y - lineHeight / 2, grid.right - inset, grid.center.y + lineHeight / 2)
    val hintBand = Rect(grid.left + inset, grid.bottom - lineHeight * .6f - edge * 2, grid.right - inset, grid.bottom - edge * 2)
    GuideOverlay(m.guidePhase, { s -> GuideFrame(tr(texts.getOrElse(s - 1) { texts.last() }), boxes(s)) }, textBand, hintBand, lamp, onLamp = { m.endGuide() }) { m.advanceGuide() }
}

/** Side walls of the keys the tips frame: the Journey / creator title key, the icon keys, a menu button. */
internal val TITLE_WALL = 2.dp
internal val ICON_WALL = 3.dp
internal val MENU_WALL = 3.dp

/** A fat light border round [rect] and the [wall] under it (a darker rim under it keeps it readable on the light theme). */
private fun DrawScope.border(rect: Rect, radius: Float, grow: Float = 0f, wall: Float = 0f) {
    val at = Offset(rect.left - grow, rect.top - grow); val size = Size(rect.width + grow * 2, rect.height + wall + grow * 2)
    drawRoundRect(Color.Black.copy(alpha = .22f), at, size, CornerRadius(radius), style = Stroke(11.dp.toPx()))
    drawRoundRect(Color.White, at, size, CornerRadius(radius), style = Stroke(7.dp.toPx()))
}
