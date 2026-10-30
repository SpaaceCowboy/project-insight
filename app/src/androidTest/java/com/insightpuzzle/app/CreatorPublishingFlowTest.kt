package com.insightpuzzle.app

import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/** Direct puzzle publishing and code navigation against the isolated v0.2 fixture. */
@RunWith(AndroidJUnit4::class)
class CreatorPublishingFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(): List<AccessibilityNodeInfo> {
        if (android.os.Build.VERSION.SDK_INT >= 33) instrumentation.uiAutomation.clearCache()
        fun collect(n: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = listOf(n) + (0 until n.childCount).flatMap { n.getChild(it)?.let(::collect) ?: emptyList() }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::collect) ?: emptyList()
    }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 45000
        while (SystemClock.uptimeMillis() < deadline) { if (condition()) return; SystemClock.sleep(120) }
        throw AssertionError(message + ": " + nodes().mapNotNull { it.text?.toString() }.joinToString(" | "))
    }
    private fun has(text: String) = nodes().any { it.className != "android.widget.EditText" && it.text?.toString()?.lines()?.contains(text) == true }
    private fun tap(text: String) {
        await("Control unavailable: $text") {
            val found = nodes().lastOrNull { it.className != "android.widget.EditText" && (it.text?.toString()?.lines()?.contains(text) == true || it.contentDescription?.toString() == text) }
            if (found == null) {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            var n: AccessibilityNodeInfo = found
            while (!n.isClickable) n = n.parent ?: return@await false
            if (!n.isVisibleToUser) { n.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id); return@await false }
            n.isEnabled && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        SystemClock.sleep(80)
    }
    private fun fill(text: String) {
        await("Text field unavailable") {
            nodes().firstOrNull { it.className == "android.widget.EditText" }?.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text) }) == true
        }
        SystemClock.sleep(80)
    }

    @Test fun makePublishesDirectlyAndSharedCodeOpensTheNumberedPuzzle() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        val user = runBlocking { repository.client.register("maker-${UUID.randomUUID()}@example.test", "fixture-password-long", "Maker ${UUID.randomUUID().toString().take(8)}") }
        val store = Store(context); store.motion = "on"; store.dev = false; store.onboarded = true; store.language = "en"
        val start = listOf("RBY", "GPW"); val target = listOf("GBY", "RPW")
        store.creatorDraft = JSONObject().put("phase", "CHECK").put("board", org.json.JSONArray(start)).put("start", org.json.JSONArray(start))
            .put("target", org.json.JSONArray(target)).put("construction", org.json.JSONArray().put(org.json.JSONArray(listOf(0, 3))))
            .put("creationId", UUID.randomUUID().toString()).toString()
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java]; model.push(Route.Create) }
        try {
            await("Create is available before manually solving the test board") { has("Create") }
            assertFalse(model.creator.solved)
            tap("Publish level")
            await("Successful publication resets the creator") { has("Puzzle created.") && model.creator.phase == Phase.BUILD && !model.online.busy }
            val grids = runBlocking { repository.fetch("/v1/grids?owner=${user.id}&sort=number", user.id) }.getJSONArray("items")
            assertEquals(1, grids.length()); assertEquals(1, grids.getJSONObject(0).getInt("levelNumber"))
            assertFalse(grids.getJSONObject(0).has("worldId"))
            instrumentation.runOnMainSync { model.push(Route.Profile()); }
            await("Own profile loads its numbered puzzle") { model.playDiscovery.collection(user.id).items.any { it.getInt("levelNumber") == 1 } }
            val grid = grids.getJSONObject(0)
            tap("Puzzle 1")
            await("Inline profile puzzle opens") { model.community?.id == grid.getString("id") && model.top == Route.Game }
            instrumentation.runOnMainSync { model.back() }
            await("Leaving the puzzle returns to its profile") { model.top == Route.Profile() && has(user.username) }
            instrumentation.runOnMainSync { model.mainMenu(); model.push(Route.Online) }
            await("Worlds replaces the outgoing profile before the search gesture") { has("Random") && !has(user.username) && !model.playDiscovery.puzzles.loading }
            val bounds = android.graphics.Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
            SystemClock.sleep(450)
            val down = SystemClock.uptimeMillis()
            for (step in 0..13) {
                val action = when (step) { 0 -> android.view.MotionEvent.ACTION_DOWN; 13 -> android.view.MotionEvent.ACTION_UP; else -> android.view.MotionEvent.ACTION_MOVE }
                val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, bounds.exactCenterX(), bounds.top + bounds.height() * (.3f + .4f * minOf(step, 12) / 12f), 0)
                event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle(); SystemClock.sleep(25)
            }
            await("Pulling reveals discovery search") { has("Search creator or code") }
            assertTrue(nodes().first { it.className == "android.widget.EditText" }.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            fill(grid.getString("code"))
            // Entering the code only reveals the level in the list; Enter must not open it.
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_ENTER)
            await("Code reveals only the published puzzle in Worlds") { !model.playDiscovery.puzzles.loading && model.playDiscovery.puzzles.items.singleOrNull()?.optString("id") == grid.getString("id") }
            assertTrue(model.top != Route.Game)
            tap("Puzzle 1")
            await("Code opens the published puzzle") { model.community?.id == grid.getString("id") && model.top == Route.Game }
            await("Puzzle creator is rendered") { has(user.username + " " + grid.getInt("levelNumber")) }
        } finally {
            instrumentation.runOnMainSync { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }
}
