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
        fun collect(node: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = listOf(node) + (0 until node.childCount).flatMap { node.getChild(it)?.let(::collect) ?: emptyList() }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::collect) ?: emptyList()
    }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 20000
        while (SystemClock.uptimeMillis() < deadline) {
            if (condition()) return
            SystemClock.sleep(80)
        }
        throw AssertionError(message)
    }
    private fun text(value: String) = nodes().any { it.text?.toString() == value }
    private fun tap(value: String) {
        await("Control unavailable: $value") {
            val found = nodes().lastOrNull { it.text?.toString() == value }
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
        instrumentation.waitForIdleSync()
    }

    @Test fun registerWithoutCodeThenLoginAndKeepRejectedPassword() {
        // Only the explicit local fixture is allowed: this test never registers accounts against a deployed service.
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val store = Store(context); val oldMotion = store.motion; store.motion = "on"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            val id = UUID.randomUUID().toString().take(12)
            val email = "android-$id@example.test"
            val password = "Puzzle pass! \u067e\u0627\u0632\u0644 123"
            tap("Log In"); tap("Register")
            fill(0, email); fill(1, password); fill(2, "Android $id")
            tap("Create account")
            await("Registration must immediately open the profile") { text("Your profile") }
            assertTrue(repository.client.user != null)
            tap("Log out")
            await("Logout must return home") { text("Log In") }
            tap("Log In")
            fill(0, email)
            val rejected = "An incorrect password"
            fill(1, rejected); tap("Log in")
            await("Rejected login must show a visible error") { text("Email or password is incorrect.") }
            tap("OK")
            tap("Show")
            await("A rejected password must remain editable") { fields().getOrNull(1)?.text?.contains(rejected) == true }
            fill(1, password); tap("Hide"); tap("Log in")
            await("Verified credentials must open the account profile") { text("Your profile") }
            assertTrue("Registration and login must use the same password", repository.client.user?.verified == true)
        } finally {
            runBlocking { repository.client.logout() }
            instrumentation.runOnMainSync { activity.finish() }
            store.selectAccount(null); store.motion = oldMotion
        }
    }
}
