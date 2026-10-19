package com.insightpuzzle.app

import android.graphics.Bitmap
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class PlayDiscoveryFlowTest {
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
        await("Search field unavailable") {
            nodes().firstOrNull { it.className == "android.widget.EditText" }?.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text) }) == true
        }
        instrumentation.waitForIdleSync()
    }
    private fun pressBack(model: GameModel) { instrumentation.runOnMainSync { model.back() }; instrumentation.waitForIdleSync() }
    private fun typed() = nodes().firstOrNull { it.className == "android.widget.EditText" }?.text?.toString().orEmpty()
    private fun capture(name: String) {
        instrumentation.uiAutomation.takeScreenshot()?.let { bitmap ->
            File(instrumentation.targetContext.getExternalFilesDir(null), "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
        }
    }

    @Test fun discoveryAndAttemptLifecycleThroughAccessibleControls() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.login("qa-player@example.test","fixture-password") }
        val store = Store(context); store.motion = "on"
        val fixture = runBlocking { repository.client.request("GET","/test/discovery",account=null) }
        val failuresBefore = runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures")
        val activity = instrumentation.startActivitySync(Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java] }
        try {
            tap("Worlds"); tap("Find"); tap("Creators")
            await("Published creators must be listed") { has("QA Maker") && has("QA Designer") }
            capture("play-creators")
            assertFalse(has("QA Player"))
            tap("Sort creators"); tap("Most levels designed"); tap("Done")
            await("Creator sort must be selected") { has("Most levels designed") }
            fill("QA Maker")
            await("Creator search must filter results") { has("QA Maker") && !has("QA Designer") }
            tap("QA Maker"); await("Creator row must open profile") { model.top is Route.Profile }
            pressBack(model); await("Creator search must survive profile navigation") { typed().contains("QA Maker") }
            tap("Worlds")
            tap("Sort worlds and filter creation dates"); tap("Newest"); tap("Today"); tap("Done")
            fill("Calm")
            await("World search must find the seeded world") { has("Calm Pool") }
            capture("play-worlds")
            tap("Calm Pool")
            await("World must open before entering its level search") { model.top is Route.CommunityWorld }
            fill("Quiet")
            await("Level search text must be applied") { typed().contains("Quiet") }
            await("World must show distinct solver and failure counts") { has("Beaten by 0 players · $failuresBefore failed attempts") }
            capture("play-world-levels")
            tap("Play")
            await("Level must open") { model.community != null && model.top == Route.Game }
            val solution = fixture.getJSONArray("solution")
            val width = model.board[0].length
            val first = solution.getJSONArray(0)
            fun firstMove() = instrumentation.runOnMainSync { model.move(Pos(first.getInt(0)/width,first.getInt(0)%width),Pos(first.getInt(1)/width,first.getInt(1)%width)) }
            firstMove()
            tap("Restart level")
            assertEquals(0,model.moves)
            runBlocking { repository.importProofs(store); assertTrue(repository.sync()) }
            assertEquals(failuresBefore+1,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            firstMove(); tap("Menu")
            assertEquals(failuresBefore+1,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            tap("Resume")
            assertEquals(1,model.moves)
            tap("Menu"); tap("Levels")
            await("Leaving gameplay must return to the same world") { model.top is Route.CommunityWorld && typed().contains("Quiet") }
            runBlocking { repository.importProofs(store); assertTrue(repository.sync()) }
            assertEquals(failuresBefore+2,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            pressBack(model)
            await("World query and filters must survive Back") { typed().contains("Calm") && has("Newest · Today") }
            tap("Creators")
            await("Creator tab must retain independent settings") { typed().contains("QA Maker") && has("Most levels designed") }
            fill("Nobody matches this query")
            await("Empty search must have an explicit state") { has("No creators match your search.") }
            fill("QA Maker")
            await("Search must recover after empty results") { has("QA Maker") }
            runBlocking { repository.client.request("POST","/test/outage",JSONObject().put("offline",true),account=null) }
            tap("Refresh")
            await("Connection failure must be shown to the player") { nodes().any { it.text?.contains("Could not connect.") == true } }
            tap("OK")
            await("Cached results must remain after dismissing the connection error") { has("QA Maker") }
            runBlocking { repository.client.request("POST","/test/outage",JSONObject().put("offline",false),account=null) }
            tap("Retry")
            await("Retry must restore normal results") { has("QA Maker") && has("Refresh") }
        } finally {
            runBlocking { repository.client.request("POST","/test/outage",JSONObject().put("offline",false),account=null) }
            instrumentation.runOnMainSync { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }
    @Test fun casualReusesGameProfilesAndRetriesWithoutDiscardingSolvedBoard() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        val email = "casual-" + java.util.UUID.randomUUID() + "@example.test"
        runBlocking {
            repository.client.register(email, "fixture-password-long", "Casual " + java.util.UUID.randomUUID().toString().take(8))
            repository.client.logout()
        }
        val store = Store(context); store.dev = false; store.motion = "off"
        val fixture = runBlocking { repository.client.request("GET", "/test/discovery", account = null) }
        var activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java] }
        try {
            tap("Worlds"); tap("Play")
            await("Casual requires sign-in and retains its destination") { model.top == Route.Auth(Route.Casual) }
            instrumentation.runOnMainSync { model.online.login(email, "fixture-password-long", Route.Casual) }
            await("Casual opens a community game") { model.top == Route.Game && model.community?.casual == true }
            val randomGrid = model.community!!.grid
            assertTrue(has(randomGrid.getString("username")))
            assertTrue(has(randomGrid.getString("worldName") + " · Level " + randomGrid.getInt("levelNumber")))
            val session = runBlocking { repository.command("casual-test-known", "POST", "/v1/grids/" + fixture.getString("gridId") + "/sessions") }
            instrumentation.runOnMainSync { model.startCommunity(session.getJSONObject("grid"), session.getString("sessionId"), casual = true) }
            val solution = fixture.getJSONArray("solution")
            val width = model.board[0].length
            val first = solution.getJSONArray(0)
            instrumentation.runOnMainSync { model.move(Pos(first.getInt(0) / width, first.getInt(0) % width), Pos(first.getInt(1) / width, first.getInt(1) % width)) }
            val board = model.board
            tap("QA Maker"); await("Creator profile opens") { model.top is Route.Profile }
            pressBack(model); await("Profile returns to the same board") { model.top == Route.Game }
            assertEquals(board, model.board); assertEquals(1, model.moves)
            val monitor = instrumentation.addMonitor(MainActivity::class.java.name, null, false)
            instrumentation.runOnMainSync { activity.recreate() }
            activity = monitor.waitForActivityWithTimeout(10000) as MainActivity
            instrumentation.removeMonitor(monitor)
            instrumentation.runOnMainSync { assertSame(model, ViewModelProvider(activity)[GameModel::class.java]) }
            await("Recreation preserves the casual board") { model.top == Route.Game && has("QA Maker") }
            assertEquals(board, model.board); assertEquals(1, model.moves)
            tap("Restart level"); assertEquals(0, model.moves)
            instrumentation.runOnMainSync {
                for (i in 0 until solution.length()) {
                    val move = solution.getJSONArray(i)
                    model.move(Pos(move.getInt(0) / width, move.getInt(0) % width), Pos(move.getInt(1) / width, move.getInt(1) % width))
                }
            }
            await("Casual win offers Next") { model.top == Route.Win && has("Next →") }
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", true), account = null) }
            tap("Next →")
            await("Failed selection retains solved board") { model.online.error != null && !model.online.busy }
            assertEquals(Route.Win, model.top); assertTrue(model.solved)
            tap("OK")
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", false), account = null) }
            tap("Next →")
            await("Retry opens a fresh random game") { model.top == Route.Game && model.community?.id != fixture.getString("gridId") }
            assertEquals(1, model.stack.count { it == Route.Game })
            tap("Menu"); tap("Levels")
            await("Leaving returns to the Casual entry") { model.top == Route.Casual && !model.online.busy }
            assertNull(model.community)
            instrumentation.runOnMainSync { model.selectAccount("casual-other-account") }
            assertFalse(model.casualRequested); assertTrue(model.communityDone.isEmpty())
        } finally {
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", false), account = null) }
            instrumentation.runOnMainSync { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }

}
