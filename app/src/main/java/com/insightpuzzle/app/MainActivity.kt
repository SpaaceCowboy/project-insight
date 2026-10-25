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
    BackHandler(enabled = !(m.stack.size == 1 && m.top == Route.Home)) { m.feedback(Cue.BACK); m.back() }
    CompositionLocalProvider(LocalFeedback provides m::feedback) { Backdrop(m.light) {
        // Options and every Profile rise from the bottom over the screen they were opened from, and sink back on Back. Everything else switches instantly.
        val reduce = LocalReduceMotion.current
        fun rises(route: Route) = route == Route.Options || route is Route.Profile
        androidx.compose.animation.AnimatedContent(m.top, Modifier.fillMaxSize(), label = "screens",
            // Levels, the game and the win bar share one slot, so moving between them never animates.
            contentKey = { if (it == Route.Levels || it == Route.Game || it == Route.Win) Route.Game else it },
            transitionSpec = {
                val move = androidx.compose.animation.core.tween<androidx.compose.ui.unit.IntOffset>(320, easing = androidx.compose.animation.core.FastOutSlowInEasing)
                val popped = initialState !in m.stack
                when {
                    reduce -> androidx.compose.animation.EnterTransition.None togetherWith androidx.compose.animation.ExitTransition.None
                    rises(targetState) && !popped -> androidx.compose.animation.slideInVertically(move) { it } togetherWith
                        androidx.compose.animation.ExitTransition.KeepUntilTransitionsFinished
                    rises(initialState) && popped -> (androidx.compose.animation.EnterTransition.None togetherWith
                        androidx.compose.animation.slideOutVertically(move) { it }).apply { targetContentZIndex = -1f }
                    else -> androidx.compose.animation.EnterTransition.None togetherWith androidx.compose.animation.ExitTransition.None
                } using null
            }) { top ->
        // A rising screen carries its own page background, so the screen beneath never shows through while it moves.
        @Composable fun Sheet(content: @Composable () -> Unit) = Backdrop(m.light) { content() }
        // A screen that is leaving vanishes at once unless it is part of a slide: sinking back down, or holding still under one rising.
        val leaving = transition.targetState == androidx.compose.animation.EnterExitState.PostExit
        val slides = (rises(top) && top !in m.stack) || (rises(m.top) && top in m.stack)
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().graphicsLayer { alpha = if (leaving && !slides) 0f else 1f }) {
        when (top) {
            Route.Home -> HomeScreen(m)
            // Journey keeps the level screen composed (hidden) under the game, so opening it is instant.
            Route.Levels, Route.Game, Route.Win -> androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
                val now = m.top
                if (m.community == null && (now == Route.Levels || Route.Game in m.stack)) LevelsScreen(m, visible = now == Route.Levels)
                if (now != Route.Levels) GameScreen(m)
            }
            Route.Options -> Sheet { OptionsScreen(m) }
            Route.Achievements -> AchievementsScreen(m)
            Route.Online -> WorldsScreen(m)
            Route.Create -> CreatorScreen(m)
            is Route.Auth -> AuthScreen(m, top.destination)
            is Route.Profile -> Sheet { ProfileScreen(m, top.id) }
            Route.Bookmarks -> BookmarksScreen(m)
            is Route.Players -> PlayersScreen(m, top.kind)
            is Route.Feedback -> FeedbackScreen(m, top.kind)
        }
        }
        }
        m.online.error?.let { message ->
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { m.online.dismissError() },
                title = { Label("Unable to finish", 20.sp) },
                text = { androidx.compose.material3.Text(message, color = LocalPalette.current.ink) },
                confirmButton = { androidx.compose.material3.TextButton(onClick = { m.feedback(Cue.PRESS); m.online.dismissError() }) { androidx.compose.material3.Text("OK", color = LocalPalette.current.accent) } },
                containerColor = LocalPalette.current.paper2,
            )
        }
    } }
}
