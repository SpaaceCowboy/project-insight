package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
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
    drawRoundRect(Color(0x73FFFFFF), origin, Size(size, size), radius, style = Stroke(1.5f))
    // The selection ring alone: no halo around it.
    if (glow != null) drawRoundRect(glow, origin - Offset(2.5f, 2.5f), Size(size + 5f, size + 5f), CornerRadius(size * .23f + 2.5f), style = Stroke(3.5f))
    if (ring != null) drawRoundRect(ring, origin - Offset(2f, 2f), Size(size + 4f, size + 4f), CornerRadius(size * .23f + 2f), style = Stroke(4f))
    // Every arrow is cut into the face rather than drawn on it. Light ink (most tiles) falls in shadow along its upper edge; dark ink (the pale tiles: white, and
    // yellow and pink in the colour-blind palette) catches a highlight along its lower edge instead.
    val ink = Art.ink(type)
    val weight = if (type == 'W') 1f else ETCH_WEIGHT
    if (ink == Color.White) {
        symbol(type, origin - Offset(0f, size * .012f), size, .44f, Color.Black.copy(alpha = .2f), weight)
        symbol(type, origin, size, .44f, Color.White.copy(alpha = .9f), weight)
    } else {
        symbol(type, origin + Offset(0f, size * .012f), size, .44f, Color.White.copy(alpha = .7f), weight)
        symbol(type, origin, size, .44f, ink.copy(alpha = .92f), weight)
    }
}

/** Arrows on coloured tiles are a little finer than the original strokes. */
private const val ETCH_WEIGHT = .78f

/** A standalone tile (palette, hero) of [size]. */
@Composable
fun TileIcon(type: Char, size: Dp, modifier: Modifier = Modifier, glow: Color? = null) {
    Canvas(modifier.size(size)) { tile(type, Offset.Zero, this.size.width, glow) }
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
            if (dark) drawRoundRect(Art.LIGHT.getValue(t), o, Size(c, c), CornerRadius(c * .25f))
            else {
                val deep = Art.TILE.getValue(t).second
                drawRoundRect(androidx.compose.ui.graphics.lerp(Art.LIGHT.getValue(t), deep, .35f), o, Size(c, c), CornerRadius(c * .25f))
                drawRoundRect(deep.copy(alpha = .55f), o + Offset(.5f, .5f), Size(c - 1f, c - 1f), CornerRadius(c * .25f), style = Stroke(1f))
            }
            if (symbols && c >= 9f) symbol(t, o, c, .8f, if (Art.colorblind) Art.ink(t) else if (t == 'W') WHITE_INK else Color(0xFF2B2D31))
        } }
    }
}
