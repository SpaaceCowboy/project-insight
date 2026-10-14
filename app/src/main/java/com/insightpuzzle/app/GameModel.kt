package com.insightpuzzle.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

sealed interface Route {
    data object Home : Route
    data object Worlds : Route
    data class Levels(val world: Int) : Route
    data object Game : Route
    data object Pause : Route
    data object Win : Route
    data object Options : Route
    data class Achievements(val tab: String = "collection") : Route
    data object Online : Route
    data object Create : Route
}

/** What a Restart threw away, kept briefly so one stray tap never costs a long attempt. */
class RestartUndo(val level: Int, val board: Board, val path: List<Pair<Int, Int>>, val light: Color)

data class WorldStat(val world: Int, val total: Int, val solved: Int, val first: Int, val locked: Boolean) { val complete get() = solved == total }

/** App state and the game flow (port of src/useGame.js + src/game-state.js). */
class GameModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    val levels: List<Level> = Levels.parse(app.assets.open("levels.json").bufferedReader().use { it.readText() })
    val achievements = Achievements(levels)
    val audio = Audio(app).apply { enabled = store.sound; effects = store.effects; ambience = store.ambience; voice = store.voice }
    val creator = CreatorState()

    /** Screens, bottom to top. The bottom is Home or Game; Pause and Win sit on top of Game. */
    val stack = mutableStateListOf<Route>(Route.Home)
    val top get() = stack.last()

    var done by mutableStateOf(store.done); private set
    var earned by mutableStateOf(store.earned); private set
    var level by mutableIntStateOf(0); private set
    var board by mutableStateOf(levels[0].start); private set
    var moves by mutableIntStateOf(0); private set
    var light by mutableStateOf(Art.LIGHT.getValue('B')); private set
    var winBadges by mutableStateOf(emptyList<Badge>()); private set
    var burst by mutableIntStateOf(0); private set
    private var path = mutableListOf<Pair<Int, Int>>()
    private var winJob: Job? = null
    var restartUndo by mutableStateOf<RestartUndo?>(null); private set
    private var undoJob: Job? = null

    // Settings
    var sound by mutableStateOf(store.sound); private set
    var dark by mutableStateOf(store.dark); private set
    var dev by mutableStateOf(store.dev && BuildConfig.DEBUG); private set
    var effects by mutableStateOf(store.effects); private set
    var ambience by mutableStateOf(store.ambience); private set
    var voice by mutableStateOf(store.voice); private set
    var background by mutableStateOf(store.background); private set
    var finish by mutableStateOf(store.finish); private set

    val spec get() = levels[level]
    /** Home's Continue: the unfinished attempt, else the first level not yet solved. Null on a fresh install. */
    val continueLevel: Int? get() {
        if (done.isEmpty() && store.attempt(level) == null) return null
        return if ((level + 1) in done) levels.indices.firstOrNull { (it + 1) !in done && canAccess(it) } ?: level else level
    }
    val solved get() = Rules.key(board) == Rules.key(spec.target)
    val unlocked get() = if (dev) levels.size else minOf(levels.size, (done.maxOrNull() ?: 0) + 1)
    fun canAccess(index: Int) = index < unlocked

    init {
        val unfinished = levels.indices.firstOrNull { (it + 1) !in done } ?: 0
        val last = store.lastLevel.takeIf { it in levels.indices && store.attempt(it) != null && canAccess(it) }
        load(last ?: minOf(unfinished, unlocked - 1))
        // Cosmetics can only stay equipped while owned.
        if (COSMETICS.none { it.id == background && achievements.owns(it, earned) }) background = "forest"
        if (COSMETICS.none { it.id == finish && achievements.owns(it, earned) }) finish = "original"
    }

    fun worlds(): List<WorldStat> = levels.withIndex().groupBy { it.value.world }.map { (w, items) ->
        WorldStat(w, items.size, items.count { (it.index + 1) in done }, items.first().index, !dev && items.first().index >= unlocked)
    }

    /** Opens a level, resuming its unfinished attempt if one was saved. */
    private fun load(index: Int, restart: Boolean = false) {
        winJob?.cancel()
        level = index; board = levels[index].start; moves = 0; path = mutableListOf(); light = Art.LIGHT.getValue('B')
        if (restart) { store.saveAttempt(index, null); return }
        val saved = store.attempt(index) ?: return
        val width = board[0].length
        var replay = board; val steps = mutableListOf<Pair<Int, Int>>(); var color = light
        for (step in saved.split(';')) {
            val parts = step.split(',').map { it.toIntOrNull() ?: return }
            if (parts.size != 2 || parts.any { it !in 0 until width * board.size }) return
            val (a, b) = parts
            val from = Pos(a / width, a % width); val to = Pos(b / width, b % width)
            if (!Rules.isLegal(replay, from, to) || Rules.key(replay) == Rules.key(levels[index].target)) return
            color = Art.LIGHT.getValue(replay[from.r][from.c]); replay = Rules.swap(replay, from, to); steps += a to b
        }
        if (Rules.key(replay) == Rules.key(levels[index].target)) return
        board = replay; moves = steps.size; path = steps; light = color
    }

    fun start(index: Int) {
        if (!canAccess(index)) return
        clearRestartUndo()
        load(index); store.lastLevel = index
        stack.clear(); stack += Route.Game
    }

    fun restart() {
        // Offer to take it back when real work is about to be wiped (not after a solve: that is a deliberate replay).
        if (moves > 0 && !solved) {
            restartUndo = RestartUndo(level, board, path.toList(), light)
            undoJob?.cancel()
            undoJob = viewModelScope.launch { delay(6000); restartUndo = null }
        } else clearRestartUndo()
        load(level, restart = true); audio.play("move", 'B'); if (top == Route.Win || top == Route.Pause) stack.removeAt(stack.lastIndex)
    }

    fun undoRestart() {
        val u = restartUndo ?: return
        clearRestartUndo()
        if (u.level != level || solved) return
        board = u.board; moves = u.path.size; path = u.path.toMutableList(); light = u.light
        store.saveAttempt(level, path.joinToString(";") { "${it.first},${it.second}" })
        audio.play("select", 'B')
    }

    private fun clearRestartUndo() { undoJob?.cancel(); restartUndo = null }

    fun next() {
        if (level < levels.size - 1) start(level + 1) else { restart(); stack.clear(); stack += Route.Game }
    }

    /** Applies a legal move (called after the slide animation). */
    fun move(a: Pos, b: Pos) {
        if (!Rules.isLegal(board, a, b) || solved) return
        clearRestartUndo()
        val type = board[a.r][a.c]; val width = board[0].length
        board = Rules.swap(board, a, b); moves++; light = Art.LIGHT.getValue(type)
        path += (a.r * width + a.c) to (b.r * width + b.c)
        if (!solved) { store.saveAttempt(level, path.joinToString(";") { "${it.first},${it.second}" }); return }
        store.saveAttempt(level, null)
        if (!dev) {
            done = done + (level + 1); store.done = done
            winBadges = achievements.newlyEarned(done, earned)
            if (winBadges.isNotEmpty()) { earned = earned + winBadges.associate { it.id to System.currentTimeMillis() }; store.earned = earned }
        } else winBadges = emptyList()
        winJob = viewModelScope.launch {
            delay(850)
            if (top == Route.Game) { stack += Route.Win; burst++; audio.play("win") }
        }
    }

    fun push(route: Route) { if (top != route) stack += route }

    fun showLevels() { push(Route.Levels(spec.world)) }

    /** Back from Levels: return to Worlds if it is underneath, otherwise replace Levels with Worlds (src/useGame.js backToWorlds). */
    fun backToWorlds() {
        stack.removeAt(stack.lastIndex)
        if (top != Route.Worlds) stack += Route.Worlds
    }

    fun mainMenu() { stack.clear(); stack += Route.Home }

    fun resume() { stack.removeAt(stack.lastIndex); if (solved && top != Route.Win) stack += Route.Win }

    /** System back. Returns false when the app should close (back on the Home screen). */
    fun back(): Boolean {
        when (top) {
            Route.Home -> if (stack.size == 1) return false else stack.removeAt(stack.lastIndex)
            Route.Game -> stack += Route.Pause
            is Route.Levels -> backToWorlds()
            Route.Create -> if (creator.cancelSelection()) Unit else stack.removeAt(stack.lastIndex)
            else -> stack.removeAt(stack.lastIndex)
        }
        return true
    }

    // Settings
    fun toggleSound() { sound = !sound; store.sound = sound; audio.enabled = sound }
    fun toggleDark() { dark = !dark; store.dark = dark }
    fun toggleDev() { dev = !dev; store.dev = dev }
    fun changeEffects(value: Float) { effects = value; store.effects = value; audio.effects = value }
    fun changeAmbience(value: Float) { ambience = value; store.ambience = value; audio.ambience = value }
    fun toggleVoice() { voice = !voice; store.voice = voice; audio.voice = voice }
    fun equip(cosmetic: Cosmetic) {
        if (!achievements.owns(cosmetic, earned)) return
        if (cosmetic.kind == "background") { background = cosmetic.id; store.background = cosmetic.id } else { finish = cosmetic.id; store.finish = cosmetic.id }
    }

    override fun onCleared() { audio.release() }
}
