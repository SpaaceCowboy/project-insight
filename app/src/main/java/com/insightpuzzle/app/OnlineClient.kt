package com.insightpuzzle.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.security.KeyStore
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class OnlineUser(val id: String, val username: String, val verified: Boolean) {
    companion object { fun parse(json: JSONObject) = OnlineUser(json.getString("id"), json.getString("username"), json.getBoolean("verified")) }
}
class OnlineException(val status: Int, val code: String, override val message: String) : IOException(message)

/** Credentials never enter Room, regular game preferences, backups, or logs. */
private class CredentialVault(context: Context) {
    private val prefs = context.getSharedPreferences(if (BuildConfig.ONLINE_DEMO) "online_demo_credentials" else "online_credentials", Context.MODE_PRIVATE)
    private val alias = "insight.online.credentials.v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun read(): JSONObject? {
        val saved = prefs.getString("credentials", null) ?: return null
        try {
            val bytes = Base64.decode(saved, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
        } catch (error: Exception) {
            Log.e("InsightOnline", "credential_store_unavailable type=${error.javaClass.simpleName}")
            throw OnlineException(401, "CREDENTIALS_UNAVAILABLE", "Saved login is unavailable. Please log in again.")
        }
    }
    @Synchronized fun save(value: JSONObject?) {
        if (value == null) { check(prefs.edit().clear().commit()) { "Could not clear credentials" }; return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val bytes = cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
        check(prefs.edit().putString("credentials", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit()) { "Could not save credentials" }
    }
}

class OnlineClient(context: Context) {
    private val vault = CredentialVault(context)
    private val sessionLock = Mutex()
    private val demo by lazy { DemoBackend(context) }
    private val http = OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS).callTimeout(20, TimeUnit.SECONDS).retryOnConnectionFailure(false).build()
    @Volatile private var credentials: JSONObject? = null
    @Volatile var credentialError: String? = null; private set
    val configured get() = BuildConfig.ONLINE_DEMO || BuildConfig.ONLINE_BASE_URL.isNotBlank()
    val user: OnlineUser? get() = credentials?.optJSONObject("user")?.let { OnlineUser.parse(it) }
    init {
        try { credentials = vault.read() } catch (error: OnlineException) { credentialError = error.message }
    }
    private fun save(value: JSONObject?) { vault.save(value); credentials = value; credentialError = null }

    private fun raw(method: String, path: String, body: JSONObject?, access: String?): JSONObject {
        if (BuildConfig.ONLINE_DEMO) return demo.request(method, path, body ?: JSONObject(), access)
        if (!configured) throw OnlineException(503, "NOT_CONFIGURED", "Online is not configured for this build.")
        val request = Request.Builder().url(BuildConfig.ONLINE_BASE_URL.trimEnd('/') + path)
            .header("Accept", "application/json").apply {
                if (access != null) header("Authorization", "Bearer $access")
                method(method, if (method == "GET") null else (body ?: JSONObject()).toString().toRequestBody("application/json".toMediaType()))
            }.build()
        val started = System.nanoTime()
        try {
            http.newCall(request).execute().use { response ->
                val correlation = response.header("X-Correlation-ID")?.take(80)?.replace(Regex("[^A-Za-z0-9_-]"), "") ?: "none"
                val route = path.substringBefore('?').replace(Regex("[0-9a-fA-F-]{36}|[A-F0-9]{16}"), ":id")
                Log.i("InsightOnline", "route=$route status=${response.code} latencyMs=${(System.nanoTime() - started) / 1_000_000} correlation=$correlation")
                val text = response.body?.string().orEmpty()
                val json = try { JSONObject(text) } catch (_: org.json.JSONException) {
                    if (!response.isSuccessful) throw OnlineException(response.code, "REQUEST_FAILED",
                        if (response.code == 401) "Your session has expired. Please log in again." else "Online request failed. Please try again.")
                    throw OnlineException(response.code, "INVALID_RESPONSE", "Online returned an unreadable response. Please retry.")
                }
                if (!response.isSuccessful) throw OnlineException(response.code, json.optString("code", "REQUEST_FAILED"), json.optString("message", "Online request failed."))
                return json
            }
        } catch (error: IOException) {
            if (error !is OnlineException) Log.w("InsightOnline", "status=network_failed latencyMs=${(System.nanoTime() - started) / 1_000_000}")
            throw error
        }
    }
    suspend fun request(method: String, path: String, body: JSONObject? = null, account: String? = user?.id): JSONObject = withContext(Dispatchers.IO) {
        val snapshot = credentials
        if (account != null && snapshot?.getJSONObject("user")?.getString("id") != account) throw OnlineException(401, "ACCOUNT_CHANGED", "Please log in to the original account.")
        val access = if (account == null) null else snapshot?.getString("accessToken")
        try { raw(method, path, body, access) }
        catch (error: OnlineException) {
            if (error.status != 401 || account == null) throw error
            sessionLock.withLock {
                val current = credentials ?: throw error
                if (user?.id != account) throw error
                if (current.getString("accessToken") == access) {
                    val refreshId = current.optString("refreshOperation").ifBlank { UUID.randomUUID().toString() }
                    // Save before sending: retrying a lost rotation response uses the same operation ID.
                    save(JSONObject(current.toString()).put("refreshOperation", refreshId))
                    val fresh = raw("POST", "/v1/auth/refresh", JSONObject().put("refreshToken", current.getString("refreshToken")).put("operationId", refreshId), null)
                    save(fresh)
                }
            }
            if (user?.id != account) throw error
            raw(method, path, body, credentials!!.getString("accessToken"))
        }
    }
    suspend fun login(email: String, password: String): OnlineUser = withContext(Dispatchers.IO) {
        sessionLock.withLock {
            val response = raw("POST", "/v1/auth/login", JSONObject().put("email", email).put("password", password), null)
            save(response); user!!
        }
    }
    suspend fun register(email: String, password: String, name: String): OnlineUser = withContext(Dispatchers.IO) {
        sessionLock.withLock {
            val response = raw("POST", "/v1/auth/register", JSONObject().put("email", email).put("password", password).put("name", name), null)
            save(response); user!!
        }
    }
    suspend fun updateVerifiedUser(): OnlineUser = withContext(Dispatchers.IO) {
        val account = user?.id ?: throw OnlineException(401, "AUTH_REQUIRED", "Please log in.")
        val response = request("GET", "/v1/account", account = account)
        sessionLock.withLock {
            if (user?.id != account) throw OnlineException(401, "ACCOUNT_CHANGED", "Account changed.")
            save(JSONObject(credentials!!.toString()).put("user", response.getJSONObject("user")))
            user!!
        }
    }
    suspend fun logout(): Boolean = withContext(Dispatchers.IO) {
        val account = user?.id
        var revoked = false
        if (account != null) {
            try { request("POST", "/v1/auth/logout", account = account); revoked = true }
            catch (error: IOException) { Log.w("InsightOnline", "logout_revocation_pending type=${error.javaClass.simpleName}") }
        }
        sessionLock.withLock { save(null) }
        revoked
    }
}
