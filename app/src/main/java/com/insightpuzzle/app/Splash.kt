package com.insightpuzzle.app

import android.os.SystemClock
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

/** The splash shows for at least this long (so it never flashes), and never longer than [SPLASH_MAX_MS] even if the loading is slow. */
internal const val SPLASH_MIN_MS = 900L
internal const val SPLASH_MAX_MS = 2500L
/** The splash's grey: the dark theme's, whatever theme is saved. */
internal val SplashGrey = Color(0xFF1D1D1D)

/**
 * The first screen: the same grey as dark mode, "INSIGHT" in the app's font and a white tile, centred, drawn over the main menu while it composes underneath.
 * That time is the app's loading time: the sounds and the ambience get ready, and for a signed-in player the first pages of Worlds and Bookmarked are fetched, so
 * the menu and everything behind its buttons is quick from the first touch. It fades away when all of that is ready (or at [SPLASH_MAX_MS]).
 */
@Composable
fun SplashGate(m: GameModel) {
    if (m.splashDone) return
    val reduce = LocalReduceMotion.current
    val alpha = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        val started = SystemClock.uptimeMillis()
        // Under test the minimum hold is skipped; the loading is still waited for.
        val minimum = if (m.store.motion == "on") 0L else SPLASH_MIN_MS
        withTimeoutOrNull(SPLASH_MAX_MS) {
            coroutineScope {
                val fetched = async { m.warmUp() }
                snapshotFlow { m.audio.ready }.first { it }
                fetched.await()
            }
        }
        val left = minimum - (SystemClock.uptimeMillis() - started)
        if (left > 0) delay(left)
        if (!reduce) alpha.animateTo(0f, tween(260))
        m.splashDone = true
    }
    Box(Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha.value }.background(SplashGrey)
        .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
        .clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        // A small gap: the squeezed name and the symbol's own margin inside its box already add about 6dp of air.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            // Condensed: the family's extra bold, tightened and squeezed a little.
            androidx.compose.material3.Text("MIDORI", Modifier.graphicsLayer { scaleX = .9f }, color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-.04).em, fontFamily = MonoFamily, maxLines = 1)
            // The white tile's symbol, drawn white like the name.
            Canvas(Modifier.size(34.dp)) { symbol('W', Offset.Zero, size.minDimension, 1f, Color.White) }
        }
    }
}
