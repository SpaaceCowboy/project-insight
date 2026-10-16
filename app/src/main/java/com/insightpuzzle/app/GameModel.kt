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
import org.json.JSONObject

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
    data class Auth(val destination: Route? = null) : Route
    data class Profile(val id: String? = null) : Route
    data object Browse : Route
    data class CommunityWorld(val id: String) : Route
    data object Publish : Route
}

/** What a Restart threw away, kept briefly so one stray tap never costs a long attempt. */
class RestartUndo(val level: Int, val board: Board, val path: List<Pair<Int, Int>>, val light: Color, val communityId: String? = null)

data class CommunityAttempt(val grid: JSONObject, val sessionId: String, val account: String) {
    val id get() = grid.getString("id")
    val worldId get() = grid.getString("worldId")
    val spec get() = Level(grid.getString("name"), grid.board("start"), grid.board("target"), 0, 0)
}

data class WorldStat(val world: Int, val total: Int, val solved: Int, val first: Int, val locked: Boolean) { val complete get() = solved == total }

/** App state and the game flow (port of src/useGame.js + src/game-state.js). */
class GameModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    val levels: List<Level> = Levels.parse(app.assets.open("levels.json").bufferedReader().use { it.readText() })
    val achievements = Achievements(levels)
    val audio = Audio(app).apply { enabled = store.sound; effects = store.effects; ambience = store.ambience; voice = store.voice; pauseOverOthers = store.pauseOverOthers; silenceOnUnplug = store.silenceOnUnplug }
    val creator = CreatorState(store.creatorDraft) { store.creatorDraft = it }
    val online = OnlineState(this, app, viewModelScope)
    var community by mutableStateOf<CommunityAttempt?>(null); private set

    /** Screens, bottom to top. The bottom is Home or Game; Pause and Win sit on top of Game. */
    val stack = mutableStateListOf<Route>(Route.Home)
    val top get() = stack.last()

    var done by mutableStateOf(store.done); private set
    var communityDone by mutableStateOf(store.communityDone); private set
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
    var theme by mutableStateOf(store.theme); private set
    var haptics by mutableStateOf(store.haptics); private set
    var motion by mutableStateOf(store.motion); private set
    var moveCounter by mutableStateOf(store.moveCounter); private set
    var animatedBackground by mutableStateOf(store.animatedBackground); private set
    var pauseOverOthers by mutableStateOf(store.pauseOverOthers); private set
    var silenceOnUnplug by mutableStateOf(store.silenceOnUnplug); private set
    var dev by mutableStateOf(store.dev && BuildConfig.DEBUG); private set
    var effects by mutableStateOf(store.effects); private set
    var ambience by mutableStateOf(store.ambience); private set
    var voice by mutableStateOf(store.voice); private set
    var background by mutableStateOf(store.background); private set
    var finish by mutableStateOf(store.finish); private set

    val spec get() = community?.spec ?: levels[level]
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
        online.initialize()
    }

    fun worlds(): List<WorldStat> = levels.withIndex().groupBy { it.value.world }.map { (w, items) ->
        WorldStat(w, items.size, items.count { (it.index + 1) in done }, items.first().index, !dev && items.first().index >= unlocked)
    }

    /** Opens a level, resuming its unfinished attempt if one was saved. */
    private fun load(index: Int, restart: Boolean = false) {
        community = null
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

    fun startCommunity(grid: JSONObject, sessionId: String) {
        val account = online.user?.takeIf { it.verified }?.id ?: return
        winJob?.cancel(); clearRestartUndo()
        community = CommunityAttempt(grid, sessionId, account)
        board = spec.start; moves = 0; path = mutableListOf(); winBadges = emptyList(); light = Art.LIGHT.getValue('B')
        val saved = store.communityAttempt(grid.getString("id"))
        if (saved != null) {
            val width = board[0].length; val recovered = mutableListOf<Pair<Int, Int>>()
            var replay = board; var valid = true
            for (step in saved.split(';')) {
                val parts = step.split(',').mapNotNull { it.toIntOrNull() }
                if (parts.size != 2 || parts.any { it !in 0 until width * board.size }) { valid = false; break }
                val a = Pos(parts[0] / width, parts[0] % width); val b = Pos(parts[1] / width, parts[1] % width)
                if (!Rules.isLegal(replay, a, b) || Rules.key(replay) == Rules.key(spec.target)) { valid = false; break }
                replay = Rules.swap(replay, a, b); recovered += parts[0] to parts[1]
            }
            if (valid && Rules.key(replay) != Rules.key(spec.target)) { board = replay; path = recovered; moves = recovered.size }
        }
        stack.clear(); stack += Route.Game
    }

    private fun saveCurrentAttempt(value: String?) {
        val current = community
        if (current == null) store.saveAttempt(level, value) else store.saveCommunityAttempt(current.id, value)
    }

    fun selectAccount(id: String?) {
        if (store.activeAccount == id) return
        winJob?.cancel(); clearRestartUndo(); community = null
        store.selectAccount(id); done = store.done; communityDone = store.communityDone; earned = store.earned; winBadges = emptyList()
        load(levels.indices.firstOrNull { (it + 1) !in done } ?: 0)
        if (COSMETICS.none { it.id == background && achievements.owns(it, earned) }) { background = "forest"; store.background = background }
        if (COSMETICS.none { it.id == finish && achievements.owns(it, earned) }) { finish = "original"; store.finish = finish }
    }

    fun mergeAccountProgress(json: JSONObject) {
        val solved = json.getJSONArray("done")
        done = done + List(solved.length()) { solved.getInt(it) }; store.done = done
        communityDone = communityDone + (json.optJSONArray("communityDone")?.strings() ?: emptyList()); store.communityDone = communityDone
        earned = earned + json.getJSONArray("badges").strings().associateWith { earned[it] ?: System.currentTimeMillis() }; store.earned = earned
    }

    fun openOnline(destination: Route) {
        if (online.user?.verified == true) {
            if (destination == Route.Publish) online.task { online.repository.remove(online.user!!.id, "publish-draft"); push(destination) }
            else push(destination)
        } else push(Route.Auth(destination))
    }

    fun restart() {
        // Offer to take it back when real work is about to be wiped (not after a solve: that is a deliberate replay).
        if (moves > 0 && !solved) {
            restartUndo = RestartUndo(level, board, path.toList(), light, community?.id)
            undoJob?.cancel()
            undoJob = viewModelScope.launch { delay(6000); restartUndo = null }
        } else clearRestartUndo()
        if (community == null) load(level, restart = true) else {
            winJob?.cancel(); board = spec.start; moves = 0; path = mutableListOf(); saveCurrentAttempt(null)
        }
        audio.play("move", 'B'); if (top == Route.Win || top == Route.Pause) stack.removeAt(stack.lastIndex)
    }

    fun undoRestart() {
        val u = restartUndo ?: return
        clearRestartUndo()
        if (u.level != level || u.communityId != community?.id || solved) return
        board = u.board; moves = u.path.size; path = u.path.toMutableList(); light = u.light
        saveCurrentAttempt(path.joinToString(";") { "${it.first},${it.second}" })
        audio.play("select", 'B')
    }

    private fun clearRestartUndo() { undoJob?.cancel(); restartUndo = null }

    fun next() {
        community?.let { val world = it.worldId; community = null; stack.clear(); stack += Route.Home; stack += Route.Online; stack += Route.CommunityWorld(world); return }
        if (level < levels.size - 1) start(level + 1) else { restart(); stack.clear(); stack += Route.Game }
    }

    /** Applies a legal move (called after the slide animation). */
    fun move(a: Pos, b: Pos) {
        if (!Rules.isLegal(board, a, b) || solved) return
        clearRestartUndo()
        val type = board[a.r][a.c]; val width = board[0].length
        board = Rules.swap(board, a, b); moves++; light = Art.LIGHT.getValue(type)
        path += (a.r * width + a.c) to (b.r * width + b.c)
        val current = community
        if (!dev && current != null && moves == 1) online.completion(OnlineRepository.operation()
            .put("_endpoint", "/v1/play-sessions/${current.sessionId}/move").put("path", path.jsonMoves()))
        if (!solved) { saveCurrentAttempt(path.joinToString(";") { "${it.first},${it.second}" }); return }
        if (!dev) online.completion(OnlineRepository.operation().put("kind", if (current == null) "campaign" else "community")
            .apply { if (current == null) put("levelId", level + 1) else put("sessionId", current.sessionId) }.put("path", path.jsonMoves()))
        if (!dev && current != null) { communityDone = communityDone + current.id; store.communityDone = communityDone }
        saveCurrentAttempt(null)
        if (!dev && current == null) {
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

    fun showLevels() { community?.let { push(Route.CommunityWorld(it.worldId)) } ?: push(Route.Levels(spec.world)) }

    /** Back from Levels: return to Worlds if it is underneath, otherwise replace Levels with Worlds (src/useGame.js backToWorlds). */
    fun backToWorlds() {
        stack.removeAt(stack.lastIndex)
        if (top != Route.Worlds) stack += Route.Worlds
    }

    fun mainMenu() { winJob?.cancel(); community = null; stack.clear(); stack += Route.Home }

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
    fun resolveDark(systemDark: Boolean) = when (theme) { "system" -> systemDark; "light" -> false; else -> true }
    fun changeTheme(value: String) { theme = value; store.theme = value }
    fun toggleHaptics() { haptics = !haptics; store.haptics = haptics }
    fun changeMotion(value: String) { motion = value; store.motion = value }
    fun toggleMoveCounter() { moveCounter = !moveCounter; store.moveCounter = moveCounter }
    fun toggleAnimatedBackground() { animatedBackground = !animatedBackground; store.animatedBackground = animatedBackground }
    fun togglePauseOverOthers() { pauseOverOthers = !pauseOverOthers; store.pauseOverOthers = pauseOverOthers; audio.pauseOverOthers = pauseOverOthers }
    fun toggleSilenceOnUnplug() { silenceOnUnplug = !silenceOnUnplug; store.silenceOnUnplug = silenceOnUnplug; audio.silenceOnUnplug = silenceOnUnplug }

    /** Back to level 1 with nothing solved. Badges and cosmetics stay. */
    fun resetProgress() {
        store.resetProgress()
        clearRestartUndo()
        done = emptySet(); winBadges = emptyList()
        load(0)
    }
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
