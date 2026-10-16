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
import java.io.IOException

/** UI coordination; network/cache/queue ownership stays in OnlineRepository. */
class OnlineState(private val model: GameModel, app: Application, private val scope: CoroutineScope) {
    val repository = OnlineRepository.get(app)
    var user by mutableStateOf(repository.client.user); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf(repository.client.credentialError); private set
    var notice by mutableStateOf<String?>(null); private set
    var emailDeliveryMode by mutableStateOf("smtp"); private set
    var firstWords by mutableStateOf(listOf("Amber", "Calm", "Clear", "Gentle", "Golden", "Quiet", "Silver", "Soft", "Still", "Warm")); private set
    var secondWords by mutableStateOf(listOf("Brook", "Cove", "Dawn", "Fern", "Grove", "Leaf", "Meadow", "Pebble", "Pool", "Tide")); private set
    fun clearMessages() { error = null; notice = null }
    fun report(error: Throwable) {
        if (error is CancellationException) throw error
        this.error = when (error) {
            is OnlineException -> error.message
            is IOException -> "Could not connect. Your saved work is safe. Please retry when connected."
            else -> "Online could not finish this action. Please retry."
        }
        Log.e("InsightOnline", "action_failed type=${error.javaClass.simpleName}")
    }
    fun task(block: suspend () -> Unit) {
        if (busy) return
        busy = true; clearMessages()
        scope.launch { try { block() } catch (error: Exception) { report(error) } finally { busy = false } }
    }
    fun initialize() {
        model.selectAccount(user?.id)
        if (user?.verified == true) task { activate() }
    }
    suspend fun vocabulary() {
        val response = repository.client.request("GET", "/v1/vocabulary", account = null)
        firstWords = response.getJSONArray("first").strings(); secondWords = response.getJSONArray("second").strings()
        emailDeliveryMode = repository.client.request("GET", "/v1/capabilities", account = null).getString("emailDelivery")
    }
    fun login(email: String, password: String, destination: Route?) = task {
        user = repository.client.login(email.trim(), password)
        model.selectAccount(user!!.id)
        if (user!!.verified) { activate(); finishLogin(destination) }
        else notice = "Enter the verification code from your email to continue."
    }
    fun register(email: String, password: String, name: String, complete: () -> Unit) = task {
        repository.client.request("POST", "/v1/auth/register", JSONObject().put("email", email.trim()).put("password", password).put("name", name), account = null)
        notice = "If eligible, your verification email has been queued. Delivery may take a moment."
        complete()
    }
    fun rename(name: String, complete: () -> Unit) = task {
        if (!Nicknames.valid(name)) throw OnlineException(400, "INVALID_NICKNAME", Nicknames.REQUIREMENT)
        repository.command("nickname", "PATCH", "/v1/account/name", JSONObject().put("name", Nicknames.normalize(name)))
        user = repository.client.updateVerifiedUser()
        notice = "Nickname saved."
        complete()
    }
    fun requestCode(email: String, recover: Boolean) = task {
        repository.client.request("POST", "/v1/auth/${if (recover) "recover" else "verify"}/request", JSONObject().put("email", email.trim()), account = null)
        notice = "If eligible, an email code has been queued."
    }
    fun confirm(email: String, code: String, password: String?, destination: Route?, complete: () -> Unit) = task {
        val recover = password != null
        repository.client.request("POST", "/v1/auth/${if (recover) "recover" else "verify"}/confirm",
            JSONObject().put("email", email.trim()).put("code", code.trim()).apply { if (password != null) put("password", password) }, account = null)
        if (!recover && user != null) {
            user = repository.client.updateVerifiedUser(); activate(); finishLogin(destination)
        } else {
            if (recover && user != null) { repository.client.logout(); user = null; model.selectAccount(null) }
            notice = if (recover) "Password changed. Please log in." else "Email verified. Please log in."
            complete()
        }
    }
    private suspend fun finishLogin(destination: Route?) {
        if (model.top is Route.Auth) model.back()
        if (destination == Route.Publish) repository.remove(user!!.id, "publish-draft")
        if (destination != null) model.push(destination)
    }
    private suspend fun activate() {
        val account = user?.takeIf { it.verified }?.id ?: return
        if (model.store.importedInto == null) model.store.importedInto = account
        if (model.store.importedInto == account) {
            var imported = repository.cached(account, "guest-import")
            if (imported == null) {
                imported = OnlineRepository.operation().put("done", JSONArray(model.store.guestProgress().sorted())).put("badges", JSONArray(model.store.guestBadges()))
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
        val account = user?.takeIf { it.verified }?.id ?: return
        for (proof in model.store.proofs(account)) {
            queueProof(account, proof); model.store.removeProof(proof.getString("operationId"), account)
        }
    }
    fun completion(proof: JSONObject) {
        model.store.saveProof(proof)
        if (user?.verified == true) scope.launch { try { flushProofs() } catch (error: Exception) { report(error) } }
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
