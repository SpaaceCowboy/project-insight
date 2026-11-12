package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

// Tile symbols from src/tile-art.js, as polylines in a 48x48 box: each arrow is a shaft plus one chevron per head (arm, tip, arm). They are stroked as ONE path
// (see [symbol]), so where a shaft meets its chevron the paint is laid once: no double-dark seams on translucent ink, and the tip is a true round joint.
private val LINES: Map<Char, List<FloatArray>> = mapOf(
    'R' to listOf(f(24, 8, 24, 40), f(17, 15, 24, 8, 31, 15), f(17, 33, 24, 40, 31, 33)),
    'B' to listOf(f(8, 24, 40, 24), f(15, 17, 8, 24, 15, 31), f(33, 17, 40, 24, 33, 31)),
    'G' to listOf(f(12.69, 35.31, 35.31, 12.69), f(25.41, 12.69, 35.31, 12.69, 35.31, 22.59), f(22.59, 35.31, 12.69, 35.31, 12.69, 25.41)),
    'Y' to listOf(f(12.69, 12.69, 35.31, 35.31), f(22.59, 12.69, 12.69, 12.69, 12.69, 22.59), f(25.41, 35.31, 35.31, 35.31, 35.31, 25.41)),
    'W' to listOf(f(24, 6, 24, 14), f(24, 34, 24, 42), f(6, 24, 14, 24), f(34, 24, 42, 24)),
    'P' to listOf(
        f(24, 8, 24, 40), f(8, 24, 40, 24),
        f(18, 14, 24, 8, 30, 14), f(18, 34, 24, 40, 30, 34),
        f(14, 18, 8, 24, 14, 30), f(34, 18, 40, 24, 34, 30),
        // A diamond (a square turned on its corner) at the centre: its corners are midway between the centre and each arrow's tip.
        f(24, 16, 32, 24, 24, 32, 16, 24, 24, 16),
    ),
)
private fun f(vararg v: Number) = FloatArray(v.size) { v[it].toFloat() }
private val WHITE_INK = Color(0xFF45474C)

/** Draws the tile symbol centred in [size] at [scale] of the box (the web game uses 44% on board tiles). [weight] scales the stroke. */
fun DrawScope.symbol(type: Char, origin: Offset, size: Float, scale: Float, color: Color = if (type == 'W') WHITE_INK else Color.White, weight: Float = 1f) {
    val box = size * scale; val unit = box / 48f
    val left = origin.x + (size - box) / 2; val top = origin.y + (size - box) / 2
    val width = weight * unit * when (type) { 'P' -> 3.1f; 'W' -> 3.8f; else -> 4.2f }
    val path = androidx.compose.ui.graphics.Path()
    if (type == 'W') path.addOval(androidx.compose.ui.geometry.Rect(Offset(left + 14 * unit, top + 14 * unit), Size(20 * unit, 20 * unit)))
    for (line in LINES.getValue(type)) {
        path.moveTo(left + line[0] * unit, top + line[1] * unit)
        for (i in 2 until line.size step 2) path.lineTo(left + line[i] * unit, top + line[i + 1] * unit)
    }
    drawPath(path, color, style = Stroke(width, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
}

/**
 * The game tile: gradient body on a raised side, soft shadow and a restrained satin sheen. Tiles are only ever dragged, never pressed.
 * [glow] adds the selection ring; [ring] draws a coloured outline (arrival, rejection).
 */
fun DrawScope.tile(type: Char, origin: Offset, size: Float, glow: Color? = null, ring: Color? = null, highlight: Float = 0f) {
    val radius = CornerRadius(size * .23f)
    val (light, deep) = Art.TILE.getValue(type)
    // Raised like the app's keys: a soft shadow on the platform, a darker side showing under the face, then the face. Smaller than the gap between tiles, so a side never reaches the next row.
    val depth = size * .055f
    drawRoundRect(Color(0x33000000), origin + Offset(0f, depth + size * .04f), Size(size, size), radius)
    drawRoundRect(androidx.compose.ui.graphics.lerp(deep, Color.Black, .4f), origin + Offset(0f, depth), Size(size, size), radius)
    val angle = Math.toRadians(145.0 - 90.0)
    val dx = (cos(angle) * size / 2).toFloat(); val dy = (sin(angle) * size / 2).toFloat()
    val center = origin + Offset(size / 2, size / 2)
    drawRoundRect(Brush.linearGradient(listOf(light, deep), center - Offset(dx, dy), center + Offset(dx, dy)), origin, Size(size, size), radius)
    // The colour-blind palette keeps its exact colours: only a faint sheen.
    val sheen = if (Art.colorblind) listOf(Color.White.copy(alpha = .08f), Color.Transparent, Color(0x14000000)) else listOf(Color.White.copy(alpha = .28f), Color.Transparent, Color(0x29000000))
    drawRoundRect(Brush.linearGradient(sheen, origin, origin + Offset(size, size)), origin, Size(size, size), radius)
    if (highlight > 0f) drawRoundRect(Color.White.copy(alpha = highlight), origin, Size(size, size), radius)
    val rim = plushRim(light)
    if (Art.plush) {
        // A soft light rim just inside the face's edge, the tile's own colour washed towards white: brighter at the top left where the light falls, a touch
        // deeper at the bottom right, so the tile reads as a plump cushion.
        val w = size * PLUSH_RIM
        drawRoundRect(Brush.linearGradient(listOf(rim, androidx.compose.ui.graphics.lerp(rim, light, .45f)), origin, origin + Offset(size, size)),
            origin + Offset(w / 2, w / 2), Size(size - w, size - w), CornerRadius(size * .23f - w / 2), style = Stroke(w))
    } else drawRoundRect(Color(0x73FFFFFF), origin, Size(size, size), radius, style = Stroke(1.5f))
    // The selection ring alone: no halo around it.
    if (glow != null) drawRoundRect(glow, origin - Offset(2.5f, 2.5f), Size(size + 5f, size + 5f), CornerRadius(size * .23f + 2.5f), style = Stroke(3.5f))
    if (ring != null) drawRoundRect(ring, origin - Offset(2f, 2f), Size(size + 4f, size + 4f), CornerRadius(size * .23f + 2f), style = Stroke(4f))
    // Every arrow is cut into the face rather than drawn on it. Light ink (most tiles) falls in shadow along its upper edge; dark ink (the pale tiles: white, and
    // yellow and pink in the colour-blind palette) catches a highlight along its lower edge instead.
    val ink = Art.ink(type)
    val weight = if (type == 'W') 1f else ETCH_WEIGHT
    if (ink == Color.White) {
        symbol(type, origin - Offset(0f, size * .012f), size, .44f, Color.Black.copy(alpha = .2f), weight)
        symbol(type, origin, size, .44f, plushInk(type, rim).copy(alpha = .9f), weight)
    } else {
        symbol(type, origin + Offset(0f, size * .012f), size, .44f, Color.White.copy(alpha = .7f), weight)
        symbol(type, origin, size, .44f, ink.copy(alpha = .92f), weight)
    }
}

/** The plush style's rim colour for a tile whose face starts at [light]: that colour washed most of the way to white. */
internal fun plushRim(light: Color): Color = androidx.compose.ui.graphics.lerp(light, Color.White, .5f)
/** How wide the plush rim is, as a share of the tile. */
internal const val PLUSH_RIM = .06f

/**
 * The white of the arrows. In the plush style (standard palette only; the colour-blind palette keeps pure white for legibility) it leans a hair towards the rim
 * and a hair darker, as if the etched mark caught a little less light: still white, only a softer one. The white tile's dark mark never changes.
 */
internal fun plushInk(type: Char, rim: Color): Color =
    if (!Art.plush || Art.colorblind || type == 'W') Color.White
    else androidx.compose.ui.graphics.lerp(androidx.compose.ui.graphics.lerp(Color.White, rim, PLUSH_INK_TINT), Color.Black, PLUSH_INK_SHADE)
internal const val PLUSH_INK_TINT = .08f
internal const val PLUSH_INK_SHADE = .03f

/** Arrows on coloured tiles are a little finer than the original strokes. */
private const val ETCH_WEIGHT = .78f

/** A standalone tile (palette, hero) of [size]. */
@Composable
fun TileIcon(type: Char, size: Dp, modifier: Modifier = Modifier, glow: Color? = null) {
    Canvas(modifier.size(size)) { tile(type, Offset.Zero, this.size.width, glow) }
}

/** One flat target square, shared by [TargetMini] and the swipe's [MorphTarget]. */
internal fun DrawScope.targetSquare(type: Char, origin: Offset, cell: Float, dark: Boolean, alpha: Float = 1f) {
    if (alpha <= 0f) return
    val radius = CornerRadius(cell * .25f)
    if (dark) drawRoundRect(Art.LIGHT.getValue(type).copy(alpha = alpha), origin, Size(cell, cell), radius)
    else {
        val deep = Art.TILE.getValue(type).second
        drawRoundRect(androidx.compose.ui.graphics.lerp(Art.LIGHT.getValue(type), deep, .35f).copy(alpha = alpha), origin, Size(cell, cell), radius)
        drawRoundRect(deep.copy(alpha = .55f * alpha), origin + Offset(.5f, .5f), Size(cell - 1f, cell - 1f), radius, style = Stroke(1f))
    }
}

/**
 * Mini target preview: flat colour squares, no arrows (only the main board shows symbols); holes stay empty.
 * On the light theme's cream cards the pale colours would vanish, so there each square is a deeper mid-tone with a fine darker edge.
 */
@Composable
fun TargetMini(board: Board, cell: Dp, gap: Dp, modifier: Modifier = Modifier, symbols: Boolean = false) {
    val rows = board.size; val cols = board.firstOrNull()?.length ?: 0
    val dark = LocalPalette.current.dark
    Canvas(modifier.size(cell * cols + gap * (cols - 1).coerceAtLeast(0), cell * rows + gap * (rows - 1).coerceAtLeast(0))) {
        val c = cell.toPx(); val g = gap.toPx()
        board.forEachIndexed { r, row -> row.forEachIndexed { col, t ->
            if (t == '.') return@forEachIndexed
            val o = Offset(col * (c + g), r * (c + g))
            targetSquare(t, o, c, dark)
            if (symbols && c >= 9f) symbol(t, o, c, .8f, if (Art.colorblind) Art.ink(t) else if (t == 'W') WHITE_INK else Color(0xFF2B2D31))
        } }
    }
}

/**
 * The target boards between two puzzles: tiles that exist in both targets slide from their old cells to their new ones (the same nearest-colour
 * moves as the restart). A tile with no counterpart simply disappears, and a new one simply appears in its place, halfway through: no fade and no
 * travel from elsewhere, only the tiles that change place move. The frame itself grows or shrinks
 * with the target, so a 3x3 to 2x2 change never jumps. At 0 and 1 it is exactly the old and new [TargetMini].
 */
@Composable
fun MorphTarget(from: Board, to: Board, progress: Float, cell: Dp, gap: Dp, modifier: Modifier = Modifier) {
    fun frame(cols: Int, rows: Int): Pair<Dp, Dp> = if (cols <= 0 || rows <= 0) 0.dp to 0.dp
        else (cell * cols + gap * (cols - 1)) to (cell * rows + gap * (rows - 1))
    val oldCols = from.firstOrNull()?.length ?: 0; val oldRows = from.size
    val newCols = to.firstOrNull()?.length ?: 0; val newRows = to.size
    val (oldW, oldH) = frame(oldCols, oldRows)
    val (newW, newH) = frame(newCols, newRows)
    val width = androidx.compose.ui.unit.lerp(oldW, newW, progress.coerceIn(0f, 1f))
    val height = androidx.compose.ui.unit.lerp(oldH, newH, progress.coerceIn(0f, 1f))
    val dark = LocalPalette.current.dark
    val moves = remember(from, to) { rewindMoves(from, to) }
    val destinations = remember(moves) { moves.values.toSet() }
    Canvas(modifier.size(width, height)) {
        val c = cell.toPx(); val g = gap.toPx(); val pitch = c + g
        val ow = oldW.toPx(); val oh = oldH.toPx(); val nw = newW.toPx(); val nh = newH.toPx()
        val middle = Offset(size.width / 2, size.height / 2)
        fun inFrame(r: Int, col: Int, w: Float, h: Float) = Offset(col * pitch + c / 2 - w / 2, r * pitch + c / 2 - h / 2)
        for (r in from.indices) for (col in from[r].indices) {
            val type = from[r][col]; if (type == '.') continue
            val oldAt = inFrame(r, col, ow, oh)
            val dest = moves[Pos(r, col)]
            if (dest != null) {
                val newAt = inFrame(dest.r, dest.c, nw, nh)
                val at = middle + oldAt + (newAt - oldAt) * progress
                targetSquare(type, at - Offset(c / 2, c / 2), c, dark)
            } else if (progress < MORPH_SWITCH) targetSquare(type, middle + oldAt - Offset(c / 2, c / 2), c, dark)
        }
        for (r in to.indices) for (col in to[r].indices) {
            val type = to[r][col]; if (type == '.' || Pos(r, col) in destinations || progress < MORPH_SWITCH) continue
            val at = middle + inFrame(r, col, nw, nh)
            targetSquare(type, at - Offset(c / 2, c / 2), c, dark)
        }
    }
}

/** How far through a target morph the tiles without a counterpart swap: the old ones vanish and the new ones appear at once. */
internal const val MORPH_SWITCH = .5f
