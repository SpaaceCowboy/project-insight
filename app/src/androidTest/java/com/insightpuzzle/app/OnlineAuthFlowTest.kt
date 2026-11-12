package com.insightpuzzle.app

import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class OnlineAuthFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(): List<AccessibilityNodeInfo> {
        if (android.os.Build.VERSION.SDK_INT >= 33) instrumentation.uiAutomation.clearCache()
        fun collect(node: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = if (!node.refresh()) emptyList() else listOf(node) + (0 until node.childCount).flatMap { node.getChild(it)?.let(::collect) ?: emptyList() }
        val automation = instrumentation.uiAutomation
        val info = automation.serviceInfo
        if (info.flags and android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS == 0) {
            info.flags = info.flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            automation.serviceInfo = info
        }
        val root = automation.windows.firstOrNull { it.isFocused && it.type == android.view.accessibility.AccessibilityWindowInfo.TYPE_APPLICATION }?.root
            ?: automation.rootInActiveWindow
        return root?.let(::collect) ?: emptyList()
    }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 20000
        while (SystemClock.uptimeMillis() < deadline) {
            if (condition()) return
            SystemClock.sleep(80)
        }
        throw AssertionError(message + ": " + nodes().mapNotNull { it.text?.toString() ?: it.contentDescription?.toString() }.joinToString(" | "))
    }
    private fun text(value: String) = nodes().any {
        it.text?.toString() == value || it.contentDescription?.toString() == value ||
            (android.os.Build.VERSION.SDK_INT >= 28 && it.paneTitle?.toString() == value)
    }
    private fun tap(value: String) {
        await("Control unavailable: $value") {
            val found = nodes().lastOrNull { it.text?.toString() == value || it.contentDescription?.toString() == value }
            if (found == null) {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            var node: AccessibilityNodeInfo? = found
            while (node != null && !node.isClickable) node = node.parent
            if (node == null) {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            if (!node.isVisibleToUser) {
                node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id)
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            node.isEnabled && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
    }
    private fun fields() = nodes().filter { it.className == "android.widget.EditText" }
    private fun fill(index: Int, value: String) {
        await("Input unavailable") {
            val field = fields().getOrNull(index)?.takeIf { it.isEnabled } ?: return@await false
            field.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
            }) == true
        }
        SystemClock.sleep(120)
    }
    /** The local fixture exposes the pending code so the real mail path is not needed on the emulator. */
    private fun recoverCode(email: String): String {
        val encoded = java.net.URLEncoder.encode(email, "UTF-8")
        OkHttpClient().newCall(Request.Builder().url("http://10.0.2.2:38861/test/recover-code?email=$encoded").build()).execute().use { response ->
            return JSONObject(response.body?.string().orEmpty()).getString("code")
        }
    }

    @Test fun registerWithoutCodeThenLoginAndKeepRejectedPassword() {
        // Only the explicit local fixture is allowed: this test never registers accounts against a deployed service.
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val store = Store(context); val oldMotion = store.motion; store.motion = "on"; store.onboarded = true; store.worldsGuided = true; store.onlineGuided = true; store.creatorGuided = true; store.language = "en"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            val id = UUID.randomUUID().toString().take(12)
            val email = "android-$id@example.test"
            val password = "Puzzle pass! \u067e\u0627\u0632\u0644 123"
            tap("Profile"); tap("Register")
            await("Register form ready") { text("Create account") }; SystemClock.sleep(600)
            fill(0, email); fill(1, password); fill(2, password); fill(3, "Android $id")
            tap("Create account")
            await("Registration must immediately open the profile") { text("Android $id") && repository.client.user != null }
            assertTrue(repository.client.user != null)
            tap("Logout")
            assertTrue("Opening logout confirmation must keep the account signed in", repository.client.user != null)
            tap("Confirm logout")
            await("Logout must return home") { text("Journey") }
            tap("Profile")
            await("Login form ready") { text("Forgot password?") }; SystemClock.sleep(600)
            fill(0, email)
            val rejected = "An incorrect password"
            fill(1, rejected); tap("Login")
            await("Rejected login must show a visible error, inline and without a dialog") { text("Email or password is incorrect.") }
            tap("Show password")
            await("A rejected password must remain editable") { fields().getOrNull(1)?.text?.contains(rejected) == true }
            fill(1, password); tap("Hide password"); tap("Login")
            await("Verified credentials must open the account profile") { text("Android $id") && repository.client.user != null }
            assertTrue("Registration and login must use the same password", repository.client.user?.verified == true)
        } finally {
            runBlocking { repository.client.logout() }
            instrumentation.runOnMainSync { activity.finish() }
            store.selectAccount(null); store.motion = oldMotion
        }
    }

    @Test fun resetPasswordByEmailThenAutoLogin() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val store = Store(context); val oldMotion = store.motion; store.motion = "on"; store.onboarded = true; store.worldsGuided = true; store.onlineGuided = true; store.creatorGuided = true; store.language = "en"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            val email = "qa-player@example.test"
            tap("Profile"); await("Login form ready") { text("Forgot password?") }; SystemClock.sleep(600)
            tap("Forgot password?")
            await("Reset form ready") { text("Change password") }; SystemClock.sleep(600)
            fill(0, email); tap("Send code")
            await("A reset code must be queued") { text("If an account exists for this email, a code has been sent.") }
            SystemClock.sleep(600)
            val code = recoverCode(email)
            fill(1, code); fill(2, "recovered-password-123"); fill(3, "recovered-password-123")
            tap("Change password")
            await("A successful reset must sign the player in") { repository.client.user?.username == "QA Player" }
            assertTrue("The reset must leave a usable session", repository.client.user != null)
        } finally {
            runBlocking { repository.client.logout() }
            instrumentation.runOnMainSync { activity.finish() }
            store.selectAccount(null); store.motion = oldMotion
        }
    }

    @Test fun guestJourneyProgressMovesIntoANewAccount() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val store = Store(context); val oldMotion = store.motion
        store.selectAccount(null); store.importedInto = null
        store.done = setOf(1, 2, 3); store.earned = mapOf("first" to System.currentTimeMillis())
        store.saveAttempt(1, "0,1"); store.lastLevel = 1
        store.motion = "on"; store.onboarded = true; store.worldsGuided = true; store.onlineGuided = true; store.creatorGuided = true; store.language = "en"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            val id = UUID.randomUUID().toString().take(12)
            tap("Profile"); tap("Register")
            await("Register form ready") { text("Create account") }; SystemClock.sleep(600)
            fill(0, "guest-$id@example.test"); fill(1, "guest-password-123"); fill(2, "guest-password-123"); fill(3, "Guest $id")
            tap("Create account")
            await("The guest save must immediately belong to the new account") {
                store.done.containsAll(setOf(1, 2, 3)) && store.attempt(1) == "0,1" && store.lastLevel == 1 && repository.client.user != null
            }
            val account = repository.client.user ?: throw AssertionError("Registration did not sign in")
            var serverDone = emptyList<Int>()
            val deadline = SystemClock.uptimeMillis() + 20000
            while (SystemClock.uptimeMillis() < deadline) {
                serverDone = runBlocking {
                    val done = repository.client.request("GET", "/v1/progress", account = account.id).getJSONArray("done")
                    List(done.length()) { done.getInt(it) }
                }
                if (serverDone.containsAll(setOf(1, 2, 3))) break
                SystemClock.sleep(200)
            }
            assertTrue("The server must receive the guest solves: $serverDone", serverDone.containsAll(setOf(1, 2, 3)))
        } finally {
            runBlocking { repository.client.logout() }
            instrumentation.runOnMainSync { activity.finish() }
            store.selectAccount(null); store.done = emptySet(); store.earned = emptyMap()
            store.lastLevel = 0; store.saveAttempt(1, null); store.importedInto = null; store.motion = oldMotion
        }
    }
}
