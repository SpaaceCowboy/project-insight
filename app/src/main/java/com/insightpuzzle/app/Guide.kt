package com.insightpuzzle.app

import androidx.compose.animation.core.Animatable
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
import androidx.compose.runtime.remember
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

/** What each step of the tips says (English keys; [tr] gives the other languages). */
internal fun guideText(step: Int, online: Boolean): String = tr(when (step) {
    1 -> "Drag a tile onto another to swap them."
    2 -> "Hold outside the grid to restart."
    3 -> if (online) "Swipe to move between puzzles." else "Swipe to switch between unlocked levels."
    4 -> if (online) "Tap here to see who made this puzzle." else "Tap here to see your Journey levels."
    else -> "Like a puzzle or bookmark it to find it again."
})

/** A fat rounded border round [rect], grown by [grow]. */
class GuideBox(val rect: Rect, val radius: Dp, val grow: Dp = 0.dp)

/**
 * The tips: fat light borders round whatever is being explained, one line of text and a "Tap to continue" line. The overlay takes every touch and a tap
 * anywhere ends the step ([onTap]), so nothing has to be performed. [textBand] and [hintBand] are the areas (in this overlay's coordinates) where the
 * text and the hint are centred; a new [step] restarts the fade.
 */
@Composable
fun GuideOverlay(step: Int, text: String, boxes: List<GuideBox>, textBand: Rect, hintBand: Rect, onTap: () -> Unit) {
    val density = LocalDensity.current
    val reduce = LocalReduceMotion.current
    val p = LocalPalette.current
    val fade = remember { Animatable(0f) }
    LaunchedEffect(step) { fade.snapTo(0f); if (reduce) fade.snapTo(1f) else fade.animateTo(1f, tween(240)) }
    Box(Modifier.fillMaxSize()
        .pointerInput(Unit) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                down.consume()
                waitForUpOrCancellation(PointerEventPass.Initial)?.let { it.consume(); onTap() }
            }
        }.semantics { onClick(label = tr("Continue")) { onTap(); true } }) {
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = fade.value }) { for (b in boxes) border(b.rect, b.radius.toPx(), b.grow.toPx()) }
        for ((band, line, hint) in listOf(Triple(textBand, text, false), Triple(hintBand, tr("Tap to continue"), true))) {
            Box(Modifier.offset { IntOffset(band.left.roundToInt(), band.top.roundToInt()) }
                .width(with(density) { band.width.toDp() }).height(with(density) { band.height.toDp() })
                .graphicsLayer { alpha = fade.value }.semantics { liveRegion = LiveRegionMode.Polite }, contentAlignment = Alignment.Center) {
                Label(line, if (hint) 12.sp else 14.sp, color = if (hint) p.muted else p.ink, weight = if (hint) FontWeight.Medium else FontWeight.SemiBold, align = TextAlign.Center, lines = 2, translate = false)
            }
        }
    }
}

/**
 * The tips on a game screen (Journey or an online puzzle). [shell] is the outline's rectangle, [grid] the tiles' area, [title] the key above the target
 * and [like]/[bookmark] the two keys of an online puzzle, all in this overlay's coordinates.
 */
@Composable
fun GameGuide(m: GameModel, shell: Rect, grid: Rect, title: Rect?, like: Rect?, bookmark: Rect?) {
    val density = LocalDensity.current
    val step = m.guidePhase
    val edge = with(density) { 6.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val bandTop = Rect(shell.left + edge, shell.top + edge, shell.right - edge, grid.top - edge * .5f)
    val bandBottom = Rect(shell.left + edge, grid.bottom + edge * .5f, shell.right - edge, shell.bottom - edge)
    val freeTop = Rect(shell.left, shell.top, shell.right, grid.top)
    // The text sits in the free strip of the outline above the tiles when that is tall enough, else just above the outline (never under the lamp).
    val textBand = (if (step == 3) bandTop else freeTop).let { room ->
        val y = if (room.height >= lineHeight + edge * 2) room.top + (room.height - lineHeight) / 2 else shell.top - lineHeight - edge
        Rect(shell.left + inset, y, shell.right - inset, y + lineHeight)
    }
    // "Tap to continue" lives on the lower part of the outline, where a swipe or a hold also works.
    val hintBand = if (bandBottom.height >= with(density) { 28.dp.toPx() }) Rect(bandBottom.left + inset, bandBottom.top, bandBottom.right - inset, bandBottom.bottom)
        else Rect(shell.left + inset, shell.bottom + edge, shell.right - inset, shell.bottom + edge + lineHeight * .6f)
    val boxes = when (step) {
        1 -> listOf(GuideBox(grid, 18.dp))
        2 -> listOf(GuideBox(grid, 18.dp), GuideBox(shell, 24.dp, 3.dp))
        3 -> listOfNotNull(bandTop.takeIf { it.height > edge * 2 }, bandBottom.takeIf { it.height > edge * 2 }).map { GuideBox(it, 14.dp) }
        4 -> listOfNotNull(title?.let { GuideBox(it, 14.dp, 3.dp) })
        else -> listOfNotNull(like, bookmark).map { GuideBox(it, 16.dp) }
    }
    GuideOverlay(step, guideText(step, m.community != null), boxes, textBand, hintBand) { m.advanceGuide() }
}

/** The tips on the creator screen: one for each of its three phases, shown from the lamp. [grid] is the outline, [strip] the tile palette or target preview, [button] the phase button. */
@Composable
fun CreatorGuide(phase: Phase, grid: Rect, strip: Rect?, button: Rect?, onDone: () -> Unit) {
    val density = LocalDensity.current
    val edge = with(density) { 6.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val text = when (phase) {
        Phase.BUILD -> "Drag tiles onto the grid to build your start position, then press Start."
        Phase.SHAPE -> "Move the tiles to find the target you want, then press Target."
        Phase.CHECK -> "Preview your puzzle, then press Create."
    }
    val boxes = when (phase) {
        Phase.BUILD -> listOfNotNull(strip?.let { GuideBox(it, 16.dp) }, GuideBox(grid, 24.dp, 3.dp), button?.let { GuideBox(it, 18.dp, 3.dp) })
        Phase.SHAPE -> listOfNotNull(GuideBox(grid, 24.dp, 3.dp), button?.let { GuideBox(it, 18.dp, 3.dp) })
        Phase.CHECK -> listOfNotNull(strip?.let { GuideBox(it, 16.dp) }, button?.let { GuideBox(it, 18.dp, 3.dp) })
    }
    // The text in the middle of the outline, the hint at its foot.
    val textBand = Rect(grid.left + inset, grid.center.y - lineHeight / 2, grid.right - inset, grid.center.y + lineHeight / 2)
    val hintBand = Rect(grid.left + inset, grid.bottom - lineHeight * .6f - edge * 2, grid.right - inset, grid.bottom - edge * 2)
    GuideOverlay(phase.ordinal + 1, tr(text), boxes, textBand, hintBand, onDone)
}

/** A fat light border round [rect] (a darker rim under it keeps it readable on the light theme). */
private fun DrawScope.border(rect: Rect, radius: Float, grow: Float = 0f) {
    val at = Offset(rect.left - grow, rect.top - grow); val size = Size(rect.width + grow * 2, rect.height + grow * 2)
    drawRoundRect(Color.Black.copy(alpha = .22f), at, size, CornerRadius(radius), style = Stroke(11.dp.toPx()))
    drawRoundRect(Color.White, at, size, CornerRadius(radius), style = Stroke(7.dp.toPx()))
}
