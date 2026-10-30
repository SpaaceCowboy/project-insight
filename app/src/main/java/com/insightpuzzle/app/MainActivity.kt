package com.insightpuzzle.app

import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.sp
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.animation.togetherWith
import android.os.SystemClock
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.flow.drop

class MainActivity : ComponentActivity() {
    private val model: GameModel by viewModels()
    private var reduceMotion by mutableStateOf(false)

    // "Remove animations" can change while the app is in the background, so it is read on every resume.
    private fun readReduceMotion() = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        reduceMotion = readReduceMotion()
        // The first frame is the splash screen, which is dark grey in either theme, so the system bars start dark too (they follow the theme once it is gone).
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        // The splash screen is dark grey whatever the theme, so the window starts that colour and the system bars stay dark until the splash is gone.
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(0xFF1D1D1D.toInt()))
        setContent {
            val dark = model.dark
            val barsDark = dark || !model.splashDone
            LaunchedEffect(barsDark) {
                val bars = if (barsDark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(bars, bars)
            }
            CompositionLocalProvider(LocalPalette provides if (dark) DarkPalette else LightPalette, LocalReduceMotion provides (reduceMotion || model.store.motion == "on")) { App(model) }
        }
    }

    override fun onStart() { super.onStart(); reduceMotion = readReduceMotion(); model.audio.onForeground(true) }
    override fun onStop() { model.audio.onForeground(false); super.onStop() }
}

@Composable
fun App(m: GameModel) {
    // At the bottom of the stack on Home, Back falls through to the system and closes the app.
    BackHandler(enabled = !(m.stack.size == 1 && m.top == Route.Home)) { m.feedback(Cue.BACK); m.back() }
    CompositionLocalProvider(LocalFeedback provides m::feedback) { Backdrop {
        // Every screen with a chevron rises from the bottom over the screen it was opened from and sinks back on Back (see Sheets.kt); only Home does not slide.
        // The Journey level screen rises over the game; choosing a level there sinks it again onto the game, which is already on the new level.
        // No error dialog anywhere: a lost connection is the offline mark on Worlds and Profile, and a refused form shows its reason inline.
        val gate = remember { TouchGate() }
        // A screen opening or closing locks touches until it has settled, so fast taps can't open two screens.
        LaunchedEffect(m) { snapshotFlow { m.stack.toList() }.drop(1).collect { gate.lockFor(TOUCH_LOCK_MS) } }
        Box(Modifier.fillMaxSize().singleTouch(gate)) {
            Screens(m)
            SplashGate(m)
        }
    } }
}

/** How long touches are refused after the screen stack changes: the sheet motion (320 ms) plus a little. */
private const val TOUCH_LOCK_MS = 400L

/** Which finger owns the touch right now, and until when new touches are refused. */
class TouchGate {
    var active: PointerId? = null
    private var until = 0L
    fun lockFor(ms: Long) { until = SystemClock.uptimeMillis() + ms }
    fun open() = SystemClock.uptimeMillis() >= until
}

/**
 * One touch at a time: while a finger is down every other finger is ignored, and a finger that lands while the gate is locked is ignored until it lifts.
 * The refused touches are consumed before any button sees them, so they make no sound, haptic or press.
 */
fun Modifier.singleTouch(gate: TouchGate): Modifier = pointerInput(gate) {
    awaitPointerEventScope {
        while (true) {
            val event = awaitPointerEvent(PointerEventPass.Initial)
            for (change in event.changes) {
                if (change.changedToDown()) { if (gate.active == null && gate.open()) gate.active = change.id else change.consume() }
                else if (change.id != gate.active) change.consume()
            }
            if (event.changes.none { it.pressed }) gate.active = null
        }
    }
}
