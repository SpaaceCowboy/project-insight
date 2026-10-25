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
    data object Levels : Route
    data object Game : Route
    data object Win : Route
    data object Options : Route
    data object Achievements : Route
    data object Online : Route
    data object Create : Route
    data class Auth(val destination: Route? = null) : Route
    data class Profile(val id: String? = null) : Route
    /** Your bookmarked puzzles. */
    data object Bookmarks : Route
    /** Your "following" or "followers" list. */
    data class Players(val kind: String) : Route
    /** Share feedback ("feedback") or Report a bug ("bug"). */
    data class Feedback(val kind: String) : Route
}

/** [source] is the Worlds or profile list the puzzle was opened from; Next continues through it in its current order. */
data class CommunityAttempt(val grid: JSONObject, val sessionId: String, val account: String, val attempt: PlayAttempt? = null, val casual: Boolean = false, val source: DiscoveryListState? = null) {
    val id get() = grid.getString("id")
    val spec get() = Level("", grid.board("start"), grid.board("target"), 0, 0)
}

/** Random's trail this visit: swiping on walks it again before asking for a new puzzle; swiping back stops at the first one. */
class RandomTrail<T> {
    val items = mutableListOf<T>()
    var index = -1
    fun reset() { items.clear(); index = -1 }
    fun add(item: T) { items += item; index = items.lastIndex }
    /** The puzzle [step] away from the current one, if the trail has it. */
    fun at(step: Int): T? = items.getOrNull(index + step)
}

/** App state and the game flow (port of src/useGame.js + src/game-state.js). */
class GameModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    val levels: List<Level> = Levels.parse(app.assets.open("levels.json").bufferedReader().use { it.readText() })
    val achievements = Achievements(levels)
    private val vibration = Haptics(app)
    val audio = Audio(app).apply { enabled = store.sound; effects = store.effects; ambience = store.ambience }
    val creator = CreatorState(store.creatorDraft) { store.creatorDraft = it }
    val online = OnlineState(this, app, viewModelScope)
    val playDiscovery = PlayDiscoveryState()
    var community by mutableStateOf<CommunityAttempt?>(null); private set

    /** Screens, bottom to top. The bottom is Home or Game; Win sits on top of Game. */
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
    var onlineStats by mutableStateOf(OnlineStats()); private set
    /** The open community puzzle's like and bookmark state, toggled from the game screen. */
    var liked by mutableStateOf(false); private set
    var bookmarked by mutableStateOf(false); private set
    private var path = mutableListOf<Pair<Int, Int>>()
    private var winJob: Job? = null
    // Settings
    var sound by mutableStateOf(store.sound); private set
    var theme by mutableStateOf(store.theme); private set
    var haptics by mutableStateOf(store.haptics); private set
    var dev by mutableStateOf(store.dev && BuildConfig.DEBUG); private set
    var effects by mutableStateOf(store.effects); private set
    var ambience by mutableStateOf(store.ambience); private set
    /** Rulebook sandbox: kept for the session so it resumes where the player left it. */
    var rulebookBoard by mutableStateOf(listOf("RBG", "PWY", "BGR"))
    var colorblind by mutableStateOf(store.colorblind.also { Art.colorblind = it }); private set

    val spec get() = community?.spec ?: levels[level]
    val solved get() = Rules.key(board) == Rules.key(spec.target)
    val unlocked get() = if (dev) levels.size else minOf(levels.size, (done.maxOrNull() ?: 0) + 1)
    fun canAccess(index: Int) = index < unlocked
    fun levelTitle(index: Int) = "Level %02d".format(index + 1)

    init {
        val unfinished = levels.indices.firstOrNull { (it + 1) !in done } ?: 0
        val last = store.lastLevel.takeIf { it in levels.indices && store.attempt(it) != null && canAccess(it) }
        load(last ?: minOf(unfinished, unlocked - 1))
        store.background = "forest"
        online.initialize()
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
        stack.clear(); stack += Route.Home; stack += Route.Game
    }

    /** Home's Journey always resolves the active account's campaign save, never a community board. */
    fun startJourney() {
        val last = store.lastLevel.takeIf { it in levels.indices && canAccess(it) && (it + 1) !in done }
        val target = last ?: levels.indices.firstOrNull { canAccess(it) && (it + 1) !in done }
        if (target == null) push(Route.Levels) else {
            start(target)
        }
    }

    fun startCommunity(grid: JSONObject, sessionId: String, casual: Boolean = false, source: DiscoveryListState? = null) {
        val account = online.user?.id ?: return
        if (community != null) failureProof("leave")
        winJob?.cancel()
        community = CommunityAttempt(grid, sessionId, account, casual = casual, source = source)
        liked = grid.optBoolean("liked"); bookmarked = grid.optBoolean("bookmarked")
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
        community = CommunityAttempt(grid, identity.session, account, identity, casual, source)
        store.savePlayAttempt(grid.getString("id"), encodedPath(), identity)
        // Keep the complete Play navigation underneath the game, including restored deep links.
        if (stack.none { it == Route.Online || it is Route.Profile }) { stack.clear(); stack += Route.Home; stack += Route.Online }
        val entry = stack.indexOfLast { it == Route.Game }
        if (entry >= 0) while (stack.size > entry) stack.removeAt(stack.lastIndex)
        if (stack.isEmpty()) { stack += Route.Home; stack += Route.Online }
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
        onlineStats = OnlineStats()
        playDiscovery.clear()
        load(levels.indices.firstOrNull { (it + 1) !in done } ?: 0)
    }

    fun mergeAccountProgress(json: JSONObject) {
        val solved = json.getJSONArray("done")
        done = done + List(solved.length()) { solved.getInt(it) }; store.done = done
        communityDone = communityDone + (json.optJSONArray("communityDone")?.strings() ?: emptyList()); store.communityDone = communityDone
        earned = earned + json.getJSONArray("badges").strings().associateWith { earned[it] ?: System.currentTimeMillis() }; store.earned = earned
        onlineStats = OnlineStats(json.optInt("onlineSolved"), json.optInt("designedCount"), json.optInt("bestStreak"))
    }

    fun toggleLike() = toggleSocial("like", !liked) { liked = it }
    fun toggleBookmark() = toggleSocial("bookmark", !bookmarked) { bookmarked = it }
    /** Optimistic: the icon flips at once and flips back if the server can't be reached or refuses. */
    private fun toggleSocial(kind: String, on: Boolean, set: (Boolean) -> Unit) {
        val grid = community?.id ?: return
        set(on)
        viewModelScope.launch {
            try { online.repository.command("$kind:$grid", "POST", "/v1/grids/$grid/$kind", JSONObject().put("on", on)); playDiscovery.refresh() }
            catch (error: Exception) { if (error is kotlinx.coroutines.CancellationException) throw error; if (community?.id == grid) set(!on); online.quiet(error) }
        }
    }

    fun openOnline(destination: Route) {
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
        if (top == Route.Win) stack.removeAt(stack.lastIndex)
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

    private fun returnToCommunityList() {
        val current = community ?: return
        failureProof("leave")
        // The outgoing game stays composed during page transitions, so its board must match the campaign target.
        load(level)
        val position = stack.indexOfLast { it == Route.Game }
        if (position >= 0) while (stack.size > position) stack.removeAt(stack.lastIndex)
        else { stack.clear(); stack += Route.Home; stack += Route.Online }
        playDiscovery.refresh()
    }

    fun nextCasual() = online.task {
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
            if (community != null) returnToCommunityList()
            online.inform("No community puzzles are available yet.")
        } else {
            startCommunity(response.getJSONObject("grid"), response.getString("sessionId"), casual = true)
            randomTrail.add(response.getJSONObject("grid"))
        }
    }

    val randomTrail = RandomTrail<JSONObject>()
    /** The Random button: a fresh trail, starting with a new random puzzle. */
    fun startRandom() { randomTrail.reset(); nextCasual() }

    /** Swipe through the list a puzzle came from ([step] 1 = next, -1 = previous). False when there is nothing that way. */
    fun swipe(step: Int): Boolean {
        val current = community ?: return false
        if (current.casual) {
            val known = randomTrail.at(step)
            if (known == null) { if (step > 0) nextCasual(); return step > 0 }
            // An earlier (or already seen) random puzzle opens as a normal session but stays part of Random.
            online.task {
                val response = online.repository.command("play:${known.getString("id")}", "POST", "/v1/grids/${known.getString("id")}/sessions")
                startCommunity(response.getJSONObject("grid"), response.getString("sessionId"), casual = true)
                randomTrail.index += step
            }
            return true
        }
        val items = current.source?.items ?: return false
        val at = items.indexOfFirst { it.getString("id") == current.id }
        if (at < 0) return false
        val way = if (step > 0) items.drop(at + 1) else items.take(at).reversed()
        val neighbour = way.firstOrNull { !it.optBoolean("hidden") && !it.optBoolean("moderated") } ?: return false
        playPuzzle(this, neighbour, current.source)
        return true
    }


    fun next() {
        if (community?.casual == true) { swipe(1); return }
        val current = community
        if (current != null) {
            // The next playable puzzle to the right in the list it came from; at the end of that list, back to it.
            val items = current.source?.items.orEmpty()
            val following = items.drop(items.indexOfFirst { it.getString("id") == current.id } + 1)
                .firstOrNull { !it.optBoolean("hidden") && !it.optBoolean("moderated") && items.any { i -> i.getString("id") == current.id } }
            if (following != null) playPuzzle(this, following, current.source) else returnToCommunityList()
            return
        }
        if (level < levels.size - 1) start(level + 1) else showLevels()
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
            val proof = OnlineRepository.operation().put("kind", if (current == null) "campaign" else "community").put("day", java.time.LocalDate.now().toString())
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
            if (top == Route.Game) { stack += Route.Win; audio.play(Cue.SUCCESS) }
        }
    }

    fun push(route: Route) { if (top != route) { if (route == Route.Options) optionsTab = "options"; stack += route } }
    /** Options' open tab, kept while a page opened from it (feedback) is on top, so Back returns to the same tab. */
    var optionsTab by mutableStateOf("options")

    /** Journey's level screen sits on top of the game, so Back (or Now Playing) returns to the level being played. */
    fun showLevels() {
        if (community != null) { returnToCommunityList(); return }
        winJob?.cancel()
        val playing = Route.Game in stack
        stack.clear(); stack += Route.Home; if (playing) stack += Route.Game; stack += Route.Levels
    }

    /** Levels' "Now Playing": back to the open level, or reopen the last one when no game is underneath. */
    fun nowPlaying() {
        if (top == Route.Levels && Route.Game in stack) stack.removeAt(stack.lastIndex) else start(level)
    }

    /** Cropped campaign targets, computed once so the level screen opens without work. */
    val levelTargets: List<Board> = levels.map { Rules.crop(it.target) }

    fun publishCreator() {
        if (creator.phase != Phase.CHECK || dev || creator.proof.isEmpty()) return
        if (online.user == null) { push(Route.Auth(Route.Create)); return }
        online.task {
            val account = online.user?.id ?: return@task
            val identity = creator.creationId
            val proof = JSONObject().put("operationId", identity).put("start", org.json.JSONArray(creator.start!!))
                .put("target", org.json.JSONArray(creator.target!!)).put("path", creator.proof.jsonMoves())
            online.repository.client.request("POST", "/v1/grids", proof, account)
            if (online.user?.id == account && creator.creationId == identity) {
                creator.created(); playDiscovery.refresh(); online.refreshProgressAsync()
            }
        }
    }

    fun mainMenu() {
        failureProof("leave")
        if (community != null) load(level) else winJob?.cancel()
        stack.clear(); stack += Route.Home
    }

    /** System back. Returns false when the app should close (back on the Home screen). */
    fun back(): Boolean {
        when (top) {
            Route.Home -> if (stack.size == 1) return false else stack.removeAt(stack.lastIndex)
            Route.Game, Route.Win -> if (community != null) showLevels() else mainMenu()
            Route.Create -> if (creator.cancelSelection() || creator.stepBack()) Unit else stack.removeAt(stack.lastIndex)
            else -> stack.removeAt(stack.lastIndex)
        }
        return true
    }

    // Settings
    fun toggleSound() { sound = !sound; store.sound = sound; audio.enabled = sound }
    val dark get() = theme != "light"
    fun changeTheme(value: String) { theme = value; store.theme = value }
    fun toggleHaptics() { haptics = !haptics; store.haptics = haptics }
    /** Touch feedback: the 6 ms haptic when Haptics is on, then [cue]'s sound when Sound is on. */
    fun feedback(cue: Cue?) { if (haptics) vibration.tick(); cue?.let(audio::play) }

    /** Back to level 1 with nothing solved. Badges stay. */
    fun resetProgress() {
        store.resetProgress()
        done = emptySet(); winBadges = emptyList()
        load(0)
    }
    fun toggleDev() { dev = !dev; store.dev = dev }
    fun toggleColorblind() { colorblind = !colorblind; store.colorblind = colorblind; Art.colorblind = colorblind }
    fun changeEffects(value: Float) { effects = value; store.effects = value; audio.effects = value }
    fun changeAmbience(value: Float) { ambience = value; store.ambience = value; audio.ambience = value }
    override fun onCleared() { audio.release() }
}
