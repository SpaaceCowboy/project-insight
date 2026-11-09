package com.insightpuzzle.app

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Operation
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

class OnlineRepository private constructor(private val context: Context) {
    val client = OnlineClient(context)
    private val syncLock = Mutex()
    private val queries get() = OnlineDatabase.get(context).queries()
    // What was last read or saved, kept in memory too: a screen that is rebuilt (a profile after Back from a list) starts from it at once instead of after a database read.
    private val memory = java.util.concurrent.ConcurrentHashMap<String, JSONObject>()
    private fun memoryKey(account: String, key: String) = "$account\u0000$key"
    /** The last value seen for [key] without waiting for the database, or null. */
    fun peek(account: String, key: String): JSONObject? = memory[memoryKey(account, key)]
    suspend fun cached(account: String, key: String): JSONObject? = withContext(Dispatchers.IO) {
        queries.read(account, key)?.let { JSONObject(it) }?.also { memory[memoryKey(account, key)] = it }
    }
    suspend fun save(account: String, key: String, value: JSONObject) = withContext(Dispatchers.IO) {
        memory[memoryKey(account, key)] = value
        queries.save(OnlineDatabase.Record().apply { this.account = account; this.key = key; this.value = value.toString() })
    }
    suspend fun remove(account: String, key: String) = withContext(Dispatchers.IO) { memory.remove(memoryKey(account, key)); queries.remove(account, key) }
    suspend fun fetch(path: String, account: String): JSONObject {
        val result = client.request("GET", path, account = account)
        save(account, path, result)
        return result
    }
    /** Keep an operation ID across retries and process death, including a lost successful response. */
    suspend fun command(key: String, method: String, path: String, body: JSONObject = JSONObject()): JSONObject {
        val account = client.user?.id ?: throw OnlineException(401, "AUTH_REQUIRED", "Please log in.")
        val cacheKey = "command:$key"
        val previous = cached(account, cacheKey)
        val request = if (previous != null && previous.optString("path") == path && previous.optString("method") == method && previous.getJSONObject("input").toString() == body.toString()) previous else
            JSONObject().put("path", path).put("method", method).put("input", body).put("operationId", UUID.randomUUID().toString()).also { save(account, cacheKey, it) }
        val payload = JSONObject(body.toString()).put("operationId", request.getString("operationId"))
        val response = client.request(method, path, payload, account)
        remove(account, cacheKey)
        return response
    }
    suspend fun enqueue(account: String, endpoint: String, payload: JSONObject, scheduleWork: Boolean = true) = withContext(Dispatchers.IO) {
        require(payload.has("operationId"))
        queries.enqueue(OnlineDatabase.Pending().apply {
            id = payload.getString("operationId"); this.account = account; this.endpoint = endpoint
            this.payload = payload.toString(); createdAt = System.currentTimeMillis()
        })
        if (scheduleWork) schedule()
    }
    fun schedule(delayMillis: Long = 0): Operation {
        val work = OneTimeWorkRequestBuilder<OnlineSyncWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(if (BuildConfig.ONLINE_DEMO) NetworkType.NOT_REQUIRED else NetworkType.CONNECTED).build())
            .setInitialDelay(delayMillis.coerceAtLeast(0), TimeUnit.MILLISECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        return WorkManager.getInstance(context).enqueueUniqueWork("online-sync", ExistingWorkPolicy.APPEND_OR_REPLACE, work)
    }
    /** Proofs with a future `_notBefore` stay in preferences until their time comes. */
    suspend fun importProofs(store: Store) {
        val account = client.user?.id ?: return
        var next: Long? = null
        for (proof in store.proofs(account)) {
            val remaining = proof.optLong("_notBefore") - System.currentTimeMillis()
            if (remaining > 0) { next = minOf(next ?: remaining, remaining); continue }
            val body = JSONObject(proof.toString())
            val endpoint = body.optString("_endpoint", "/v1/completions")
            body.remove("_endpoint"); body.remove("_notBefore")
            enqueue(account, endpoint, body, scheduleWork = false)
            store.removeProof(proof.getString("operationId"), account)
        }
        next?.let { schedule(it) }
    }
    suspend fun outcomes(account: String): List<OnlineDatabase.Pending> = withContext(Dispatchers.IO) { queries.outcomes(account) }
    suspend fun sync(): Boolean = syncLock.withLock {
        withContext(Dispatchers.IO) {
            val account = client.user?.id ?: return@withContext true
            var more: Boolean
            do {
                val batch = queries.pending(account)
                more = batch.size == 100
                for (pending in batch) {
                    if (client.user?.id != account) return@withContext true
                    try {
                        val result = client.request("POST", pending.endpoint, JSONObject(pending.payload), account)
                        if (result.has("xpMilli")) save(account, "last-xp", result)
                        queries.acknowledge(account, pending.id)
                    } catch (error: OnlineException) {
                        if (error.status == 401) throw error
                        if ((error.status == 429 || error.status == 503) && error.retryAfterMillis > 0) throw error
                        if (error.status >= 500 || error.status == 429 || error.status == 408) return@withContext false
                        queries.fail(account, pending.id, error.message)
                    } catch (_: IOException) { return@withContext false }
                }
            } while (more)
            true
        }
    }
    companion object {
        @Volatile private var instance: OnlineRepository? = null
        fun get(context: Context): OnlineRepository = instance ?: synchronized(this) {
            instance ?: OnlineRepository(context.applicationContext).also { instance = it }
        }
        fun operation() = JSONObject().put("operationId", UUID.randomUUID().toString())
    }
}

class OnlineSyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = try {
        val repository = OnlineRepository.get(applicationContext)
        repository.importProofs(Store(applicationContext))
        if (repository.sync()) Result.success() else Result.retry()
    } catch (error: OnlineException) {
        if ((error.status == 429 || error.status == 503) && error.retryAfterMillis > 0) {
            // A replacement work item observes the server deadline across process death.
            // Positive jitter avoids synchronized reconnects; the outbox is untouched.
            try {
                val scheduled = OnlineRepository.get(applicationContext).schedule(error.retryAfterMillis + kotlin.random.Random.nextLong(250, 1251))
                // Do not acknowledge this worker until the replacement is durably queued.
                withContext(Dispatchers.IO) { scheduled.result.get(5, TimeUnit.SECONDS) }
                Result.success()
            } catch (failure: Exception) {
                if (failure is kotlinx.coroutines.CancellationException) throw failure
                Log.w("InsightOnline", "sync_reschedule_failed type=${failure.javaClass.simpleName}")
                Result.retry()
            }
        } else Result.retry()
    } catch (error: Exception) {
        if (error is kotlinx.coroutines.CancellationException) throw error
        Log.e("InsightOnline", "sync_failed type=${error.javaClass.simpleName}")
        Result.retry()
    }
}
