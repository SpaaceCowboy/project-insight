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

class MainActivity : ComponentActivity() {
    private val model: GameModel by viewModels()
    private var reduceMotion by mutableStateOf(false)

    // "Remove animations" can change while the app is in the background, so it is read on every resume.
    private fun readReduceMotion() = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        reduceMotion = readReduceMotion()
        // Match the saved light/dark choice before the first frame, so a light-mode player doesn't see dark bars or window.
        val dark = model.dark
        val bars = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        enableEdgeToEdge(bars, bars)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(if (dark) 0xFF161718.toInt() else 0xFFFAFAFA.toInt()))
        setContent {
            val dark = model.dark
            LaunchedEffect(dark) {
                val bars = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
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
    BackHandler(enabled = !(m.stack.size == 1 && m.top == Route.Home)) { m.back() }
    Backdrop(m.light) {
        when (val top = m.top) {
            Route.Home -> HomeScreen(m)
            Route.Worlds -> WorldsScreen(m)
            is Route.Levels -> LevelsScreen(m, top.world)
            Route.Game, Route.Win -> GameScreen(m)
            Route.Pause -> { GameScreen(m); PauseOverlay(m) }
            Route.Options -> OptionsScreen(m)
            Route.Achievements -> AchievementsScreen(m)
            Route.Online -> OnlineScreen(m)
            Route.Create -> CreatorScreen(m)
            is Route.Auth -> AuthScreen(m, top.destination)
            is Route.Profile -> ProfileScreen(m, top.id)
            Route.Casual -> CasualScreen(m)
            Route.Browse -> BrowseScreen(m)
            is Route.CommunityWorld -> CommunityWorldScreen(m, top.id)
            Route.Publish -> PublishScreen(m)
            is Route.ProfileWorlds -> ProfileWorldsScreen(m, top.id)
        }
        m.online.error?.let { message ->
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { m.online.dismissError() },
                title = { Label("Unable to finish", 20.sp) },
                text = { androidx.compose.material3.Text(message, color = LocalPalette.current.ink) },
                confirmButton = { androidx.compose.material3.TextButton(onClick = { m.online.dismissError() }) { androidx.compose.material3.Text("OK", color = LocalPalette.current.accent) } },
                containerColor = LocalPalette.current.paper2,
            )
        }
        Burst(m.burst)
    }
}
