package com.insightpuzzle.app

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Colours from the web game's src/styles.css (:root and body.light-mode).
data class Palette(
    val ink: Color, val muted: Color, val line: Color, val paper: Color, val paper2: Color,
    val accent: Color, val accentInk: Color, val shadow: Color, val shell: List<Color>, val shellInk: Color, val dark: Boolean,
)

val DarkPalette = Palette(
    ink = Color(0xFFEDF5E9), muted = Color(0xFFAAC9C8), line = Color(0x2EB4E0D2), paper = Color(0xA6091F27), paper2 = Color(0xFF102A34),
    accent = Color(0xFFA8DFCF), accentInk = Color(0xFF102F32), shadow = Color(0x47020E14),
    shell = listOf(Color(0x421C3C42), Color(0x8C041821)), shellInk = Color(0xFFEDF5E9), dark = true,
)
val LightPalette = Palette(
    ink = Color(0xFF173E3F), muted = Color(0xFF365C58), line = Color(0x3318463E), paper = Color(0xA8EBF6EA), paper2 = Color(0xFFE2EFE6),
    accent = Color(0xFF2C6963), accentInk = Color(0xFFF3F7E7), shadow = Color(0x242B5247),
    shell = listOf(Color(0xB0275C58), Color(0xC21A4744)), shellInk = Color(0xFFF3F7E7), dark = false,
)

val LocalPalette = staticCompositionLocalOf { DarkPalette }

/** Two radial glows plus a 165° linear base, per background cosmetic and light/dark mode. */
data class Backdrop(val glow1: Color, val glow2: Color, val base: List<Color>)

fun backdrop(id: String, dark: Boolean): Backdrop = when (id to dark) {
    "mist" to true -> Backdrop(Color(0xFF254F6D), Color(0xFF165954), listOf(Color(0xFF122C48), Color(0xFF102B38), Color(0xFF173D42)))
    "mist" to false -> Backdrop(Color(0xFFDFEDF6), Color(0xFFACDCD5), listOf(Color(0xFFB9D8EA), Color(0xFFD8EAF0), Color(0xFFB8DAD5)))
    "aurora" to true -> Backdrop(Color(0xFF2F3E76), Color(0xFF543669), listOf(Color(0xFF152C4A), Color(0xFF202A48), Color(0xFF352A48)))
    "aurora" to false -> Backdrop(Color(0xFFD6E5FF), Color(0xFFD8C4ED), listOf(Color(0xFFC6D8EE), Color(0xFFE0E5F2), Color(0xFFD1C8E4)))
    "forest" to false -> Backdrop(Color(0xFFE7EEE2), Color(0xFFBFD9D5), listOf(Color(0xFFC5D6DF), Color(0xFFD9E9DC), Color(0xFFBBD2C5)))
    else -> Backdrop(Color(0xFF234958), Color(0xFF1E4843), listOf(Color(0xFF142B41), Color(0xFF0C252E), Color(0xFF182F35)))
}

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
