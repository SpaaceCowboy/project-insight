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

class MainActivity : ComponentActivity() {
    private val model: GameModel by viewModels()
    private var reduceMotion by mutableStateOf(false)

    // "Remove animations" can change while the app is in the background, so it is read on every resume.
    private fun readReduceMotion() = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        reduceMotion = readReduceMotion()
        setContent {
            LaunchedEffect(model.dark) {
                val bars = if (model.dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(bars, bars)
            }
            CompositionLocalProvider(LocalPalette provides if (model.dark) DarkPalette else LightPalette, LocalReduceMotion provides reduceMotion) { App(model) }
        }
    }

    override fun onStart() { super.onStart(); reduceMotion = readReduceMotion(); model.audio.onForeground(true) }
    override fun onStop() { model.audio.onForeground(false); super.onStop() }
}

@Composable
fun App(m: GameModel) {
    // At the bottom of the stack on Home, Back falls through to the system and closes the app.
    BackHandler(enabled = !(m.stack.size == 1 && m.top == Route.Home)) { m.back() }
    Backdrop(m.background, m.light) {
        when (val top = m.top) {
            Route.Home -> HomeScreen(m)
            Route.Worlds -> WorldsScreen(m)
            is Route.Levels -> LevelsScreen(m, top.world)
            Route.Game -> GameScreen(m)
            Route.Pause -> { GameScreen(m); PauseOverlay(m) }
            Route.Win -> GameScreen(m)
            Route.Options -> OptionsScreen(m)
            is Route.Achievements -> AchievementsScreen(m, top.tab)
            Route.Online -> OnlineScreen(m)
            Route.Create -> CreatorScreen(m)
        }
        Burst(m.burst)
    }
}
