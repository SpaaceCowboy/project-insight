package com.insightpuzzle.app

import android.app.Application
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** UI coordination; network/cache/queue ownership stays in OnlineRepository. */
class OnlineState(private val model: GameModel, app: Application, private val scope: CoroutineScope) {
    val repository = OnlineRepository.get(app)
    var user by mutableStateOf(repository.client.user); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf(repository.client.credentialError); private set
    var notice by mutableStateOf<String?>(null); private set
    /** The last background load could not reach the server. Worlds and Profile show a small mark instead of a message; pulling down retries. */
    var offline by mutableStateOf(false)
    /** Background loads: a connection failure only marks [offline]; anything else is reported as usual. */
    fun quiet(error: Throwable) { if (isConnectionError(error)) offline = true else report(error) }
    fun clearMessages() { error = null; notice = null }
    fun inform(text: String) { notice = text }
    fun dismissError() { error = null }
    fun report(error: Throwable) {
        if (error is CancellationException) throw error
        this.error = playerErrorMessage(error)
        Log.e("InsightOnline", "action_failed type=${error.javaClass.simpleName}")
    }
    fun task(block: suspend () -> Unit) {
        if (busy) return
        busy = true; clearMessages()
        scope.launch {
            try { block() }
            // On Worlds and Profile a lost connection is shown by their offline mark, not a dialog.
            catch (error: Exception) { if (isConnectionError(error) && (model.top == Route.Online || model.top is Route.Profile || model.top == Route.Bookmarks || model.top is Route.Players)) { if (error is CancellationException) throw error; offline = true } else report(error) }
            finally { busy = false }
        }
    }
    /** Startup sync runs in the background: it must never hold [busy], or Make and every other button would do nothing while the network is slow. */
    fun initialize() {
        model.selectAccount(user?.id)
        if (user != null) scope.launch {
            try { activate() }
            catch (error: CancellationException) { throw error }
            catch (error: OnlineException) { if (error.status == 401) report(error) else Log.w("InsightOnline", "startup_sync_failed status=${error.status}") }
            catch (error: Exception) { Log.w("InsightOnline", "startup_sync_failed type=${error.javaClass.simpleName}") }
        }
    }
    private var refreshing = false
    /** Silent: flush proofs, sync the outbox, merge server progress. Network trouble is logged, never shown. */
    suspend fun refreshProgress() {
        val account = user?.id ?: return
        if (refreshing) return
        refreshing = true
        try {
            flushProofs()
            repository.sync()
            val progress = repository.fetch("/v1/progress", account)
            if (user?.id == account) model.mergeAccountProgress(progress)
        } catch (error: CancellationException) { throw error }
        catch (error: Exception) { Log.w("InsightOnline", "refresh_failed type=${error.javaClass.simpleName}") }
        finally { refreshing = false }
    }
    fun refreshProgressAsync() { scope.launch { refreshProgress() } }
    fun login(email: String, password: String, destination: Route?, complete: () -> Unit = {}) = task {
        user = repository.client.login(email.trim(), password)
        model.selectAccount(user!!.id)
        complete()
        finishLogin(destination); activate()
    }
    fun register(email: String, password: String, name: String, destination: Route?, complete: () -> Unit) = task {
        user = repository.client.register(email.trim(), password, name)
        model.selectAccount(user!!.id)
        complete()
        finishLogin(destination); activate()
    }
    private suspend fun finishLogin(destination: Route?) {
        if (model.top is Route.Auth) model.back()
        if (destination != null) model.push(destination)
    }
    private suspend fun activate() {
        val account = user?.id ?: return
        if (model.store.importedInto == null) model.store.importedInto = account
        if (model.store.importedInto == account) {
            var imported = repository.cached(account, "guest-import")
            if (imported == null) {
                // Only current levels and badges: the server rejects retired ones.
                val badgeIds = model.achievements.catalog.map { it.id }.toSet()
                imported = OnlineRepository.operation().put("done", JSONArray(model.store.guestProgress().filter { it in 1..model.levels.size }.sorted()))
                    .put("badges", JSONArray(model.store.guestBadges().filter { it in badgeIds }))
                // Enqueue before marking; repeating an import after a killed process cannot award XP.
                repository.enqueue(account, "/v1/progress/import", imported)
                repository.save(account, "guest-import", imported)
            }
            for (proof in model.store.proofs(null)) {
                queueProof(account, proof); model.store.removeProof(proof.getString("operationId"), null)
            }
        }
        flushProofs(); repository.schedule()
        if (!repository.sync()) notice = "Progress is saved. XP will update when Online reconnects."
        val progress = repository.fetch("/v1/progress", account)
        if (user?.id == account) model.mergeAccountProgress(progress)
    }
    private suspend fun queueProof(account: String, proof: JSONObject) {
        val body = JSONObject(proof.toString())
        val endpoint = body.optString("_endpoint", "/v1/completions"); body.remove("_endpoint")
        repository.enqueue(account, endpoint, body)
    }
    suspend fun flushProofs() {
        repository.importProofs(model.store)
        repository.schedule()
    }
    fun completion(proof: JSONObject) {
        model.store.saveProof(proof)
        proofSaved()
    }
    fun proofSaved() {
        if (user != null) scope.launch { try { flushProofs() } catch (error: Exception) { report(error) } }
    }
    fun logout() = task {
        val revoked = repository.client.logout()
        user = null; model.selectAccount(null); model.mainMenu()
        if (!revoked) notice = "Logged out on this device. The server session could not be revoked; it will expire automatically."
    }
}

fun JSONArray.strings(): List<String> = List(length()) { getString(it) }
fun JSONArray.objects(): List<JSONObject> = List(length()) { getJSONObject(it) }
fun JSONObject.board(key: String): Board = getJSONArray(key).strings()
fun List<Pair<Int, Int>>.jsonMoves() = JSONArray(map { listOf(it.first, it.second) })
