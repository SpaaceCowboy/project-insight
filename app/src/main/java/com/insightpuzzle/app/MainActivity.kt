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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.sp
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.isImeVisible
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
    private var keyboardUp = false

    // "Remove animations" can change while the app is in the background, so it is read on every resume.
    private fun readReduceMotion() = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        reduceMotion = readReduceMotion()
        // The first frame is the splash screen, which is dark grey in either theme, so the system bars start dark too (they follow the theme once it is gone).
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        // The splash screen is dark grey whatever the theme, so the window starts that colour and the system bars stay dark until the splash is gone.
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(0xFF1F1F1F.toInt()))
        hideNavBar()
        // Whatever shows the handle again (the keyboard closing, a dialog, a late system restore, a swipe or touch near the bottom edge) hides it again at once, unless the
        // keyboard is up. Only with gesture navigation: with three buttons a swipe up stays the one way to reach them.
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { view, insets ->
            val imeUp = insets.isVisible(WindowInsetsCompat.Type.ime())
            keyboardUp = imeUp
            // Any time Android restores the bars (a drag near the bottom, a dialog, a return from elsewhere) put the handle away again.
            if (!imeUp && insets.isVisible(WindowInsetsCompat.Type.navigationBars())) view.post { hideNavBar() }
            androidx.core.view.ViewCompat.onApplyWindowInsets(view, insets)
        }
        setContent {
            val dark = model.dark
            val barsDark = dark || !model.splashDone
            LaunchedEffect(barsDark) {
                val bars = if (barsDark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(bars, bars)
            }
            // While the keyboard is up the handle comes back so the keyboard sits above it, as it always did; the room is reserved either way, so nothing moves.
            @OptIn(ExperimentalLayoutApi::class) val keyboard = WindowInsets.isImeVisible
            LaunchedEffect(keyboard) { keyboardUp = keyboard; if (keyboard) showNavBar() else hideNavBar() }
            CompositionLocalProvider(LocalPalette provides if (dark) DarkPalette else LightPalette, LocalReduceMotion provides (reduceMotion || model.store.motion == "on"),
                LocalHideSystemBars provides { hideNavBar() }) { App(model) }
        }
    }

    /**
     * The system gesture handle is hidden on every screen from the first frame, and a swipe up from the bottom edge shows it for a moment. This is only the handle's
     * visibility: every screen keeps its room reserved (see [appInsets]), so nothing is laid out again. Android shows the bars again after a dialog, the keyboard or
     * a return from another app, so it is hidden again whenever the window regains focus.
     */
    private fun hideNavBar() {
        if (keyboardUp) return
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.navigationBars())
    }

    private fun showNavBar() = WindowCompat.getInsetsController(window, window.decorView).show(WindowInsetsCompat.Type.navigationBars())

    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) hideNavBar() }
    override fun onStart() { super.onStart(); reduceMotion = readReduceMotion(); model.audio.onForeground(true) }
    override fun onStop() {
        model.audio.onForeground(false)
        // The icon picked in Options is switched now that the game is no longer on screen; Android would close the running task if it were switched sooner.
        val wanted = model.store.iconWanted
        if (wanted.isNotEmpty()) { model.store.iconWanted = ""; if ((wanted == "alt") != AppIcon.isAlternative(this)) AppIcon.set(this, wanted == "alt") }
        super.onStop()
    }
}

@Composable
fun App(m: GameModel) {
    // At the bottom of the stack on Home, Back falls through to the system and closes the app.
    BackHandler(enabled = !(m.stack.size == 1 && m.top == Route.Home)) { m.feedback(Cue.BACK); m.back() }
    // The music plays everywhere but while a puzzle is played (Journey or online) and in the creator, which has its own bed.
    val quiet = m.top == Route.Game || m.top == Route.Win || m.top == Route.Create
    androidx.compose.runtime.SideEffect { m.audio.music(!quiet) }
    // A screen that has just finished rising hides the handle again, in case Android restored it during the transition.
    val hideSystemBars = LocalHideSystemBars.current
    LaunchedEffect(m.stack.toList()) {
        if (m.top == Route.Game || m.top == Route.Create) { kotlinx.coroutines.delay(400); hideSystemBars() }
    }
    CompositionLocalProvider(LocalFeedback provides m::feedback) { Backdrop {
        // Every screen with a chevron rises from the bottom over the screen it was opened from and sinks back on Back (see Sheets.kt); only Home does not slide.
        // The Journey level screen rises over the game; choosing a level there sinks it again onto the game, which is already on the new level.
        // No error dialog anywhere: a lost connection is the offline mark on Worlds and Profile, and a refused form shows its reason inline.
        val gate = remember { TouchGate() }
        // A screen opening or closing locks touches until it has settled, so fast taps can't open two screens.
        LaunchedEffect(m) { snapshotFlow { m.stack.toList() }.drop(1).collect { gate.lockFor(TOUCH_LOCK_MS) } }
        // A lost connection is retried by itself, with growing waits, until the server answers; pulling down still retries at once.
        LaunchedEffect(m.online.offline, m.online.user) { if (m.online.offline) m.online.reconnect() }
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
