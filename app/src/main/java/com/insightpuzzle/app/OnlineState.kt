package com.insightpuzzle.app

import android.app.Application
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
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
    /** What the server can do: the mail mode for reset codes, and whether its Google client is configured. */
    var emailDelivery by mutableStateOf("smtp"); private set
    var googleSignIn by mutableStateOf(BuildConfig.GOOGLE_CLIENT_ID.isNotBlank()); private set
    private var capabilitiesLoaded = false
    /** The last background load could not reach the server. Worlds and Profile show a small mark instead of a message; pulling down retries. */
    var offline by mutableStateOf(false)
    /**
     * Bumped to make every screen whose load failed try again: by [reconnect] while [offline], and by a tap on the end-of-list mark. Loaders add it to their keys.
     * Pulling down still retries at once; this only means the player does not have to.
     */
    var retry by mutableIntStateOf(0); private set
    fun retryNow() { retry++ }
    /** While offline and signed in: wait 2 s, 4 s, 8 s … up to 30 s (a little random so phones do not retry in step), ask the server for progress, and bump [retry]. A 429/503 cooldown is not a connection error, so it never starts this, and the client refuses requests inside one without sending them. */
    suspend fun reconnect() {
        var wait = 2_000L
        while (offline && user != null) {
            delay(wait + kotlin.random.Random.nextLong(0, 500))
            if (!offline) break
            refreshProgress()
            if (offline) retry++
            wait = (wait * 2).coerceAtMost(30_000L)
        }
    }
    /** Background loads: a connection failure only marks [offline]; anything else is reported as usual. */
    fun quiet(error: Throwable) { if (isConnectionError(error)) offline = true else report(error) }
    /** The server's reason for refusing a username; the sign-up form shows it as the one line under the username box. */
    var nameError by mutableStateOf<String?>(null); private set
    fun clearMessages() { error = null; notice = null; nameError = null }
    fun clearNameError() { nameError = null }
    fun inform(text: String) { notice = text }
    fun dismissError() { error = null }
    fun report(error: Throwable) {
        if (error is CancellationException) throw error
        if (isNameError(error)) nameError = playerErrorMessage(error) else this.error = playerErrorMessage(error)
        Log.e("InsightOnline", "action_failed type=${error.javaClass.simpleName}")
    }
    fun task(block: suspend () -> Unit) {
        if (busy) return
        busy = true; clearMessages()
        scope.launch {
            try { block() }
            // A lost connection is only ever shown by the offline mark (Worlds, Profile and their lists), never by a message or dialog.
            catch (error: Exception) { if (error is CancellationException) throw error; quiet(error) }
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
            // The server answered, so whatever marked the connection lost is over; screens that failed reload on [retry].
            if (offline) { offline = false; retry++ }
        } catch (error: CancellationException) { throw error }
        catch (error: Exception) { Log.w("InsightOnline", "refresh_failed type=${error.javaClass.simpleName}") }
        finally { refreshing = false }
    }
    fun refreshProgressAsync() { scope.launch { refreshProgress() } }
    /** A quiet capabilities read; the auth screen keeps its safe defaults when the server cannot be reached. */
    fun loadCapabilities() {
        if (capabilitiesLoaded || BuildConfig.ONLINE_DEMO) return
        capabilitiesLoaded = true
        scope.launch {
            try {
                val result = repository.client.capabilities()
                emailDelivery = result.optString("emailDelivery", "smtp")
                googleSignIn = result.optBoolean("googleSignIn", googleSignIn)
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { capabilitiesLoaded = false; Log.w("InsightOnline", "capabilities_failed type=${error.javaClass.simpleName}") }
        }
    }
    /** The first Google call may return a suggested name; the form then asks the player and calls again with it. */
    fun google(idToken: String, name: String?, destination: Route?, needsName: (String) -> Unit) = task {
        val result = repository.client.google(idToken, name)
        val signed = result.user
        if (signed == null) { needsName(result.suggestedName.orEmpty()); return@task }
        user = signed
        model.selectAccount(signed.id)
        finishLogin(destination); activate()
    }
    fun requestRecovery(email: String) = task {
        repository.client.requestRecovery(email.trim())
        notice = tr("If an account exists for this email, a code has been sent.")
    }
    fun recover(email: String, code: String, password: String, destination: Route?, complete: () -> Unit = {}) = task {
        val signed = repository.client.recover(email.trim(), code.trim(), password)
        user = signed
        model.selectAccount(signed.id)
        complete()
        finishLogin(destination); activate()
    }
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
        val firstAccount = model.store.importedInto == null
        if (firstAccount) {
            model.store.importedInto = account
            // Bring the guest save into the account at once, so Journey shows it before the server answers.
            model.claimGuestProgress()
        }
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
        // No connection is shown by the offline mark on Worlds and Profile, never by a line of text.
        if (!repository.sync()) offline = true
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
        if (user != null) scope.launch { try { flushProofs() } catch (error: Exception) { if (error is CancellationException) throw error; quiet(error) } }
    }
    fun logout() = task {
        val revoked = repository.client.logout()
        user = null; model.selectAccount(null); model.mainMenu()
        if (!revoked) notice = tr("Logged out on this device. The server session could not be revoked; it will expire automatically.")
    }
}

fun JSONArray.strings(): List<String> = List(length()) { getString(it) }
fun JSONArray.objects(): List<JSONObject> = List(length()) { getJSONObject(it) }
fun JSONObject.board(key: String): Board = getJSONArray(key).strings()
fun List<Pair<Int, Int>>.jsonMoves() = JSONArray(map { listOf(it.first, it.second) })
