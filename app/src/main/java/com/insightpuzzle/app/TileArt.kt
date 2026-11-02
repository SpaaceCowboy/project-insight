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
import androidx.compose.ui.graphics.drawscope.translate
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
    val wall = androidx.compose.ui.graphics.lerp(deep, Color.Black, .4f)
    if (Art.smooth) translate(origin.x, origin.y) { drawPath(squareWall(size, size * .23f, depth), wall) }
    else drawRoundRect(wall, origin + Offset(0f, depth), Size(size, size), radius)
    val angle = Math.toRadians(145.0 - 90.0)
    val dx = (cos(angle) * size / 2).toFloat(); val dy = (sin(angle) * size / 2).toFloat()
    val center = origin + Offset(size / 2, size / 2)
    drawRoundRect(Brush.linearGradient(listOf(light, deep), center - Offset(dx, dy), center + Offset(dx, dy)), origin, Size(size, size), radius)
    // The colour-blind palette keeps its exact colours: only a faint sheen.
    // The new solid palette has none either: the colour is flat and only the side is shaded.
    if (!Art.solid) {
        val sheen = if (Art.colorblind) listOf(Color.White.copy(alpha = .08f), Color.Transparent, Color(0x14000000)) else listOf(Color.White.copy(alpha = .28f), Color.Transparent, Color(0x29000000))
        drawRoundRect(Brush.linearGradient(sheen, origin, origin + Offset(size, size)), origin, Size(size, size), radius)
    }
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

/**
 * The smooth 3D side of a plate (Options → About → Smooth 3D): not the face's shape moved down, whose side keeps one thickness all along the bottom and
 * stops short at the rounded corners, but a band that is [depth] thick at the middle of the bottom edge and tapers to nothing at both ends, following the
 * face's lower outline round its corners. Null for an outline that is not a rectangle, rounded or not (the caller then moves the face's shape down as usual).
 */
internal fun taperedWall(outline: androidx.compose.ui.graphics.Outline, depth: Float): androidx.compose.ui.graphics.Path? {
    val rr = when (outline) {
        is androidx.compose.ui.graphics.Outline.Rounded -> outline.roundRect
        is androidx.compose.ui.graphics.Outline.Rectangle -> androidx.compose.ui.geometry.RoundRect(outline.rect, CornerRadius.Zero)
        else -> return null
    }
    val width = rr.width
    if (width <= 0f || depth <= 0f) return null
    val steps = 48
    // The lower outline of the face at x: flat along the bottom, then up each corner's arc.
    fun lower(x: Float): Float {
        val bl = rr.bottomLeftCornerRadius; val br = rr.bottomRightCornerRadius
        return when {
            bl.x > 0f && x < rr.left + bl.x -> { val t = (rr.left + bl.x - x) / bl.x; rr.bottom - bl.y + bl.y * kotlin.math.sqrt((1f - t * t).coerceAtLeast(0f)) }
            br.x > 0f && x > rr.right - br.x -> { val t = (x - (rr.right - br.x)) / br.x; rr.bottom - br.y + br.y * kotlin.math.sqrt((1f - t * t).coerceAtLeast(0f)) }
            else -> rr.bottom
        }
    }
    // How much of the full thickness there is at x: all of it in the middle, falling away to nothing at the ends.
    fun thickness(x: Float): Float { val u = kotlin.math.abs(2f * (x - rr.left) / width - 1f); return depth * (1f - Math.pow(u.toDouble(), 2.5).toFloat()) }
    return androidx.compose.ui.graphics.Path().apply {
        moveTo(rr.left, lower(rr.left))
        for (i in 0..steps) { val x = rr.left + width * i / steps; lineTo(x, lower(x) + thickness(x)) }
        // Back along the face's own outline, a little inside it, so no seam shows between the band and the face.
        for (i in steps downTo 0) { val x = rr.left + width * i / steps; lineTo(x, lower(x) - depth) }
        close()
    }
}

private val tileWalls = HashMap<Triple<Float, Float, Float>, androidx.compose.ui.graphics.Path>()
/** The tapered side of a square tile or slot of [size] with corner [radius], in its own coordinates (drawn translated to the tile). Kept, as every tile has the same one. */
internal fun squareWall(size: Float, radius: Float, depth: Float): androidx.compose.ui.graphics.Path =
    tileWalls.getOrPut(Triple(size, radius, depth)) {
        if (tileWalls.size > 32) tileWalls.clear()
        taperedWall(androidx.compose.ui.graphics.Outline.Rounded(androidx.compose.ui.geometry.RoundRect(0f, 0f, size, size, CornerRadius(radius))), depth)!!
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
            else if (Art.solid) {
                // The exact colour, with a fine darker edge (white would vanish on the cream cards otherwise).
                val face = Art.LIGHT.getValue(t)
                drawRoundRect(face, o, Size(c, c), CornerRadius(c * .25f))
                drawRoundRect(androidx.compose.ui.graphics.lerp(face, Color.Black, .22f).copy(alpha = .55f), o + Offset(.5f, .5f), Size(c - 1f, c - 1f), CornerRadius(c * .25f), style = Stroke(1f))
            } else {
                val deep = Art.TILE.getValue(t).second
                drawRoundRect(androidx.compose.ui.graphics.lerp(Art.LIGHT.getValue(t), deep, .35f), o, Size(c, c), CornerRadius(c * .25f))
                drawRoundRect(deep.copy(alpha = .55f), o + Offset(.5f, .5f), Size(c - 1f, c - 1f), CornerRadius(c * .25f), style = Stroke(1f))
            }
            if (symbols && c >= 9f) symbol(t, o, c, .8f, if (Art.colorblind) Art.ink(t) else if (t == 'W') WHITE_INK else Color(0xFF2B2D31))
        } }
    }
}
