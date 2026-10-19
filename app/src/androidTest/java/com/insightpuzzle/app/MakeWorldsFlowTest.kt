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

/** Make -> worlds panel -> create a world -> add the level, against the local fixture server (see server/README.md). */
@RunWith(AndroidJUnit4::class)
class MakeWorldsFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(): List<AccessibilityNodeInfo> {
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
        instrumentation.waitForIdleSync()
    }
    private fun fill(text: String) {
        await("Text field unavailable") {
            nodes().firstOrNull { it.className == "android.widget.EditText" }?.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text) }) == true
        }
        instrumentation.waitForIdleSync()
    }

    @Test fun makeLeadsToWorldsPanelWhereWorldsAreCreatedAndLevelsAdded() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        val user = runBlocking { repository.client.register("worlds-${UUID.randomUUID()}@example.test", "fixture-password-long", "World Maker ${UUID.randomUUID().toString().take(8)}") }
        val store = Store(context); store.motion = "on"
        val start = listOf("RBY", "GPW"); val target = listOf("GBY", "RPW")
        store.creatorDraft = JSONObject().put("phase", "CHECK").put("board", org.json.JSONArray(target)).put("start", org.json.JSONArray(start))
            .put("target", org.json.JSONArray(target)).put("path", org.json.JSONArray().put(org.json.JSONArray(listOf(0, 3)))).toString()
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java]; model.push(Route.Publish) }
        await("The worlds panel starts empty") { has("Create a new world") && has("Your worlds will appear here. Tap Create a new world to start.") }
        tap("Create a new world")
        await("Create mode replaces the button with Create") { has("Create") && !has("Create a new world") }
        fill("Kill Zone")
        await("Blocked words are explained before anything is sent") { has("That name isn't allowed. Please choose another.") }
        fill("Fire Garden")
        tap("Create")
        await("The new world is listed and the button is back") { has("Fire Garden") && has("0 / 20 levels") && has("Create a new world") }
        tap("Fire Garden")
        await("The level is added as number 1") { has("Level 1 added to Fire Garden") }
        assertFalse(has("Level name (optional)"))
        assertFalse(has("Add level"))
        val worlds = runBlocking { repository.fetch("/v1/worlds?mine=true", user.id) }.getJSONArray("items")
        assertEquals(1, worlds.length())
        assertEquals(1, worlds.getJSONObject(0).getInt("usedSlots"))
        val grids = runBlocking { repository.fetch("/v1/worlds/${worlds.getJSONObject(0).getString("id")}/grids", user.id) }.getJSONArray("items")
        assertEquals(1, grids.getJSONObject(0).getInt("levelNumber"))
        assertEquals("Level 1", grids.getJSONObject(0).getString("name"))
        tap("Done")
        val worldId = worlds.getJSONObject(0).getString("id")
        runBlocking {
            for (n in 2..20) repository.command("fill-world-" + n, "POST", "/v1/worlds/" + worldId + "/levels", JSONObject()
                .put("name", "").put("start", org.json.JSONArray(start)).put("target", org.json.JSONArray(target))
                .put("path", org.json.JSONArray().put(org.json.JSONArray(listOf(0, 3)))))
        }
        instrumentation.runOnMainSync { model.push(Route.Publish) }
        await("Full worlds explain their capacity") { has("20 / 20 levels · Full") }
        val full = nodes().first { it.text?.toString()?.contains("20 / 20 levels · Full") == true }
        assertTrue(generateSequence(full) { it.parent }.take(5).any { !it.isEnabled })
        instrumentation.runOnMainSync { activity.finish() }
    }
}
