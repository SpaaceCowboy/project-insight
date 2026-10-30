package com.insightpuzzle.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Dark mode is neutral near-black greys. Light mode is a warm cream key (face F4EDE5, wall E1D4C4) on near-white, with warm charcoal ink.
data class Palette(
    val ink: Color, val muted: Color, val line: Color, val paper: Color, val paper2: Color,
    val accent: Color, val accentInk: Color, val shadow: Color, val side: Color, val shell: List<Color>, val shellInk: Color, val dark: Boolean,
)

val DarkPalette = Palette(
    ink = Color(0xFFEDEDED), muted = Color(0xFFA6A8AD), line = Color(0x1FFFFFFF), paper = Color(0xFF262626), paper2 = Color(0xFF2F2F2F),
    accent = Color(0xFFD4D6DA), accentInk = Color(0xFF1B1C1E), shadow = Color(0x47000000), side = Color(0xFF212121),
    shell = listOf(Color(0xFF252525), Color(0xFF222222)), shellInk = Color(0xFFEDEDED), dark = true,
)
val LightPalette = Palette(
    ink = Color(0xFF3B342D), muted = Color(0xFF7C7166), line = Color(0x333B342D), paper = Color(0xFFFAF6F1), paper2 = Color(0xFFF4EDE5),
    accent = Color(0xFF3B342D), accentInk = Color(0xFFF4EDE5), shadow = Color(0x242A1E12), side = Color(0xFFE1D4C4),
    shell = listOf(Color(0xFFF4EDE5), Color(0xFFF1E9DF)), shellInk = Color(0xFF3B342D), dark = false,
)

val LocalPalette = staticCompositionLocalOf { DarkPalette }

/** The matte background: one barely-there diagonal gradient, no glows or lights. */
fun backdrop(dark: Boolean): List<Color> = if (dark)
    listOf(Color(0xFF1D1D1D), Color(0xFF1E1E1E), Color(0xFF1F1F1F), Color(0xFF1F1F1F))
else listOf(Color(0xFFFEFEFE), Color(0xFFFDFCFA), Color(0xFFFBF8F5), Color(0xFFF9F5F0))

object Art {
    /** Colourblind-friendly palette on (Options). Compose state, so tiles redraw the moment it flips. */
    var colorblind by mutableStateOf(false)

    /** Tile body gradients (light, deep). */
    val TILE: Map<Char, Pair<Color, Color>> get() = if (colorblind) CB_TILE else STD_TILE
    val LIGHT: Map<Char, Color> get() = if (colorblind) CB_LIGHT else STD_LIGHT
    /** Symbol ink on a tile body: white, except on the pale tiles (and, in the colour-blind palette, on yellow, pink-purple and off-white). */
    fun ink(type: Char): Color = when {
        colorblind -> if (type == 'Y' || type == 'P' || type == 'W') CB_INK else Color.White
        type == 'W' -> Color(0xFF45474C)
        else -> Color.White
    }
    /** Dark symbol ink of the colour-blind palette. */
    val CB_INK = Color(0xFF303238)

    private val STD_TILE = mapOf(
        'R' to (Color(0xFFE09A91) to Color(0xFFAE546B)),
        'B' to (Color(0xFF93D2DB) to Color(0xFF3B88A6)),
        'G' to (Color(0xFFA6D7AD) to Color(0xFF4B896B)),
        'Y' to (Color(0xFFF0D38B) to Color(0xFFB88A43)),
        'P' to (Color(0xFFC9B8E1) to Color(0xFF8464A9)),
        'W' to (Color(0xFFF3F4DF) to Color(0xFFC3CFBC)),
    )
    private val STD_LIGHT = mapOf(
        'R' to Color(0xFFE69A99), 'B' to Color(0xFF88CEDD), 'G' to Color(0xFF9FD6B5),
        'Y' to Color(0xFFEDCC82), 'P' to Color(0xFFBBA9DC), 'W' to Color(0xFFE4ECDF),
    )
    // The colour-blind palette: Okabe-Ito hues, adjusted and tested, one exact colour per tile. The face runs from a touch lighter (top left) to a touch deeper
    // (bottom right) so that the colour itself sits in the middle of the tile; its glow and the name in the Rulebook are the colour itself.
    private val CB_COLOR = mapOf(
        'R' to Color(0xFFD55E00), 'B' to Color(0xFF0072B2), 'G' to Color(0xFF009E73),
        'Y' to Color(0xFFF0E442), 'P' to Color(0xFFCC79A7), 'W' to Color(0xFFF4F1E8),
    )
    private val CB_TILE = CB_COLOR.mapValues { (_, c) -> androidx.compose.ui.graphics.lerp(c, Color.White, .06f) to androidx.compose.ui.graphics.lerp(c, Color.Black, .1f) }
    private val CB_LIGHT = CB_COLOR
    val NAME = mapOf('R' to "Red", 'B' to "Blue", 'G' to "Green", 'Y' to "Yellow", 'W' to "White", 'P' to "Purple")
    /** Plain names for the colour-blind palette's colours (its tiles no longer look like "Red" or "Green"). */
    val CB_NAME = mapOf('R' to "Vermillion", 'B' to "Blue", 'G' to "Teal green", 'Y' to "Yellow", 'W' to "White", 'P' to "Pink")
    /** A tile's colour name: its plain name, or its standard name in the colour-blind palette (the tile is no longer what "Red" would say). In the chosen language; null for an empty cell. */
    fun name(type: Char): String? = (if (colorblind) CB_NAME else NAME)[type]?.let { tr(it) }
    val WORLD = listOf(
        0xFF93D2DB to 0xFF3B88A6, 0xFFE09A91 to 0xFFAE546B, 0xFFA6D7AD to 0xFF4B896B, 0xFFF0D38B to 0xFFB88A43,
        0xFFC9B8E1 to 0xFF8464A9, 0xFF8FD9C9 to 0xFF2F8A80, 0xFFF0B48C to 0xFFB8663F, 0xFFA4B4EC to 0xFF4A5AA8,
        0xFFC5D98F to 0xFF7A9440, 0xFFE8A3CF to 0xFFA8508A, 0xFFF3F4DF to 0xFFC3CFBC,
    ).map { (a, b) -> Color(a) to Color(b) }
}
