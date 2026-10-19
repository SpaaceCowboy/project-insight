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
    data object Achievements : Route
    data object Online : Route
    data object Create : Route
    data class Auth(val destination: Route? = null) : Route
    data class Profile(val id: String? = null) : Route
    data object Casual : Route
    data object Browse : Route
    data class CommunityWorld(val id: String) : Route
    data object Publish : Route
    data class ProfileWorlds(val id: String) : Route
}

data class CommunityAttempt(val grid: JSONObject, val sessionId: String, val account: String, val attempt: PlayAttempt? = null, val casual: Boolean = false) {
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
    val audio = Audio(app).apply { enabled = store.sound; effects = store.effects; ambience = store.ambience; pauseOverOthers = store.pauseOverOthers; silenceOnUnplug = store.silenceOnUnplug }
    val creator = CreatorState(store.creatorDraft) { store.creatorDraft = it }
    val online = OnlineState(this, app, viewModelScope)
    val playDiscovery = PlayDiscoveryState()
    var community by mutableStateOf<CommunityAttempt?>(null); private set
    var casualRequested by mutableStateOf(false); private set
    var casualEmpty by mutableStateOf(false); private set

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
    // Settings
    var sound by mutableStateOf(store.sound); private set
    var theme by mutableStateOf(store.theme); private set
    var haptics by mutableStateOf(store.haptics); private set
    var pauseOverOthers by mutableStateOf(store.pauseOverOthers); private set
    var silenceOnUnplug by mutableStateOf(store.silenceOnUnplug); private set
    var dev by mutableStateOf(store.dev && BuildConfig.DEBUG); private set
    var effects by mutableStateOf(store.effects); private set
    var ambience by mutableStateOf(store.ambience); private set
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
    /** 1-based position of a campaign level inside its world (01 to 20). */
    fun numberInWorld(index: Int) = index - levels.indexOfFirst { it.world == levels[index].world } + 1
    fun levelTitle(index: Int) = "World ${levels[index].world} · Level %02d".format(numberInWorld(index))

    init {
        val unfinished = levels.indices.firstOrNull { (it + 1) !in done } ?: 0
        val last = store.lastLevel.takeIf { it in levels.indices && store.attempt(it) != null && canAccess(it) }
        load(last ?: minOf(unfinished, unlocked - 1))
        store.background = "forest"
        validateFinish()
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
        load(index); store.lastLevel = index
        stack.clear(); stack += Route.Game
    }

    fun startCommunity(grid: JSONObject, sessionId: String, casual: Boolean = false) {
        val account = online.user?.id ?: return
        winJob?.cancel()
        community = CommunityAttempt(grid, sessionId, account, casual = casual)
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
        val identity = PlayAttempt.open(if (casual) null else store.playAttempt(grid.getString("id")), sessionId, moves)
        community = CommunityAttempt(grid, identity.session, account, identity, casual)
        store.savePlayAttempt(grid.getString("id"), encodedPath(), identity)
        if (casual) {
            val entry = stack.indexOfLast { it == Route.Casual }
            if (entry >= 0) while (stack.lastIndex > entry) stack.removeAt(stack.lastIndex)
            else { stack.clear(); stack += Route.Home; stack += Route.Online; stack += Route.Casual }
            stack += Route.Game
            return
        }
        // Keep the complete Play navigation underneath the game, including restored deep links.
        if (stack.none { it == Route.Browse }) { stack.clear(); stack += Route.Home; stack += Route.Online; stack += Route.Browse }
        val worldRoute = Route.CommunityWorld(grid.getString("worldId"))
        if (stack.lastOrNull() != worldRoute) stack += worldRoute
        stack += Route.Game
    }

    private fun encodedPath() = path.joinToString(";") { "${it.first},${it.second}" }.ifEmpty { null }

    private fun saveCurrentAttempt(value: String?) {
        val current = community
        if (current == null) store.saveAttempt(level, value) else {
            val identity = current.attempt
            if (identity == null) store.saveCommunityAttempt(current.id, value) else store.savePlayAttempt(current.id, value, identity)
        }
    }

    fun selectAccount(id: String?) {
        if (store.activeAccount == id) return
        winJob?.cancel(); community = null
        store.selectAccount(id); done = store.done; communityDone = store.communityDone; earned = store.earned; winBadges = emptyList()
        casualEmpty = false; casualRequested = false
        playDiscovery.clear()
        load(levels.indices.firstOrNull { (it + 1) !in done } ?: 0)
        validateFinish()
    }

    fun mergeAccountProgress(json: JSONObject) {
        val solved = json.getJSONArray("done")
        done = done + List(solved.length()) { solved.getInt(it) }; store.done = done
        communityDone = communityDone + (json.optJSONArray("communityDone")?.strings() ?: emptyList()); store.communityDone = communityDone
        earned = earned + json.getJSONArray("badges").strings().associateWith { earned[it] ?: System.currentTimeMillis() }; store.earned = earned
    }

    fun openOnline(destination: Route) {
        if (destination == Route.Casual) casualRequested = false
        if (online.user != null) push(destination) else push(Route.Auth(destination))
    }

    fun restart() {
        val current = community
        failureProof("restart")
        if (community == null) load(level, restart = true) else {
            val identity = PlayAttempt.open(null, current!!.sessionId, 0)
            community = current.copy(attempt = identity)
            winJob?.cancel(); board = spec.start; moves = 0; path = mutableListOf(); saveCurrentAttempt(null)
        }
        audio.play("move", 'B'); if (top == Route.Win || top == Route.Pause) stack.removeAt(stack.lastIndex)
    }

    private fun failureProof(reason: String, notBefore: Long = 0): JSONObject? {
        val current = community ?: return null
        val identity = current.attempt ?: return null
        if (!identity.canFail(moves, solved, dev)) return null
        val proof = OnlineRepository.operation().put("_endpoint", "/v1/play-sessions/${current.sessionId}/failures")
            .put("attemptId", identity.id).put("reason", reason).put("path", path.jsonMoves()).put("_notBefore", notBefore)
        store.savePlayAttempt(current.id, encodedPath(), identity.copy(closed = true), proof)
        community = current.copy(attempt = identity.copy(closed = true))
        online.repository.schedule((notBefore - System.currentTimeMillis()).coerceAtLeast(0))
        return proof
    }

    private fun returnToCommunityWorld() {
        val current = community ?: return
        failureProof("leave")
        winJob?.cancel(); community = null
        val route = if (current.casual) Route.Casual else Route.CommunityWorld(current.worldId)
        val position = stack.indexOfLast { it == route }
        if (position >= 0) while (stack.lastIndex > position) stack.removeAt(stack.lastIndex)
        else { stack.clear(); stack += Route.Home; stack += Route.Online; if (!current.casual) stack += Route.Browse; stack += route }
        playDiscovery.refreshWorld(current.worldId)
    }

    fun nextCasual() = online.task {
        casualRequested = true
        val account = online.user?.id ?: return@task
        online.flushProofs()
        if (!online.repository.sync()) throw java.io.IOException("Progress could not be synchronized. Please retry.")
        val rejected = online.repository.outcomes(account).firstOrNull {
            it.state == "failed" && it.endpoint == "/v1/completions" && JSONObject(it.payload).optString("sessionId") == community?.sessionId
        }
        if (rejected != null) throw OnlineException(409, "COMPLETION_REJECTED", rejected.error)
        val response = online.repository.command("casual-next", "POST", "/v1/casual/sessions")
        if (online.user?.id != account || store.activeAccount != account) return@task
        if (response.isNull("grid")) {
            if (community != null) returnToCommunityWorld()
            casualEmpty = true
        } else {
            casualEmpty = false
            startCommunity(response.getJSONObject("grid"), response.getString("sessionId"), casual = true)
        }
    }


    fun next() {
        if (community?.casual == true) { nextCasual(); return }
        if (community != null) { returnToCommunityWorld(); return }
        if (level < levels.size - 1) start(level + 1) else { restart(); stack.clear(); stack += Route.Game }
    }

    /** Applies a legal move (called after the slide animation). */
    fun move(a: Pos, b: Pos) {
        if (!Rules.isLegal(board, a, b) || solved) return
        val type = board[a.r][a.c]; val width = board[0].length
        board = Rules.swap(board, a, b); moves++; light = Art.LIGHT.getValue(type)
        path += (a.r * width + a.c) to (b.r * width + b.c)
        val current = community
        if (!dev && current != null && moves == 1) online.completion(OnlineRepository.operation()
            .put("_endpoint", "/v1/play-sessions/${current.sessionId}/move").put("path", path.jsonMoves()))
        if (!solved) { saveCurrentAttempt(path.joinToString(";") { "${it.first},${it.second}" }); return }
        if (!dev) {
            val proof = OnlineRepository.operation().put("kind", if (current == null) "campaign" else "community")
                .apply { if (current == null) put("levelId", level + 1) else { put("sessionId", current.sessionId); current.attempt?.let { put("attemptId", it.id) } } }.put("path", path.jsonMoves())
            if (current?.attempt != null) {
                store.savePlayAttempt(current.id, null, current.attempt.copy(closed = true), proof)
                online.proofSaved()
            } else online.completion(proof)
        }
        if (!dev && current != null) { communityDone = communityDone + current.id; store.communityDone = communityDone }
        if (current?.attempt != null) {
            community = current.copy(attempt = current.attempt.copy(closed = true))
        }
        saveCurrentAttempt(null)
        if (!dev && current == null) {
            done = done + (level + 1); store.done = done
            winBadges = achievements.newlyEarned(done, earned)
            if (winBadges.isNotEmpty()) { earned = earned + winBadges.associate { it.id to System.currentTimeMillis() }; store.earned = earned; online.refreshProgressAsync() }
        } else winBadges = emptyList()
        winJob = viewModelScope.launch {
            delay(850)
            if (top == Route.Game) { stack += Route.Win; burst++; audio.play("win") }
        }
    }

    fun push(route: Route) { if (top != route) stack += route }

    fun showLevels() { if (community != null) returnToCommunityWorld() else push(Route.Levels(spec.world)) }

    /** Back from Levels: return to Worlds if it is underneath, otherwise replace Levels with Worlds (src/useGame.js backToWorlds). */
    fun backToWorlds() {
        stack.removeAt(stack.lastIndex)
        if (top != Route.Worlds) stack += Route.Worlds
    }

    fun mainMenu() { failureProof("leave"); winJob?.cancel(); community = null; stack.clear(); stack += Route.Home }

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
    val dark get() = theme != "light"
    fun changeTheme(value: String) { theme = value; store.theme = value }
    fun toggleHaptics() { haptics = !haptics; store.haptics = haptics }
    fun togglePauseOverOthers() { pauseOverOthers = !pauseOverOthers; store.pauseOverOthers = pauseOverOthers; audio.pauseOverOthers = pauseOverOthers }
    fun toggleSilenceOnUnplug() { silenceOnUnplug = !silenceOnUnplug; store.silenceOnUnplug = silenceOnUnplug; audio.silenceOnUnplug = silenceOnUnplug }

    /** Back to level 1 with nothing solved. Badges and cosmetics stay. */
    fun resetProgress() {
        store.resetProgress()
        done = emptySet(); winBadges = emptyList()
        load(0)
    }
    fun toggleDev() { dev = !dev; store.dev = dev; validateFinish() }
    fun changeEffects(value: Float) { effects = value; store.effects = value; audio.effects = value }
    fun changeAmbience(value: Float) { ambience = value; store.ambience = value; audio.ambience = value }
    fun equip(cosmetic: Cosmetic) {
        if (cosmetic !in COSMETICS || !achievements.owns(cosmetic, earned, dev)) return
        finish = cosmetic.id; store.finish = finish
    }

    private fun validateFinish() {
        finish = achievements.equippedFinish(finish, earned, dev)
        store.finish = finish
    }

    override fun onCleared() { audio.release() }
}
