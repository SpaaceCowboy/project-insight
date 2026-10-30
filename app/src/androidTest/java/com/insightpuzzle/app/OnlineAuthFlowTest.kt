package com.insightpuzzle.app

import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
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
            var node: AccessibilityNodeInfo = found
            while (!node.isClickable) node = node.parent ?: return@await false
            if (!node.isVisibleToUser) { node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id); return@await false }
            node.isEnabled && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
    }
    private fun fields() = nodes().filter { it.className == "android.widget.EditText" }
    private fun fill(index: Int, value: String) {
        await("Input unavailable") {
            fields().getOrNull(index)?.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
            }) == true
        }
        SystemClock.sleep(80)
    }

    @Test fun registerWithoutCodeThenLoginAndKeepRejectedPassword() {
        // Only the explicit local fixture is allowed: this test never registers accounts against a deployed service.
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val store = Store(context); val oldMotion = store.motion; store.motion = "on"; store.onboarded = true; store.language = "en"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            val id = UUID.randomUUID().toString().take(12)
            val email = "android-$id@example.test"
            val password = "Puzzle pass! \u067e\u0627\u0632\u0644 123"
            tap("Profile"); tap("Register")
            fill(0, email); fill(1, password); fill(2, "Android $id")
            tap("Create account")
            await("Registration must immediately open the profile") { text("Android $id") && repository.client.user != null }
            assertTrue(repository.client.user != null)
            tap("Logout")
            assertTrue("Opening logout confirmation must keep the account signed in", repository.client.user != null)
            tap("Confirm logout")
            await("Logout must return home") { text("Journey") }
            tap("Profile")
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
}
