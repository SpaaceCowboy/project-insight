package com.insightpuzzle.app

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Neutral greys: dark mode is near-black, light mode is white with dark grey ink. No hue tint anywhere.
data class Palette(
    val ink: Color, val muted: Color, val line: Color, val paper: Color, val paper2: Color,
    val accent: Color, val accentInk: Color, val shadow: Color, val shell: List<Color>, val shellInk: Color, val dark: Boolean,
)

val DarkPalette = Palette(
    ink = Color(0xFFEDEDED), muted = Color(0xFFA6A8AD), line = Color(0x2EFFFFFF), paper = Color(0xA61E1F22), paper2 = Color(0xFF26272A),
    accent = Color(0xFFD4D6DA), accentInk = Color(0xFF1B1C1E), shadow = Color(0x47000000),
    shell = listOf(Color(0xFF2E2F33), Color(0xFF1C1D20)), shellInk = Color(0xFFEDEDED), dark = true,
)
val LightPalette = Palette(
    ink = Color(0xFF26282C), muted = Color(0xFF5E6168), line = Color(0x3326282C), paper = Color(0xB3FFFFFF), paper2 = Color(0xFFF4F4F5),
    accent = Color(0xFF3A3D42), accentInk = Color(0xFFFFFFFF), shadow = Color(0x24000000),
    shell = listOf(Color(0xFFEFEFF1), Color(0xFFE3E4E7)), shellInk = Color(0xFF26282C), dark = false,
)

val LocalPalette = staticCompositionLocalOf { DarkPalette }

/** Two radial glows plus a 165° linear base, in light/dark mode. */
data class Backdrop(val glow1: Color, val glow2: Color, val base: List<Color>)

fun backdrop(dark: Boolean): Backdrop = if (dark)
    Backdrop(Color(0xFF2E2F33), Color(0xFF26272A), listOf(Color(0xFF1E1F22), Color(0xFF161718), Color(0xFF202124)))
else Backdrop(Color(0xFFFFFFFF), Color(0xFFE9EAEC), listOf(Color(0xFFEDEDEF), Color(0xFFFAFAFA), Color(0xFFE8E9EB)))

object Art {
    /** Tile body gradients (light, deep). */
    val TILE = mapOf(
        'R' to (Color(0xFFE09A91) to Color(0xFFAE546B)),
        'B' to (Color(0xFF93D2DB) to Color(0xFF3B88A6)),
        'G' to (Color(0xFFA6D7AD) to Color(0xFF4B896B)),
        'Y' to (Color(0xFFF0D38B) to Color(0xFFB88A43)),
        'P' to (Color(0xFFC9B8E1) to Color(0xFF8464A9)),
        'W' to (Color(0xFFF3F4DF) to Color(0xFFC3CFBC)),
    )
    val LIGHT = mapOf(
        'R' to Color(0xFFE69A99), 'B' to Color(0xFF88CEDD), 'G' to Color(0xFF9FD6B5),
        'Y' to Color(0xFFEDCC82), 'P' to Color(0xFFBBA9DC), 'W' to Color(0xFFE4ECDF),
    )
    val NAME = mapOf('R' to "Red", 'B' to "Blue", 'G' to "Green", 'Y' to "Yellow", 'W' to "White", 'P' to "Purple")
    val WORLD = listOf(
        0xFF93D2DB to 0xFF3B88A6, 0xFFE09A91 to 0xFFAE546B, 0xFFA6D7AD to 0xFF4B896B, 0xFFF0D38B to 0xFFB88A43,
        0xFFC9B8E1 to 0xFF8464A9, 0xFF8FD9C9 to 0xFF2F8A80, 0xFFF0B48C to 0xFFB8663F, 0xFFA4B4EC to 0xFF4A5AA8,
        0xFFC5D98F to 0xFF7A9440, 0xFFE8A3CF to 0xFFA8508A, 0xFFF3F4DF to 0xFFC3CFBC,
    ).map { (a, b) -> Color(a) to Color(b) }
}
