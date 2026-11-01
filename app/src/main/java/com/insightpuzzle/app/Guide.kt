package com.insightpuzzle.app

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.shadow
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
internal fun guideText(step: Int, online: Boolean, own: Boolean = false): String = tr(when (step) {
    1 -> "Drag a tile onto another to swap them."
    2 -> "Hold the board anywhere but on a tile to restart."
    3 -> if (online) "Swipe to move between puzzles." else "Swipe to switch between unlocked levels."
    4 -> if (online) "Tap here to see who made this puzzle." else "Tap here to see your Journey levels."
    6 -> "Your goal is to make the board match this target."
    // Your own puzzle has no like key, so only the bookmark is explained.
    else -> if (own) "Bookmark a puzzle to save it." else "Like a puzzle so others can see it. Bookmark it to save it."
})

/** Journey's extra step: the target to reach (step 6, shown right after the first step). */
internal const val GUIDE_TARGET_STEP = 6

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
        "Hold the board to restart.",
        "Swipe right to go back a stage.",
        "Press Next to keep this target.",
    )
    Phase.CHECK -> listOf(
        "Preview your puzzle: solve it before you create it.",
        "Hold the board to restart the preview.",
        "Swipe right to go back a stage.",
        "Press on the button to create your puzzle.",
    )
}

/** A fat rounded border round [rect], grown by [grow]. [wall] is the height of the key's side wall under [rect]: the border goes round it too, as thick below as above. */
class GuideBox(val rect: Rect, val radius: Dp, val grow: Dp = 0.dp, val wall: Dp = 0.dp)

/** One step of the tips: its sentence and the borders round what it explains. */
class GuideFrame(val text: String, val boxes: List<GuideBox>)

private const val BORDER_OUT_MS = 140
private const val BORDER_IN_MS = 200

/**
 * The tips: fat borders round whatever is being explained (light on the dark theme, dark on the light one), the text and a "Tap to continue" line. The overlay takes
 * every touch: a tap anywhere moves on ([onTap]), a tap on the lamp ([lamp], in this overlay's coordinates) ends the tips ([onLamp]); both are felt and heard like any
 * other key. A tap inside [deadZone] (the board while a step talks about moving tiles) does nothing, so it can't be mistaken for a move. [frame] gives any step's
 * text and borders. Between steps the old borders fade away before the new ones fade in, never both at once and never a flash; the text is swapped in place.
 * A line that has no free strip of the outline to sit in ([textBacked], [hintBacked]) comes on a rounded plate instead, so it reads over whatever tiles are under it;
 * those plates are the same size and the same font for every [steps] entry, so they follow each other without a jump. [textSize] is the largest font a step's text may have;
 * every text shrinks until all of it fits (nothing is cut off).
 */
@Composable
fun GuideOverlay(step: Int, steps: List<Int>, frame: (Int) -> GuideFrame, textBand: Rect, hintBand: Rect, lamp: Rect?, onLamp: () -> Unit, textBacked: Boolean = false, hintBacked: Boolean = false,
                 textSize: (Int) -> Float = { 14f }, deadZone: (Int) -> Rect? = { null }, onTap: () -> Unit) {
    val reduce = LocalReduceMotion.current
    val p = LocalPalette.current
    val frames by rememberUpdatedState(frame)
    val tap by rememberUpdatedState(onTap)
    val endTips by rememberUpdatedState(onLamp)
    val lampArea by rememberUpdatedState(lamp)
    val dead by rememberUpdatedState(deadZone(step))
    val feedback by rememberUpdatedState(LocalFeedback.current)
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
                waitForUpOrCancellation(PointerEventPass.Initial)?.let {
                    it.consume()
                    if (onLampKey) { feedback(Cue.TOGGLE_OFF); endTips() }
                    else if (dead?.contains(down.position) == true) Unit
                    else { feedback(Cue.FORWARD); tap() }
                }
            }
        }.semantics { onClick(label = tr("Continue")) { tap(); true } }) {
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = lit.value }) { for (b in frames(shown).boxes) border(b.rect, b.radius.toPx(), b.grow.toPx(), b.wall.toPx(), p.dark, p.ink) }
        GuideLine(textBand, Modifier.graphicsLayer { alpha = appear.value }.semantics { liveRegion = LiveRegionMode.Polite }) {
            val text = frames(step).text
            if (textBacked) GuideLabel(text, textBand, steps.minOf(textSize), p.ink, FontWeight.SemiBold, true, steps.map { frames(it).text })
            else GuideLabel(text, textBand, textSize(step), p.ink, FontWeight.SemiBold, false)
        }
        GuideLine(hintBand, Modifier.graphicsLayer { alpha = appear.value }) {
            GuideLabel(tr("Tap to continue"), hintBand, 12f, p.muted, FontWeight.Medium, hintBacked)
        }
    }
}

/**
 * A line of the tips that always shows whole: the largest font up to [maxSp] at which it fits [band] (the font is monospaced, so the lines it breaks into are counted
 * exactly), then as many lines as that takes. On a rounded plate when [backed]: the plate fills [band] whatever it says, and its font is the smallest any of [sizing]
 * needs, so a run of plates never changes size.
 */
@Composable
private fun GuideLabel(text: String, band: Rect, maxSp: Float, color: Color, weight: FontWeight, backed: Boolean, sizing: List<String> = listOf(text)) {
    val density = LocalDensity.current
    val p = LocalPalette.current
    val scale = density.fontScale
    val room = with(density) { Size(band.width.toDp().value - if (backed) 24f else 0f, band.height.toDp().value - if (backed) 8f else 0f) }
    fun fit(t: String): Float {
        var size = maxSp
        while (size > MIN_GUIDE_SP) {
            val perLine = (room.width / (size * scale * .62f)).toInt().coerceAtLeast(1)
            if (monoLines(t, perLine) * size * scale * 1.2f <= room.height) break
            size -= .5f
        }
        return size
    }
    val size = sizing.minOf { fit(it) }
    val label = @Composable { Label(text, size.sp, Modifier.wrapContentHeight(Alignment.CenterVertically, unbounded = true), color = color, weight = weight, align = TextAlign.Center, translate = false) }
    if (!backed) label() else {
        val shape = RoundedCornerShape(12.dp)
        Box(Modifier.fillMaxSize().shadow(4.dp, shape, clip = false).background(p.paper2, shape).padding(horizontal = 12.dp, vertical = 4.dp), contentAlignment = Alignment.Center) { label() }
    }
}

private const val MIN_GUIDE_SP = 9f

/** How many lines [text] takes in a monospaced font when [perLine] characters fit a line (words are not split unless one is longer than a line). */
internal fun monoLines(text: String, perLine: Int): Int {
    var lines = 1; var used = 0
    for (word in text.split(' ')) {
        if (used == 0) used = word.length
        else if (used + 1 + word.length <= perLine) used += 1 + word.length
        else { lines++; used = word.length }
        while (used > perLine) { lines++; used -= perLine }
    }
    return lines
}

/** A line of the tips, centred in [band]. */
@Composable
private fun GuideLine(band: Rect, modifier: Modifier, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    Box(Modifier.offset { IntOffset(band.left.roundToInt(), band.top.roundToInt()) }
        .width(with(density) { band.width.toDp() }).height(with(density) { band.height.toDp() }).then(modifier), contentAlignment = Alignment.Center) { content() }
}

/**
 * The tips on a game screen (Journey or an online puzzle). [shell] is the outline's face, [grid] the tiles' area, [title] the key above the target,
 * [target] the target above the outline (Journey only) and [like]/[bookmark] the two keys of an online puzzle, all in this overlay's coordinates (faces only: their
 * side walls are added here). [own]: it is your own puzzle, which has no like key. [lamp] is the lamp's touch area.
 */
@Composable
fun GameGuide(m: GameModel, shell: Rect, grid: Rect, title: Rect?, like: Rect?, bookmark: Rect?, target: Rect?, own: Boolean, lamp: Rect?) {
    val density = LocalDensity.current
    val step = m.guidePhase
    val edge = with(density) { 6.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val bandTop = Rect(shell.left + edge, shell.top + edge, shell.right - edge, grid.top - edge * .5f)
    val bandBottom = Rect(shell.left + edge, grid.bottom + edge * .5f, shell.right - edge, shell.bottom - edge)
    val freeTop = Rect(shell.left, shell.top, shell.right, grid.top)
    // No free strip above the tiles (a tall grid fills the outline): the text sits above the outline on a plate, and the hint on a plate above that.
    val textBacked = freeTop.height < lineHeight + edge * 2
    val hintBacked = bandBottom.height < with(density) { 28.dp.toPx() }
    // One place for the text in every step, so a new sentence replaces the last one where it stood: the free strip of the outline above the tiles when
    // that is tall enough, else just above the outline (never under the lamp).
    val textBand = freeTop.let { room ->
        val y = if (!textBacked) room.top + (room.height - lineHeight) / 2 else shell.top - lineHeight - edge
        Rect(shell.left + inset, y, shell.right - inset, y + lineHeight)
    }
    // "Tap to continue" lives on the lower part of the outline, where a swipe or a hold also works; with no room there it is a plate above the text.
    val hintBand = if (!hintBacked) Rect(bandBottom.left + inset, bandBottom.top, bandBottom.right - inset, bandBottom.bottom)
        else (if (textBacked) textBand.top else shell.top).let { top -> Rect(shell.left + inset, top - edge - lineHeight * .6f, shell.right - inset, top - edge) }
    val online = m.community != null
    // The tiles' side walls hang below their faces; the border of the first step goes round them too, so it never touches them.
    val rows = m.board.size.coerceAtLeast(1)
    val gap = with(density) { 5.dp.toPx() }
    val cell = ((grid.height - gap * (rows + 1)) / rows).coerceAtLeast(0f)
    val tileWall = (with(density) { (cell * .095f).toDp() } - 1.dp).coerceAtLeast(0.dp)
    fun boxes(s: Int) = when (s) {
        1 -> listOf(GuideBox(grid, 18.dp, wall = tileWall))
        GUIDE_TARGET_STEP -> listOfNotNull(target?.let { GuideBox(it, 14.dp, 6.dp) })
        // Holding works on the whole platform but its tiles: the outline and every empty cell.
        2 -> listOf(GuideBox(shell, 24.dp, 3.dp, BOARD_WALL))
        // A swipe starts anywhere off the tiles; with no room above and below them, the whole outline stands for it (the border may cross tiles).
        3 -> if (bandTop.height > edge * 2 && bandBottom.height > edge * 2) listOf(bandTop, bandBottom).map { GuideBox(it, 14.dp) }
            else listOf(GuideBox(Rect(shell.left + edge, shell.top + edge, shell.right - edge, shell.bottom - edge), 14.dp))
        4 -> listOfNotNull(title?.let { GuideBox(it, 12.dp, 3.dp, TITLE_WALL) })
        else -> listOfNotNull(like, bookmark).map { GuideBox(it, 16.dp, 3.dp, ICON_WALL) }
    }
    // The like-and-bookmark sentence is the longest, so it starts smaller.
    GuideOverlay(step, m.guideSteps(), { s -> GuideFrame(guideText(s, online, own), boxes(s)) }, textBand, hintBand, lamp, onLamp = { m.endGuide() }, textBacked = textBacked, hintBacked = hintBacked,
        textSize = { if (it == 5 && !own) 12f else 14f }, deadZone = { if (it == 1) grid else null }) { m.advanceGuide() }
}

/**
 * The tips on the creator screen, step by step for its current stage ([creatorGuideSteps]). [grid] is the outline's face, [tiles] the area of its cells, [corner] the
 * resize handle, [strip] the tile shelf, [button] the stage's button face, [swipe] the bands a swipe back starts in (however thin).
 */
@Composable
fun CreatorGuide(m: GameModel, phase: Phase, grid: Rect, tiles: Rect?, corner: Rect?, strip: Rect?, button: Rect?, swipe: List<Rect>, lamp: Rect?) {
    val density = LocalDensity.current
    val edge = with(density) { 6.dp.toPx() }
    val inset = with(density) { 56.dp.toPx() }
    val lineHeight = with(density) { 44.dp.toPx() }
    val texts = creatorGuideSteps(phase)
    // The outline's border hugs its face, wall left out: the button is 12dp below, and the fat border (with its rim) must not reach it.
    val hold = GuideBox(grid, 24.dp)
    // The button's border leaves a sliver of the page round the key on every side: 4dp above and beside it, and the same under the wall (2dp of wall, 4dp of border).
    val next = button?.let { GuideBox(it, 14.dp, 4.dp, 2.dp) }
    // The shelf of tiles: well inside the page's edges, so the border never touches the keys and outline beside and below it.
    val shelf = strip?.let { GuideBox(Rect(it.left + 4 * density.density, it.top + 10 * density.density, it.right - 4 * density.density, it.bottom - 10 * density.density), 16.dp) }
    // A swipe back starts anywhere off the cells; when a band above or below them is too thin to frame, the whole outline stands for it.
    val swipeBoxes = if (swipe.isNotEmpty() && swipe.all { it.height > 12 * density.density }) swipe.map { GuideBox(it, 14.dp) }
        else listOf(GuideBox(Rect(grid.left + edge, grid.top + edge, grid.right - edge, grid.bottom - edge), 14.dp))
    fun boxes(s: Int): List<GuideBox> = when (phase) {
        Phase.BUILD -> when (s) {
            1 -> listOfNotNull(hold, corner?.let { GuideBox(it, 14.dp) })
            2 -> listOfNotNull(shelf)
            3 -> listOf(hold)
            else -> listOfNotNull(next)
        }
        else -> when (s) {
            1 -> listOf(hold)
            2 -> listOf(hold)
            3 -> swipeBoxes
            else -> listOfNotNull(next)
        }
    }
    // The text at the top of the outline, like the game's tips, and the hint at its foot. With no free strip of the outline for them (the cells fill it) they sit above
    // it, on plates (the hint's above the text's). The stage's own note ("Place at least two tiles first.") gives way to the tips while they show.
    val freeTop = tiles?.let { Rect(grid.left, grid.top, grid.right, it.top) } ?: Rect(grid.left, grid.top, grid.right, grid.top + lineHeight + edge * 2)
    val textBacked = freeTop.height < lineHeight + edge * 2
    val textY = if (textBacked) grid.top - lineHeight - edge else freeTop.top + (freeTop.height - lineHeight) / 2
    val textBand = Rect(grid.left + inset, textY, grid.right - inset, textY + lineHeight)
    val footer = tiles?.let { Rect(grid.left + edge, it.bottom + edge * .5f, grid.right - edge, grid.bottom - edge) }
    val hintBacked = footer == null || footer.height < with(density) { 28.dp.toPx() }
    val hintBand = if (!hintBacked) Rect(footer!!.left + inset, footer.top, footer.right - inset, footer.bottom)
        else (if (textBacked) textBand.top else grid.top).let { top -> Rect(grid.left + inset, top - edge - lineHeight * .6f, grid.right - inset, top - edge) }
    // The first step of the second and third stage talks about moving tiles: a tap on the cells must not look like a move, so it does nothing.
    GuideOverlay(m.guidePhase, (1..texts.size).toList(), { s -> GuideFrame(tr(texts.getOrElse(s - 1) { texts.last() }), boxes(s)) }, textBand, hintBand, lamp, onLamp = { m.endGuide() },
        textBacked = textBacked, hintBacked = hintBacked, deadZone = { if (it == 1 && phase != Phase.BUILD) tiles else null }) { m.advanceGuide() }
}

/** Side walls of the keys the tips frame: the Journey / creator title key, the icon keys, a menu button. */
internal val TITLE_WALL = 2.dp
internal val ICON_WALL = 3.dp
internal val MENU_WALL = 3.dp

/**
 * A fat border round [rect] and the [wall] under it: white with a faint dark rim on the dark theme, plain [ink] (dark) on the light one, where white would vanish
 * and a rim would only muddy it.
 */
private fun DrawScope.border(rect: Rect, radius: Float, grow: Float, wall: Float, dark: Boolean, ink: Color) {
    val at = Offset(rect.left - grow, rect.top - grow); val size = Size(rect.width + grow * 2, rect.height + wall + grow * 2)
    if (dark) {
        drawRoundRect(Color.Black.copy(alpha = .22f), at, size, CornerRadius(radius), style = Stroke(11.dp.toPx()))
        drawRoundRect(Color.White, at, size, CornerRadius(radius), style = Stroke(7.dp.toPx()))
    } else drawRoundRect(ink, at, size, CornerRadius(radius), style = Stroke(7.dp.toPx()))
}
