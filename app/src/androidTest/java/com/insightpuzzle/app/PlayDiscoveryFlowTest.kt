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
        if (android.os.Build.VERSION.SDK_INT >= 33) instrumentation.uiAutomation.clearCache()
        fun collect(n: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = if (!n.refresh()) emptyList() else listOf(n) + (0 until n.childCount).flatMap { n.getChild(it)?.let(::collect) ?: emptyList() }
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
        val deadline = SystemClock.uptimeMillis() + 45000
        while (SystemClock.uptimeMillis() < deadline) { if (condition()) return; SystemClock.sleep(120) }
        capture("online-failure")
        throw AssertionError(message + ": " + nodes().mapNotNull { n -> n.text?.toString()?.let { "$it [visible=${n.isVisibleToUser},clickable=${n.isClickable},enabled=${n.isEnabled}]" } }.joinToString(" | "))
    }
    /** The in-game creator line: username and that creator's puzzle number. */
    private fun creatorLabel(grid: JSONObject) = grid.getString("username") + " " + grid.getInt("levelNumber")
    private fun has(text: String) = nodes().any { it.className != "android.widget.EditText" && it.text?.toString()?.lines()?.contains(text) == true }
    private fun tap(text: String) {
        await("Control unavailable: $text") {
            val found = nodes().lastOrNull { it.className != "android.widget.EditText" && (it.text?.toString()?.lines()?.contains(text) == true || it.contentDescription?.toString() == text) }
            if (found == null) {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            var n: AccessibilityNodeInfo = found
            // Android 8 may cache the old parent's flags when a profile is recomposed after Back.
            while (true) {
                if (!n.refresh()) return@await false
                if (n.isClickable) break
                n = n.parent ?: return@await false
            }
            if (!n.isVisibleToUser) { n.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id); return@await false }
            n.isEnabled && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        SystemClock.sleep(80)
    }
    private fun fill(text: String) {
        await("Search field unavailable") {
            val field = nodes().firstOrNull { it.className == "android.widget.EditText" }
            if (field == null) {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                return@await false
            }
            field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text) }) == true
        }
        SystemClock.sleep(80)
    }
    /** Sort sheets have no Done button: the system Back (or a swipe down) closes them. */
    private fun closeSheet() {
        // The first Back may only close the keyboard; stop once the sort options are gone.
        repeat(2) {
            if (nodes().any { n -> n.text?.toString()?.let { "Most played" in it || "Highest level" in it } == true }) {
                instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK); instrumentation.waitForIdleSync()
            }
        }
        await("Sort sheet returns focus to Worlds") { nodes().any { it.text?.toString() == "Random" } }
        instrumentation.waitForIdleSync()
    }
    private fun pressBack(model: GameModel) { instrumentation.runOnMainSync { model.back() }; instrumentation.waitForIdleSync() }
    private fun typed() = nodes().firstOrNull { it.className == "android.widget.EditText" }?.text?.toString().orEmpty()
    private fun pullDown() {
        val bounds = android.graphics.Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
        SystemClock.sleep(450)
        val down = SystemClock.uptimeMillis()
        for (step in 0..13) {
            val action = when (step) { 0 -> android.view.MotionEvent.ACTION_DOWN; 13 -> android.view.MotionEvent.ACTION_UP; else -> android.view.MotionEvent.ACTION_MOVE }
            // Start below search even when the list is too short to expose a scroll action.
            val y = bounds.top + bounds.height() * (.4f + .35f * minOf(step, 12) / 12f)
            val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, bounds.exactCenterX(), y, 0)
            event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle()
            SystemClock.sleep(25)
        }
    }
    private fun accessibleRefresh() {
        await("Refresh accessibility action") { nodes().any { n -> n.actionList.any { it.label?.toString() == "Refresh" } } }
        val node = nodes().first { n -> n.actionList.any { it.label?.toString() == "Refresh" } }
        assertTrue(node.performAction(node.actionList.first { it.label?.toString() == "Refresh" }.id))
    }
    private fun capture(name: String) {
        instrumentation.uiAutomation.takeScreenshot()?.let { bitmap ->
            File(instrumentation.targetContext.getExternalFilesDir(null), "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
        }
    }

    @Test fun discoveryAndAttemptLifecycleThroughAccessibleControls() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        val testId = java.util.UUID.randomUUID().toString().take(8)
        runBlocking { repository.client.register("discovery-$testId@example.test", "fixture-password", "Discovery $testId") }
        val store = Store(context); store.motion = "on"; store.onboarded = true; store.language = "en"
        val fixture = runBlocking { repository.client.request("GET","/test/discovery",account=null) }
        val failuresBefore = runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures")
        val beatenBefore = runBlocking { repository.client.request("GET", "/v1/grids?query=QA%20Maker") }.getJSONArray("items").getJSONObject(0).getInt("beatenCount")
        val activity = instrumentation.startActivitySync(Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java] }
        await("Startup splash finishes") { model.splashDone }
        try {
            tap("Worlds"); tap("Players")
            await("Published creators must be listed") { has("QA Maker") && has("QA Designer") }
            capture("play-creators")
            assertFalse(has("QA Player"))
            tap("Sort creators"); tap("Most popular puzzles"); closeSheet()
            pullDown(); fill("QA Maker")
            assertEquals("liked", model.playDiscovery.creators.sort)
            await("Creator search must filter results") { has("QA Maker") && !has("QA Designer") }
            tap("QA Maker"); await("Creator row must open profile") { model.top is Route.Profile }
            await("Profile statistics load") { has("QA Maker") && has("Puzzles created") }
            assertFalse("Other profiles must not expose logout", nodes().any { it.contentDescription?.toString() == "Logout" })
            val profileList = model.playDiscovery.collection((model.top as Route.Profile).id!!)
            val profileRevision = profileList.revision
            accessibleRefresh()
            await("Profile refresh reloads inline puzzles") { profileList.revision > profileRevision && profileList.loadedRevision == profileList.revision && !profileList.loading }
            capture("profile-inline")
            pressBack(model); await("Creator search must survive profile navigation") { model.top == Route.Online && model.playDiscovery.creators.query == "QA Maker" }
            tap("Puzzles")
            tap("Sort puzzles and filter creation dates"); tap("Newest"); tap("Today"); closeSheet()
            pullDown(); fill("QA Maker")
            await("Puzzle search must find the seeded puzzle") { model.playDiscovery.puzzles.items.firstOrNull()?.getString("username") == "QA Maker" }
            val seeded = model.playDiscovery.puzzles.items.first()
            assertEquals("Puzzle shows distinct solver and failure counts", beatenBefore, seeded.getInt("beatenCount"))
            assertEquals(failuresBefore, seeded.getInt("failedAttemptCount"))
            capture("play-puzzles")
            tap("Puzzle 1")
            await("Level must open") { model.community != null && model.top == Route.Game }
            val solution = fixture.getJSONArray("solution")
            val width = model.board[0].length
            val first = solution.getJSONArray(0)
            fun firstMove() = instrumentation.runOnMainSync { model.move(Pos(first.getInt(0)/width,first.getInt(0)%width),Pos(first.getInt(1)/width,first.getInt(1)%width)) }
            firstMove()
            instrumentation.runOnMainSync { model.restart() }
            assertEquals(0,model.moves)
            runBlocking { repository.importProofs(store); assertTrue(repository.sync()) }
            assertEquals(failuresBefore+1,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            firstMove(); tap("Options")
            assertEquals(failuresBefore+1,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            pressBack(model)
            assertEquals(1,model.moves)
            pressBack(model)
            await("Leaving gameplay must return to discovery with its query") { model.top == Route.Online && model.playDiscovery.puzzles.query == "QA Maker" }
            runBlocking { repository.importProofs(store); assertTrue(repository.sync()) }
            assertEquals(failuresBefore+2,runBlocking { repository.client.request("GET","/test/discovery-stats",account=null) }.getInt("failures"))
            await("Puzzle filters survive gameplay") { model.playDiscovery.puzzles.sort == "newest" && model.playDiscovery.puzzles.period == "today" }
            tap("Players")
            await("Creator tab must retain independent settings") { model.playDiscovery.creators.query == "QA Maker" && model.playDiscovery.creators.sort == "liked" }
            fill("Nobody matches this query")
            await("Empty search must have an explicit state") { has("No results for these settings.") }
            fill("QA Maker")
            await("Search must recover after empty results") { has("QA Maker") }
            runBlocking { repository.client.request("POST","/test/outage",JSONObject().put("offline",true),account=null) }
            pullDown()
            // The crossed-out signal marks a lost connection without a dialog.
            await("Connection failure must be marked quietly") { model.online.offline && model.online.error == null && nodes().any { it.contentDescription?.toString() == "Offline. Pull down to retry." } }
            await("Cached results must remain while offline") { has("QA Maker") }
            runBlocking { repository.client.request("POST","/test/outage",JSONObject().put("offline",false),account=null) }
            accessibleRefresh()
            await("Pulling again must restore normal results") { has("QA Maker") && !model.playDiscovery.creators.pulling && !model.playDiscovery.creators.failed && !model.online.offline }
            tap("Close search")
            await("Closing search clears the filter without leaving Worlds") { model.top == Route.Online && model.playDiscovery.creators.query.isEmpty() && nodes().none { it.className == "android.widget.EditText" && it.isVisibleToUser } }
            pullDown()
            await("Search can be revealed again") { nodes().any { it.className == "android.widget.EditText" && it.isVisibleToUser } }
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            await("System Back closes search before leaving Worlds") { model.top == Route.Online && nodes().none { it.className == "android.widget.EditText" && it.isVisibleToUser } }
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
        val store = Store(context); store.dev = false; store.motion = "on"; store.onboarded = true; store.language = "en"
        val fixture = runBlocking { repository.client.request("GET", "/test/discovery", account = null) }
        var activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java] }
        await("Startup splash finishes") { model.splashDone }
        try {
            tap("Worlds")
            await("Worlds requires sign-in and retains its destination") { model.top == Route.Auth(Route.Online) }
            instrumentation.runOnMainSync { model.online.login(email, "fixture-password-long", Route.Online) }
            await("Worlds opens after sign-in finishes") { model.top == Route.Online && !model.online.busy }
            tap("Random")
            await("Casual opens a community game") { model.top == Route.Game && model.community?.casual == true }
            val initialSession = model.community!!.sessionId
            val initialGrid = model.community!!.id
            val screen = android.graphics.Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
            fun swipe(forward: Boolean) {
            await("Current Casual board is drawn") { has(creatorLabel(model.community!!.grid)) && nodes().any { it.contentDescription?.toString()?.contains(", row 1, column ") == true } }
            val topTile = android.graphics.Rect().also { rect -> nodes().first { it.contentDescription?.toString()?.contains(", row 1, column ") == true }.getBoundsInScreen(rect) }
            val swipeY = topTile.top - 8f * activity.resources.displayMetrics.density
            SystemClock.sleep(450)
        val down = SystemClock.uptimeMillis()
            for (step in 0..10) {
                val action = when (step) { 0 -> android.view.MotionEvent.ACTION_DOWN; 10 -> android.view.MotionEvent.ACTION_UP; else -> android.view.MotionEvent.ACTION_MOVE }
                val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action,
                    screen.left + screen.width() * (if (forward) .95f - .55f * step / 10f else .05f + .55f * step / 10f), swipeY, 0)
                event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle(); SystemClock.sleep(20)
            }
            }
            swipe(true)
            await("An empty-space left swipe advances Random") { !model.online.busy && model.community?.sessionId != initialSession }
            val nextGrid = model.community!!.id
            swipe(false)
            await("A right swipe returns to Random's previous puzzle") { !model.online.busy && model.randomTrail.index == 0 && model.community?.id == initialGrid }
            swipe(true)
            await("A left swipe reopens the next puzzle from Random's trail") { !model.online.busy && model.randomTrail.index == 1 && model.community?.id == nextGrid }
            val randomGrid = model.community!!.grid
            await("Casual creator is rendered") { has(creatorLabel(randomGrid)) }
            val session = runBlocking { repository.command("casual-test-known", "POST", "/v1/grids/" + fixture.getString("gridId") + "/sessions") }
            instrumentation.runOnMainSync { model.startCommunity(session.getJSONObject("grid"), session.getString("sessionId"), casual = true) }
            val solution = fixture.getJSONArray("solution")
            val width = model.board[0].length
            val first = solution.getJSONArray(0)
            instrumentation.runOnMainSync { model.move(Pos(first.getInt(0) / width, first.getInt(0) % width), Pos(first.getInt(1) / width, first.getInt(1) % width)) }
            val board = model.board
            val knownCreator = creatorLabel(model.community!!.grid)
            tap(knownCreator); await("Creator profile opens") { model.top is Route.Profile }
            pressBack(model); await("Profile returns to the same board") { model.top == Route.Game }
            assertEquals(board, model.board); assertEquals(1, model.moves)
            val monitor = instrumentation.addMonitor(MainActivity::class.java.name, null, false)
            instrumentation.runOnMainSync { activity.recreate() }
            activity = monitor.waitForActivityWithTimeout(10000) as MainActivity
            instrumentation.removeMonitor(monitor)
            instrumentation.runOnMainSync { assertSame(model, ViewModelProvider(activity)[GameModel::class.java]) }
            await("Recreation preserves the casual board") { model.top == Route.Game && has(knownCreator) }
            assertEquals(board, model.board); assertEquals(1, model.moves)
            instrumentation.runOnMainSync { model.restart() }; assertEquals(0, model.moves)
            instrumentation.runOnMainSync {
                for (i in 0 until solution.length()) {
                    val move = solution.getJSONArray(i)
                    model.move(Pos(move.getInt(0) / width, move.getInt(0) % width), Pos(move.getInt(1) / width, move.getInt(1) % width))
                }
            }
            await("Casual win offers Next") { model.top == Route.Win }
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", true), account = null) }
            tap("Next level")
            await("A lost connection is marked quietly and keeps the solved board") { model.online.offline && model.online.error == null && !model.online.busy }
            assertEquals(Route.Win, model.top); assertTrue(model.solved)
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", false), account = null) }
            tap("Next level")
            await("Retry opens a fresh random game") { model.top == Route.Game && model.community?.id != fixture.getString("gridId") }
            assertEquals(1, model.stack.count { it == Route.Game })
            pressBack(model)
            await("Leaving a random game returns to Worlds") { model.top == Route.Online && !model.online.busy }
            assertNull(model.community)
            instrumentation.runOnMainSync { model.selectAccount("casual-other-account") }
            assertTrue(model.communityDone.isEmpty())
            assertEquals(OnlineStats(), model.onlineStats)
        } finally {
            runBlocking { repository.client.request("POST", "/test/outage", JSONObject().put("offline", false), account = null) }
            instrumentation.runOnMainSync { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }

    @Test fun feedbackIsStoredWhileSignedOutAndReturnsToAbout() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig.ONLINE_BASE_URL == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.logout() }
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        try {
            instrumentation.runOnMainSync { model = ViewModelProvider(activity)[GameModel::class.java] }
        await("Startup splash finishes") { model.splashDone }
            tap("Options"); tap("About"); tap("Report a bug")
            await("Signed-out bug report form") { model.top == Route.Feedback("bug") && has("Send") }
            val message = "Fixture report ${java.util.UUID.randomUUID()}"
            fill(message); tap("Send")
            await("Submission returns to About") { model.top == Route.Options && has("Version") }
            val report = runBlocking { repository.client.request("GET", "/test/feedback", account = null) }.getJSONArray("reports").getJSONObject(0)
            assertEquals(message, report.getString("body")); assertEquals("bug", report.getString("kind"))
            assertTrue(report.isNull("user_id")); assertEquals("pending", report.getString("status")); assertEquals(0, report.getInt("attempts"))
            assertEquals(BuildConfig.VERSION_NAME, report.getString("app_version"))
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }

    @Test fun likesBookmarksFollowsAndNextPersistThroughTheService() {
        assumeTrue(!BuildConfig.ONLINE_DEMO && BuildConfig::class.java.getField("ONLINE_BASE_URL").get(null) == "http://10.0.2.2:38861")
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        val id = java.util.UUID.randomUUID().toString().take(8)
        runBlocking { repository.client.register("social-$id@example.test", "fixture-password-long", "Social $id") }
        Store(context).apply { dev = false; motion = "on"; onboarded = true; language = "en" }
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        fun main(action: () -> Unit) { instrumentation.runOnMainSync(action); instrumentation.waitForIdleSync() }
        try {
            main { model = ViewModelProvider(activity)[GameModel::class.java] }
            await("Startup splash finishes") { model.splashDone }
            tap("Worlds")
            await("Worlds has a sequence of puzzles") { model.playDiscovery.puzzles.items.size >= 2 && !model.playDiscovery.puzzles.loading }
            val fixture = runBlocking { repository.client.request("GET", "/test/discovery", account = null) }
            val items = model.playDiscovery.puzzles.items
            val index = items.dropLast(1).indexOfFirst { fixture.getJSONObject("solutions").has(it.getString("id")) }
            assertTrue("Fixture needs a puzzle followed by another", index >= 0)
            val first = items[index]
            val next = items[index + 1].getString("id")
            tap("Puzzle ${index + 1}")
            await("First puzzle opens") { model.top == Route.Game && model.community?.id == first.getString("id") }
            tap("Like puzzle"); tap("Bookmark puzzle")
            await("Like and bookmark reach the service") {
                val rows = runBlocking { repository.client.request("GET", "/v1/grids?bookmarked=true") }.getJSONArray("items").objects()
                rows.any { it.getString("id") == first.getString("id") && it.getBoolean("liked") }
            }
            tap(creatorLabel(first))
            await("Creator profile appears") { has(first.getString("username")) && has("Follow") }
            tap("Follow")
            await("Follow reaches the service") { runBlocking { repository.client.request("GET", "/v1/following") }.getJSONArray("items").objects().any { it.getString("id") == first.getString("ownerId") } }
            pressBack(model); tap("Profile")
            await("Own profile has Bookmarked and Following buttons") { has("Bookmarked") && has("Following") && has("Social $id") }
            tap("Following")
            await("Following opens its own list") { model.top == Route.Players("following") && has(first.getString("username")) }
            pressBack(model); tap("Bookmarked")
            await("Bookmarked opens its own list") { model.top == Route.Bookmarks && model.playDiscovery.bookmarks.items.any { it.getString("id") == first.getString("id") } }
            pressBack(model); pressBack(model)
            val route = fixture.getJSONObject("solutions").getJSONArray(first.getString("id"))
            val width = model.board[0].length
            main { for (i in 0 until route.length()) { val move = route.getJSONArray(i); model.move(Pos(move.getInt(0) / width, move.getInt(0) % width), Pos(move.getInt(1) / width, move.getInt(1) % width)) } }
            await("Community solve is recorded") { model.top == Route.Win && runBlocking { repository.client.request("GET", "/v1/progress") }.getJSONArray("badges").strings().contains("online-1") }
            tap("Next level")
            await("Next follows the source list") { model.top == Route.Game && model.community?.id == next }
        } finally {
            main { activity.finish() }
            runBlocking { repository.client.logout() }
        }
    }
}
