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

// Tile symbols from src/tile-art.js, as line segments in a 48x48 box.
private val SEGMENTS: Map<Char, List<FloatArray>> = mapOf(
    'R' to listOf(f(24, 8, 24, 40), f(24, 8, 17, 15), f(24, 8, 31, 15), f(24, 40, 17, 33), f(24, 40, 31, 33)),
    'B' to listOf(f(8, 24, 40, 24), f(8, 24, 15, 17), f(8, 24, 15, 31), f(40, 24, 33, 17), f(40, 24, 33, 31)),
    'G' to listOf(f(12.69, 35.31, 35.31, 12.69), f(35.31, 12.69, 25.41, 12.69), f(35.31, 12.69, 35.31, 22.59), f(12.69, 35.31, 22.59, 35.31), f(12.69, 35.31, 12.69, 25.41)),
    'Y' to listOf(f(12.69, 12.69, 35.31, 35.31), f(12.69, 12.69, 22.59, 12.69), f(12.69, 12.69, 12.69, 22.59), f(35.31, 35.31, 25.41, 35.31), f(35.31, 35.31, 35.31, 25.41)),
    'W' to listOf(f(24, 6, 24, 14), f(24, 34, 24, 42), f(6, 24, 14, 24), f(34, 24, 42, 24)),
    'P' to listOf(
        f(24, 8, 24, 40), f(8, 24, 40, 24),
        f(24, 8, 18, 14), f(24, 8, 30, 14),
        f(24, 40, 18, 34), f(24, 40, 30, 34),
        f(8, 24, 14, 18), f(8, 24, 14, 30),
        f(40, 24, 34, 18), f(40, 24, 34, 30),
    ),
)
private fun f(vararg v: Number) = FloatArray(v.size) { v[it].toFloat() }
private val WHITE_INK = Color(0xFF45474C)

/** Draws the tile symbol centred in [size] at [scale] of the box (the web game uses 44% on board tiles). */
fun DrawScope.symbol(type: Char, origin: Offset, size: Float, scale: Float, color: Color = if (type == 'W') WHITE_INK else Color.White) {
    val box = size * scale; val unit = box / 48f
    val left = origin.x + (size - box) / 2; val top = origin.y + (size - box) / 2
    val ink = color
    val width = unit * when (type) { 'P' -> 3.1f; 'W' -> 3.6f; else -> 4.2f }
    if (type == 'W') drawCircle(ink, radius = 10 * unit, center = Offset(left + 24 * unit, top + 24 * unit), style = Stroke(4 * unit))
    for (s in SEGMENTS.getValue(type)) drawLine(ink, Offset(left + s[0] * unit, top + s[1] * unit), Offset(left + s[2] * unit, top + s[3] * unit), width, StrokeCap.Round)
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
    if (glow != null) drawRoundRect(glow.copy(alpha = glow.alpha * .35f), origin - Offset(size * .08f, size * .08f), Size(size * 1.16f, size * 1.16f), CornerRadius(size * .3f))
    val angle = Math.toRadians(145.0 - 90.0)
    val dx = (cos(angle) * size / 2).toFloat(); val dy = (sin(angle) * size / 2).toFloat()
    val center = origin + Offset(size / 2, size / 2)
    drawRoundRect(Brush.linearGradient(listOf(light, deep), center - Offset(dx, dy), center + Offset(dx, dy)), origin, Size(size, size), radius)
    // The colour-blind palette keeps its exact colours: only a faint sheen.
    val sheen = if (Art.colorblind) listOf(Color.White.copy(alpha = .08f), Color.Transparent, Color(0x14000000)) else listOf(Color.White.copy(alpha = .28f), Color.Transparent, Color(0x29000000))
    drawRoundRect(Brush.linearGradient(sheen, origin, origin + Offset(size, size)), origin, Size(size, size), radius)
    if (highlight > 0f) drawRoundRect(Color.White.copy(alpha = highlight), origin, Size(size, size), radius)
    drawRoundRect(Color(0x73FFFFFF), origin, Size(size, size), radius, style = Stroke(1.5f))
    if (glow != null) drawRoundRect(glow, origin - Offset(3f, 3f), Size(size + 6f, size + 6f), CornerRadius(size * .23f + 3f), style = Stroke(5f))
    if (ring != null) drawRoundRect(ring, origin - Offset(2f, 2f), Size(size + 4f, size + 4f), CornerRadius(size * .23f + 2f), style = Stroke(4f))
    symbol(type, origin, size, .44f, Art.ink(type))
}

/** A standalone tile (palette, hero) of [size]. */
@Composable
fun TileIcon(type: Char, size: Dp, modifier: Modifier = Modifier, glow: Color? = null) {
    Canvas(modifier.size(size)) { tile(type, Offset.Zero, this.size.width, glow) }
}

/** Mini target preview: flat colour squares, no arrows (only the main board shows symbols); holes stay empty. */
@Composable
fun TargetMini(board: Board, cell: Dp, gap: Dp, modifier: Modifier = Modifier, symbols: Boolean = false) {
    val rows = board.size; val cols = board.firstOrNull()?.length ?: 0
    Canvas(modifier.size(cell * cols + gap * (cols - 1).coerceAtLeast(0), cell * rows + gap * (rows - 1).coerceAtLeast(0))) {
        val c = cell.toPx(); val g = gap.toPx()
        board.forEachIndexed { r, row -> row.forEachIndexed { col, t ->
            if (t == '.') return@forEachIndexed
            val o = Offset(col * (c + g), r * (c + g))
            drawRoundRect(Art.LIGHT.getValue(t), o, Size(c, c), CornerRadius(c * .25f))
            if (symbols && c >= 9f) symbol(t, o, c, .8f, if (Art.colorblind) Art.ink(t) else if (t == 'W') WHITE_INK else Color(0xFF2B2D31))
        } }
    }
}
