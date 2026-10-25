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
        val store = Store(context); store.motion = "on"; store.dev = false
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
            await("Own profile shows its numbered puzzle") { model.playDiscovery.collection(user.id).items.any { it.getInt("levelNumber") == 1 } && has("1") }
            val grid = grids.getJSONObject(0)
            tap("Puzzle 1")
            await("Inline profile puzzle opens") { model.community?.id == grid.getString("id") && model.top == Route.Game }
            instrumentation.runOnMainSync { model.back() }
            await("Leaving the puzzle returns to its profile") { model.top == Route.Profile() && has(user.username) }
            instrumentation.runOnMainSync { model.mainMenu(); model.push(Route.Online) }
            tap("Sort puzzles and filter creation dates")
            await("Discovery search has replaced the collection search") { has("Search creator or code") }
            fill(grid.getString("code"))
            tap("Open code")
            await("Code opens the published puzzle") { model.community?.id == grid.getString("id") && model.top == Route.Game }
            await("Puzzle creator is rendered") { has(user.username + " " + grid.getInt("levelNumber")) }
        } finally {
            instrumentation.runOnMainSync { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }
}
