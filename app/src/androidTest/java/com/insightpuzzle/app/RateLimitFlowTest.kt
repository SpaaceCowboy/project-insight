package com.insightpuzzle.app

import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class RateLimitFlowTest {
    @Test fun retryAfterSurvivesClientRecreationAndRetainsTheOriginalQueuedOperation() = runBlocking {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repository = OnlineRepository.get(context)
        val controller = OkHttpClient()
        fun throttle(enabled: Boolean): Int {
            val request = Request.Builder().url("http://10.0.2.2:38861/test/throttle-import")
                .post(JSONObject().put("enabled", enabled).toString().toRequestBody("application/json".toMediaType())).build()
            return controller.newCall(request).execute().use { response ->
                assertEquals(200, response.code)
                JSONObject(response.body!!.string()).getInt("importRequests")
            }
        }
        repository.client.logout()
        val account = repository.client.register("cooldown-${UUID.randomUUID()}@example.test", "cooldown-password-123", "Cooldown Tester")
        val operation = OnlineRepository.operation().put("done", JSONArray()).put("badges", JSONArray())
        val id = operation.getString("operationId")
        repository.enqueue(account.id, "/v1/progress/import", operation, scheduleWork = false)
        val queries = OnlineDatabase.get(context).queries()
        try {
            val before = throttle(true)
            val first = try { repository.sync(); throw AssertionError("Expected a retryable 429") }
                catch (error: OnlineException) { error }
            assertEquals(429, first.status)
            assertTrue(first.retryAfterMillis in 1..3000)
            assertEquals(id, queries.pending(account.id).single().id)
            assertTrue(queries.outcomes(account.id).isEmpty())
            assertEquals(before + 1, throttle(false))
            val restored = OnlineClient(context)
            val second = try { restored.request("POST", "/v1/progress/import", operation, account.id); throw AssertionError("Expected the persisted cooldown") }
                catch (error: OnlineException) { error }
            assertEquals(429, second.status)
            assertTrue(second.retryAfterMillis > 0)
            assertEquals(before + 1, throttle(false)) // No network retry before the deadline.
            SystemClock.sleep(second.retryAfterMillis + 200)
            assertTrue(repository.sync())
            assertTrue(queries.pending(account.id).isEmpty())
            assertTrue(queries.outcomes(account.id).isEmpty())
            assertEquals(before + 2, throttle(false))
        } finally {
            throttle(false)
            repository.client.logout()
        }
    }
}
