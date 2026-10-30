package com.insightpuzzle.app

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.graphics.drawable.AdaptiveIconDrawable
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Device-only preview tests: no requests reach a deployed service. */
@RunWith(AndroidJUnit4::class)
class MainMenuFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private var activity: MainActivity? = null
    private lateinit var model: GameModel
    private var savedPreferences: Map<String, *>? = null

    @Before fun prepareGuest() {
        assumeTrue(BuildConfig.ONLINE_DEMO)
        savedPreferences = context.getSharedPreferences("insight_demo", 0).all.toMap()
        runBlocking { OnlineRepository.get(context).client.logout() }
        Store(context).apply {
            selectAccount(null); resetProgress(); earned = emptyMap(); dev = false
            motion = "on"; sound = false; importedInto = "problem15-no-import"; onboarded = true; language = "en"
        }
    }

    @After fun cleanup() {
        val saved = savedPreferences ?: return
        close()
        runBlocking { OnlineRepository.get(context).client.logout() }
        val edit = context.getSharedPreferences("insight_demo", 0).edit().clear()
        saved.forEach { (key, value) ->
            when (value) {
                is String -> edit.putString(key, value)
                is Int -> edit.putInt(key, value)
                is Long -> edit.putLong(key, value)
                is Float -> edit.putFloat(key, value)
                is Boolean -> edit.putBoolean(key, value)
                is Set<*> -> edit.putStringSet(key, value.filterIsInstance<String>().toSet())
                else -> error("Unexpected preference type: $key")
            }
        }
        assertTrue(edit.commit())
    }

    private fun main(action: () -> Unit) { instrumentation.runOnMainSync(action); instrumentation.waitForIdleSync() }
    private fun launch() {
        val previousWindow = instrumentation.uiAutomation.rootInActiveWindow?.windowId
        activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        main { model = ViewModelProvider(activity!!)[GameModel::class.java] }
        await("new Home window") { model.splashDone && activity!!.hasWindowFocus() && instrumentation.uiAutomation.rootInActiveWindow?.windowId != previousWindow && has("Journey") }
    }
    private fun close() { activity?.let { a -> main { a.finish() } }; activity = null }
    private fun nodes(): List<AccessibilityNodeInfo> {
        fun collect(n: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = listOf(n) + (0 until n.childCount).flatMap { n.getChild(it)?.let(::collect) ?: emptyList() }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::collect) ?: emptyList()
    }
    private fun matches(n: AccessibilityNodeInfo, label: String) = n.text?.toString() == label || n.contentDescription?.toString() == label
    private fun has(label: String) = nodes().any { matches(it, label) }
    private fun await(label: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 15000
        while (SystemClock.uptimeMillis() < deadline) {
            if (condition()) return
            SystemClock.sleep(80)
        }
        fail("Timed out waiting for $label; route=${model.top}; level=${model.level}; board=${model.board}; busy=${model.online.busy}; error=${model.online.error}; visible=${nodes().mapNotNull { it.text?.toString() ?: it.contentDescription?.toString() }.joinToString(" | ")}")
    }
    private fun control(label: String): AccessibilityNodeInfo {
        var node = nodes().last { matches(it, label) }
        while (!node.isClickable) node = node.parent ?: error("No clickable parent for $label")
        return node
    }
    private fun tap(label: String) {
        await("click $label") {
            var node = nodes().lastOrNull { matches(it, label) } ?: run {
                nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                return@await false
            }
            while (!node.isClickable) node = node.parent ?: return@await false
            node.isVisibleToUser && node.isEnabled && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        instrumentation.waitForIdleSync()
    }
    private fun back() = main { assertTrue(model.back()) }
    private fun swipeAcross(y: Float, forward: Boolean) {
        val screen = Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
        SystemClock.sleep(450) // Let the 400ms screen-transition touch lock settle.
        val down = SystemClock.uptimeMillis()
        for (step in 0..10) {
            val action = when (step) { 0 -> android.view.MotionEvent.ACTION_DOWN; 10 -> android.view.MotionEvent.ACTION_UP; else -> android.view.MotionEvent.ACTION_MOVE }
            val x = screen.left + screen.width() * (if (forward) .95f - .55f * step / 10 else .05f + .55f * step / 10)
            val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0)
            event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle(); SystemClock.sleep(20)
        }
        instrumentation.waitForIdleSync()
    }
    private fun progress(done: Set<Int>) = model.mergeAccountProgress(JSONObject().put("done", JSONArray(done.sorted())).put("badges", JSONArray()))
    private fun login() {
        tap("Profile"); tap("Enter local preview")
        await("own profile") { has("Logout") && has("Achievements") }
    }

    @Test fun firstPlayGuideAndLanguageChangesKeepTheirPreferences() {
        Store(context).onboarded = false
        launch()
        main {
            model.start(0)
            assertEquals(1, model.guidePhase)
            assertTrue(Store(context).onboarded)
        }
        for (step in 1..4) {
            assertEquals(step, model.guidePhase)
            tap("Tap to continue")
            await("Next gameplay tip") { model.guidePhase == if (step == 4) 0 else step + 1 }
        }
        assertEquals(0, model.moves)
        assertEquals(model.spec.start, model.board)
        main {
            model.toggleGuide()
            assertFalse(Store(context).guide)
            model.mainMenu()
            model.changeLanguage("es")
        }
        await("translated Home") { has(tr("Journey")) && has(tr("Options")) }
        assertEquals("es", Store(context).language)
        main { model.changeLanguage("en") }
        await("English Home") { has("Journey") }
    }

    @Test fun headerAndPauseNavigationRemainAccessible() {
        Store(context).motion = "system"
        launch()
        assertFalse(has("Continue")); assertFalse(has("What's Next")); assertFalse(has("Achievements"))
        assertEquals("Only four home actions", 4, nodes().count { it.isClickable })
        tap("Options"); assertEquals(Route.Options, model.top)
        tap("Rulebook"); await("rulebook") { nodes().any { it.contentDescription?.toString()?.startsWith("Red slides") == true } }
        tap("Back"); assertEquals(Route.Home, model.top)
        tap("Profile"); assertEquals(Route.Auth(Route.Profile()), model.top); back()
        tap("Worlds"); assertEquals(Route.Auth(Route.Online), model.top); back()
        tap("Journey"); assertEquals(Route.Game, model.top); assertEquals(0, model.level)
        tap("Options"); assertEquals(Route.Options, model.top); back()
        // Journey: the level screen opens from "Journey N" above the target; Back returns to the game, then Home.
        tap("Journey 1"); assertEquals(Route.Levels, model.top)
        back(); assertEquals(Route.Game, model.top)
        back(); assertEquals(Route.Home, model.top)
    }

    @Test fun journeyRestoresSavedMovesAndReopensTheLastPlayedLevel() {
        Store(context).apply { done = setOf(1); lastLevel = 1 }
        launch(); tap("Journey"); assertEquals(1, model.level)
        main { model.move(Pos(0, 1), Pos(1, 1)) }
        assertEquals(1, model.moves); assertFalse(model.solved)
        val board = model.board
        main { model.mainMenu() }
        close(); launch(); tap("Journey")
        assertEquals(1, model.level); assertEquals(board, model.board); assertEquals(1, model.moves)
        main { model.move(Pos(0, 1), Pos(0, 0)); assertTrue(model.solved); model.mainMenu() }
        tap("Journey"); assertEquals(1, model.level)
        main { model.resetProgress(); model.mainMenu() }
        tap("Journey"); assertEquals(0, model.level); assertEquals(0, model.moves)
    }

    @Test fun journeyUsesAccountScopedLastLevelAndRejectsInvalidOrLockedSaves() {
        launch()
        main {
            model.selectAccount("problem15-a"); model.resetProgress(); progress(setOf(1, 3))
            model.start(3); model.mainMenu()
            model.selectAccount("problem15-b"); model.resetProgress(); progress(setOf(1))
            model.start(1); model.mainMenu()
            model.selectAccount("problem15-a"); model.startJourney()
            // The last unfinished level wins over an earlier unsolved level.
            assertEquals(3, model.level)
            model.start(0); model.mainMenu(); model.startJourney(); assertEquals(0, model.level)
            model.mainMenu() // A solved replay is still the last level played.
            model.selectAccount("problem15-b"); model.startJourney(); assertEquals(1, model.level)
            model.mainMenu(); model.store.lastLevel = model.levels.lastIndex
            model.startJourney(); assertEquals(1, model.level) // Locked saved level.
            model.mainMenu(); model.store.lastLevel = -1
            model.startJourney(); assertEquals(1, model.level)
            model.mainMenu(); model.store.lastLevel = Int.MAX_VALUE
            model.startJourney(); assertEquals(1, model.level)
            model.mainMenu(); progress((1..model.levels.size).toSet()); model.store.lastLevel = -1; model.startJourney()
            assertEquals(Route.Levels, model.top)
            model.selectAccount(null); model.mainMenu(); model.startJourney(); assertEquals(0, model.level)
        }
    }

    @Test fun profileAchievementLinkAndCommunityPlayKeepCampaignResume() {
        Store(context).motion = "system"
        launch(); login()
        tap("Achievements"); assertEquals(Route.Achievements, model.top)
        back(); assertEquals(Route.Profile(), model.top)
        val discovery = runBlocking { model.online.repository.fetch("/v1/creators", model.online.user!!.id) }
        val other = discovery.getJSONArray("items").getJSONObject(0)
        val otherId = other.getString("id")
        main { model.push(Route.Profile(otherId)) }
        await("other profile") { has(other.getString("username")) && has("Achievements") }
        assertFalse("Other players' collection must not open our achievements", nodes().first { it.text?.toString() == "Achievements" }.isClickable)
        // Check the whole row, not just its text node.
        var row = nodes().first { it.text?.toString() == "Achievements" }
        while (row.parent != null) { assertFalse("Public achievement row must be read-only", row.isClickable); row = row.parent }
        main {
            model.resetProgress(); progress(setOf(1)); model.store.lastLevel = 1; model.mainMenu(); model.startJourney()
            model.move(Pos(0, 1), Pos(1, 1))
        }
        val campaignBoard = model.board
        main {
            val spec = model.levels[2]
            val grid = JSONObject().put("id", "problem15-community").put("ownerId", "problem15-owner").put("username", "QA Creator").put("levelNumber", 1)
                .put("name", "Resume test").put("start", JSONArray(spec.start)).put("target", JSONArray(spec.target))
            model.startCommunity(grid, "problem15-session")
            assertNotNull(model.community); assertEquals(1, model.store.lastLevel)
            model.mainMenu()
            assertEquals(campaignBoard, model.board); assertEquals(1, model.moves)
            model.startCommunity(grid, "problem15-session-back")
            model.showLevels()
            assertNull(model.community); assertEquals(campaignBoard, model.board); assertEquals(1, model.moves)
            model.mainMenu()
        }
        tap("Journey")
        assertNull(model.community); assertEquals(1, model.level); assertEquals(campaignBoard, model.board); assertEquals(1, model.moves)
    }

    @Test fun optionsPracticeAndPalettePreserveCampaignProgress() {
        launch()
        val campaign = model.board
        val done = model.done
        val badges = model.earned
        tap("Options"); tap("About")
        await("About version") { has("Version") && has("Share feedback") && has("Report a bug") }
        tap("Report a bug")
        await("Bug report page") { model.top == Route.Feedback("bug") && has("Send") }
        instrumentation.runOnMainSync { model.back() }; instrumentation.waitForIdleSync()
        await("Back to About") { model.top == Route.Options && has("Version") }
        tap("Licences")
        await("Bundled font licence") { model.top == Route.Licences && has("JetBrains Mono") }
        tap("Back")
        assertFalse(has("Reset level progress")); assertFalse(has("Obsidian"))
        tap("Options")
        await("Options volume controls after the page transition") { nodes().any { it.contentDescription?.toString() == "Ambience volume" && it.isVisibleToUser } }
        val volume = nodes().first { it.contentDescription?.toString() == "Ambience volume" }
        assertTrue(volume.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS.id,
            android.os.Bundle().apply { putFloat(AccessibilityNodeInfo.ACTION_ARGUMENT_PROGRESS_VALUE, 7f) }))
        await("Volume stop persists") { model.ambience == .7f && Store(context).ambience == .7f }
        assertEquals(0f, volume.rangeInfo.min); assertEquals(10f, volume.rangeInfo.max)
        tap("Colourblind mode")
        assertTrue(model.colorblind); assertTrue(Store(context).colorblind)
        assertTrue(Art.colorblind)
        tap("Rulebook")
        fun tile(r: Int, c: Int) = nodes().firstOrNull {
            it.contentDescription?.toString()?.contains(", row $r, column $c,") == true
        }
        fun color(r: Int, c: Int) = tile(r, c)?.contentDescription?.toString()?.substringBefore(',')
        fun select(r: Int, c: Int) {
            val node = tile(r, c) ?: error("Missing practice tile $r,$c")
            assertTrue(node.isVisibleToUser)
            assertTrue(node.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            instrumentation.waitForIdleSync()
        }
        // Colourblind mode is on: the tiles go by the palette's standard names (Okabe-Ito), in the Rulebook and for TalkBack.
        await("practice board") { color(1, 1) == "Vermillion" && color(2, 1) == "Reddish purple" }
        select(2, 2); assertEquals("Off-white", color(2, 2))
        select(1, 1); select(2, 1)
        await("first practice swap") { color(1, 1) == "Reddish purple" && color(2, 1) == "Vermillion" }
        select(2, 1); select(3, 1)
        await("second practice swap") { color(2, 1) == "Blue" && color(3, 1) == "Vermillion" }
        assertEquals(campaign, model.board); assertEquals(done, model.done); assertEquals(badges, model.earned)
        val practice = model.rulebookBoard
        tap("About"); tap("Rulebook")
        assertEquals(practice, model.rulebookBoard)
        await("practice resumes after switching tabs") { color(3, 1) == "Vermillion" }
        await("White rule remains accessible at enlarged text sizes") {
            if (nodes().any { it.contentDescription?.toString()?.startsWith("Off-white never") == true && it.isVisibleToUser }) true
            else { nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); false }
        }
        val whiteBounds = Rect().also { bounds -> nodes().first { it.contentDescription?.toString()?.startsWith("Off-white never") == true }.getBoundsInScreen(bounds) }
        val tileBounds = Rect().also { tile(1, 1)!!.getBoundsInScreen(it) }
        assertTrue("Rules must not overlap the practice board", whiteBounds.bottom <= tileBounds.top)
        val folder = File(context.getExternalFilesDir(null), "options-v022").apply { mkdirs() }
        File(folder, "rulebook.png").outputStream().use { instrumentation.uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it) }
        close(); launch()
        assertTrue(model.colorblind); assertTrue(Art.colorblind)
    }

    @Test fun gameplayGesturesRestartAccessAndWinNavigation() {
        Store(context).apply { done = setOf(1); lastLevel = 1 }
        launch(); tap("Journey")
        main { model.move(Pos(0, 1), Pos(1, 1)) }
        assertEquals(1, model.moves)
        fun tileBounds(row: Int, column: Int) = Rect().also { rect ->
            await("game tile $row,$column") { nodes().any { it.contentDescription?.toString()?.contains(", row $row, column $column,") == true } }
            nodes().first { it.contentDescription?.toString()?.contains(", row $row, column $column,") == true }.getBoundsInScreen(rect)
        }
        fun touch(x: Float, y: Float, hold: Long, endY: Float = y) {
            SystemClock.sleep(450) // Let the 400ms screen-transition touch lock settle.
        val down = SystemClock.uptimeMillis()
            fun event(action: Int, atY: Float) {
                val e = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, atY, 0)
                e.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                assertTrue(instrumentation.uiAutomation.injectInputEvent(e, true)); e.recycle()
            }
            event(android.view.MotionEvent.ACTION_DOWN, y)
            SystemClock.sleep(hold)
            if (endY != y) event(android.view.MotionEvent.ACTION_MOVE, endY)
            event(android.view.MotionEvent.ACTION_UP, endY)
            instrumentation.waitForIdleSync()
        }
        val tile = tileBounds(1, 1)
        val target = Rect().also { bounds -> nodes().first { it.contentDescription?.toString()?.startsWith("Target arrangement:") == true }.getBoundsInScreen(bounds) }
        swipeAcross(tile.exactCenterY(), true)
        assertEquals("Swiping inside the outline must not change levels", 1, model.level)
        assertEquals(1, model.moves)
        touch(20f * activity!!.resources.displayMetrics.density, target.exactCenterY(), 900)
        assertEquals("Holding outside the outline must not restart", 1, model.moves)
        swipeAcross(target.exactCenterY(), false)
        assertEquals("Swiping over the target must not change levels", 1, model.level)
        val swipeY = tile.top - 8f * activity!!.resources.displayMetrics.density
        swipeAcross(swipeY, true)
        assertEquals("A locked Journey level refuses a swipe", 1, model.level)
        swipeAcross(swipeY, false)
        await("Outline gutter swipe opens the previous Journey level") { model.level == 0 }
        swipeAcross(swipeY, true)
        await("Outline gutter swipe restores the next Journey attempt") { model.level == 1 && model.moves == 1 }
        touch(tile.exactCenterX(), tile.exactCenterY(), 600)
        assertEquals("Holding a tile must not restart", 1, model.moves)
        val backgroundX = 20f * activity!!.resources.displayMetrics.density
        touch(backgroundX, tile.exactCenterY(), 150)
        assertEquals("A short background tap must not restart", 1, model.moves)
        touch(backgroundX, tile.exactCenterY(), 900)
        await("background hold restarts") { model.moves == 0 }
        assertNull(model.store.attempt(model.level))
        val red = tileBounds(1, 2)
        touch(red.exactCenterX(), red.exactCenterY(), 60, red.exactCenterY() + red.height() * .4f)
        assertEquals("A short flick must not swap before the tile reaches its neighbour", 0, model.moves)
        touch(red.exactCenterX(), red.exactCenterY(), 60, tileBounds(2, 2).exactCenterY())
        await("dropping over the legal neighbour swaps") { model.moves == 1 }
        val restart = nodes().first { n -> n.actionList.any { it.label?.toString() == "Restart level" } }
        val action = restart.actionList.first { it.label?.toString() == "Restart level" }
        assertTrue(restart.performAction(action.id))
        await("accessible restart") { model.moves == 0 }
        main { model.start(0); model.move(Pos(0, 0), Pos(0, 1)) }
        await("win popup") { has("Next level") && has("Restart level") }
        assertTrue("Solved board remains visible with the result bars", nodes().any { it.contentDescription?.toString()?.contains(", row 1, column 1,") == true })
        val replay = Rect().also { control("Restart level").getBoundsInScreen(it) }
        assertTrue(replay.height() >= (48 * activity!!.resources.displayMetrics.density).toInt())
        tap("Restart level"); assertFalse(model.solved)
        main { progress((1..model.levels.size).toSet()); model.start(model.levels.lastIndex); model.stack += Route.Win }
        tileBounds(5, 4)
        await("result bars on the largest board") { has("Next level") && has("Restart level") }
        val bars = Rect().also { control("Restart level").getBoundsInScreen(it) }
        for (node in nodes().filter { it.contentDescription?.toString()?.contains(", row ") == true }) {
            val bounds = Rect().also { node.getBoundsInScreen(it) }
            assertTrue("Result bars must not cover a board tile", bounds.bottom <= bars.top)
        }
        main { model.next() }
        assertEquals("The last campaign level must return to the level list", Route.Levels, model.top)
    }

    @Test fun creatorResetAndBackKeepTheDraftAndPublishingProof() {
        launch()
        main {
            model.creator.created(); model.creator.resize(4, 4)
            model.creator.place('R', Pos(0, 0)); model.creator.place('B', Pos(1, 0))
            model.push(Route.Create)
        }
        await("creator grid") { has("Red, row 1, column 1") && has("Start position") }
        SystemClock.sleep(250)
        val tile = Rect().also { nodes().first { n -> matches(n, "Red, row 1, column 1") }.getBoundsInScreen(it) }
        fun hold(x: Float, y: Float, duration: Long) {
            SystemClock.sleep(450) // Let the 400ms screen-transition touch lock settle.
        val down = SystemClock.uptimeMillis()
            for (action in listOf(android.view.MotionEvent.ACTION_DOWN, android.view.MotionEvent.ACTION_UP)) {
                val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0)
                event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle()
                if (action == android.view.MotionEvent.ACTION_DOWN) SystemClock.sleep(duration)
            }
            instrumentation.waitForIdleSync()
        }
        hold(tile.exactCenterX(), tile.exactCenterY(), 900)
        assertTrue("Holding a tile must not clear the grid", model.creator.canReset)
        val backgroundX = 20f * activity!!.resources.displayMetrics.density
        hold(backgroundX, tile.exactCenterY(), 100)
        assertTrue("A short background tap must not clear the grid", model.creator.canReset)
        hold(backgroundX, tile.exactCenterY(), 900)
        await("background hold clears the grid") { !model.creator.canReset }
        assertEquals(4, model.creator.rows); assertEquals(4, model.creator.cols)
        main { model.creator.place('R', Pos(0, 0)); model.creator.place('B', Pos(1, 0)) }
        tap("Start position"); assertEquals(Phase.SHAPE, model.creator.phase)
        main { model.creator.move(Pos(0, 0), Pos(1, 0)) }
        fun accessibleReset(label: String) {
            await(label) { nodes().any { n -> n.actionList.any { it.label?.toString() == label } } }
            val node = nodes().first { n -> n.actionList.any { it.label?.toString() == label } }
            assertTrue(node.performAction(node.actionList.first { it.label?.toString() == label }.id))
            await("reset finishes") { model.creator.board == model.creator.start }
            SystemClock.sleep(250)
        }
        accessibleReset("Reset to start")
        assertTrue(model.creator.proof.isEmpty())
        main { model.creator.move(Pos(0, 0), Pos(1, 0)) }
        tap("Target position"); assertEquals(Phase.CHECK, model.creator.phase)
        val proof = model.creator.proof
        assertTrue(proof.isNotEmpty()); assertTrue(has("Publish level"))
        main { model.creator.move(Pos(0, 0), Pos(1, 0)) }
        accessibleReset("Restart puzzle")
        assertEquals(proof, model.creator.proof)
        val restored = CreatorState(model.store.creatorDraft)
        assertEquals(Phase.CHECK, restored.phase); assertEquals(proof, restored.proof)
        assertEquals(restored.start, restored.board)
        main { model.creator.picked = Pos(0, 0) }
        back(); assertEquals(Phase.CHECK, model.creator.phase); assertEquals(Route.Create, model.top)
        swipeAcross(tile.exactCenterY(), false)
        assertEquals(Phase.SHAPE, model.creator.phase); assertEquals(proof, model.creator.proof)
        swipeAcross(tile.exactCenterY(), false)
        assertEquals(Phase.BUILD, model.creator.phase); assertEquals(Route.Create, model.top)
        tap("Back"); assertEquals(Route.Home, model.top)
    }

    @Test fun journeyPagesSwipeAndReopenAtTheCurrentLevel() {
        Store(context).apply { done = (1..200).toSet(); lastLevel = 0 }
        launch(); tap("Journey"); tap("Journey 1")
        await("First Journey page") { has("Level 32, solved") }
        val screen = Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
        swipeAcross(screen.exactCenterY(), true)
        await("Second Journey page") { nodes().any { matches(it, "Level 33, solved") && it.isVisibleToUser } }
        tap("Level 33, solved")
        await("Chosen level opens") { model.top == Route.Game && model.level == 32 }
        tap("Journey 33")
        await("Levels reopen at the current page") { nodes().any { matches(it, "Level 33, solved") && it.isVisibleToUser } }
        swipeAcross(screen.exactCenterY(), false)
        await("Previous Journey page") { nodes().any { matches(it, "Level 1, solved") && it.isVisibleToUser } }
        tap("Level 1, solved")
        await("First level opens again") { model.top == Route.Game && model.level == 0 }
    }

    @Test fun sheetsDragBackAndRepeatedRoutesRespectTheTopScreen() {
        Store(context).motion = "system"
        launch(); tap("Options")
        await("Options sheet settles") { has("Ambience volume") && !has("Journey") }
        fun drag(fraction: Float) {
            val bounds = Rect().also { control("Back").getBoundsInScreen(it) }
            val screen = Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
            SystemClock.sleep(450) // Let the 400ms screen-transition touch lock settle.
        val down = SystemClock.uptimeMillis()
            for (step in 0..20) {
                val action = when (step) { 0 -> android.view.MotionEvent.ACTION_DOWN; 20 -> android.view.MotionEvent.ACTION_UP; else -> android.view.MotionEvent.ACTION_MOVE }
                val event = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, bounds.exactCenterX(),
                    bounds.exactCenterY() + screen.height() * fraction * step / 20f, 0)
                event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)); event.recycle(); SystemClock.sleep(35)
            }
        }
        drag(.15f)
        await("A short sheet pull springs back") { model.top == Route.Options && has("Ambience volume") }
        SystemClock.sleep(500)
        drag(.65f)
        await("A long sheet pull returns Home") { model.top == Route.Home && has("Journey") && !has("Ambience volume") }
        tap("Options"); tap("About"); tap("Report a bug")
        await("Feedback sheet opens") { has("Send") }
        main { model.push(Route.Options) }
        await("A repeated Options route is the visible top screen") { has("Ambience volume") && !has("Send") }
        tap("Back")
        await("Back reveals the feedback screen below") { model.top == Route.Feedback("bug") && has("Send") }
    }

    @Test fun immediatePressSurvivesTheButtonsConsumedDownAndClicksOnce() {
        launch()
        val source = androidx.compose.foundation.interaction.MutableInteractionSource()
        val events = mutableListOf<androidx.compose.foundation.interaction.Interaction>()
        val clicks = androidx.compose.runtime.mutableIntStateOf(0)
        main { activity!!.setContent {
            androidx.compose.runtime.LaunchedEffect(source) { source.interactions.collect { events.add(it) } }
            Box(Modifier.fillMaxSize().pressOnTouch(source).clickable(source, null) { clicks.intValue++ }) {
                Label("Clicks ${clicks.intValue}", 20.sp)
            }
        } }
        await("Press sample") { has("Clicks 0") }
        val screen = Rect().also { instrumentation.uiAutomation.rootInActiveWindow!!.getBoundsInScreen(it) }
        SystemClock.sleep(450) // Let the 400ms screen-transition touch lock settle.
        val down = SystemClock.uptimeMillis()
        fun event(action: Int) {
            val e = android.view.MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, screen.exactCenterX(), screen.exactCenterY(), 0)
            e.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            assertTrue(instrumentation.uiAutomation.injectInputEvent(e, true)); e.recycle()
        }
        event(android.view.MotionEvent.ACTION_DOWN)
        try {
            SystemClock.sleep(150)
            main {
                val press = events.filterIsInstance<androidx.compose.foundation.interaction.PressInteraction.Press>().first()
                assertFalse("The button consuming Down must not cancel its immediate press", events.any {
                    it is androidx.compose.foundation.interaction.PressInteraction.Cancel && it.press === press
                })
            }
        } finally { event(android.view.MotionEvent.ACTION_UP) }
        await("One click after release") { has("Clicks 1") }
        main { assertEquals(1, clicks.intValue) }
    }

    @Test fun homeLayoutAndLauncherBranding() {
        launch()
        val args = InstrumentationRegistry.getArguments()
        val fontScale = args.getString("menuFontScale", "1.0").toFloat()
        val rtl = args.getString("menuRtl", "false").toBoolean()
        val layoutReady = "Menu layout ${args.getString("menuCapture", "default")} ready"
        main {
            model.changeTheme(args.getString("menuTheme", "dark"))
            val density = activity!!.resources.displayMetrics.density
            activity!!.setContent {
                CompositionLocalProvider(LocalDensity provides Density(density, fontScale),
                    LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                    LocalPalette provides if (model.dark) DarkPalette else LightPalette, LocalReduceMotion provides true) {
                    Box(Modifier.fillMaxSize().semantics { contentDescription = layoutReady }) { App(model) }
                }
            }
        }
        await("configured header") { has(layoutReady) && has("MIDORI") && has("Options") && has("Profile") }
        fun bounds(label: String, clickable: Boolean = true): Rect = Rect().also { rect ->
            (if (clickable) control(label) else nodes().first { matches(it, label) }).getBoundsInScreen(rect)
        }
        val options = bounds("Options"); val profile = bounds("Profile"); val title = bounds("MIDORI", false)
        assertTrue(options.centerX() < title.centerX()); assertTrue(title.centerX() < profile.centerX())
        assertFalse(Rect.intersects(options, title)); assertFalse(Rect.intersects(profile, title))
        val minimum = (48 * activity!!.resources.displayMetrics.density).toInt()
        for (rect in listOf(options, profile)) { assertTrue(rect.width() >= minimum); assertTrue(rect.height() >= minimum) }
        for (label in listOf("Journey", "Worlds")) { assertTrue(control(label).isVisibleToUser); assertTrue(bounds(label).top >= options.bottom) }
        // The header's focus indication follows the same focus state used by keyboard navigation.
        // Tab also leaves Android's touch mode; ACTION_FOCUS alone cannot do that.
        fun focusedLabel() = nodes().firstOrNull { it.isClickable && it.isFocused }?.let { it.contentDescription?.toString() ?: it.text?.toString() }
        repeat(4) {
            if (!control("Options").isFocused) {
                val before = focusedLabel()
                instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_TAB)
                // Accessibility updates arrive on a later frame; do not queue another Tab against a stale tree.
                await("Tab focus change") { focusedLabel()?.let { it != before } == true }
            }
        }
        await("keyboard focus") { control("Options").isFocused }
        instrumentation.waitForIdleSync()
        SystemClock.sleep(200) // Let the focus border reach the rendered frame before capture.
        assertTrue("Keyboard focus must survive the focus-border redraw", control("Options").isFocused)
        val screenshot = instrumentation.uiAutomation.takeScreenshot()
        val folder = File(context.getExternalFilesDir(null), "problem15").apply { mkdirs() }
        File(folder, "home-${args.getString("menuCapture", "default")}.png").outputStream().use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        assertEquals("Midori Preview", context.applicationInfo.loadLabel(context.packageManager).toString())
        val icon = context.getDrawable(R.mipmap.ic_launcher) as AdaptiveIconDrawable
        assertNotNull(icon.foreground); assertNotNull(icon.background)
        val bitmap = Bitmap.createBitmap(216, 216, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        icon.setBounds(0, 0, 216, 216); icon.draw(canvas)
        File(folder, "launcher.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            val monochrome = icon.monochrome!!
            monochrome.setTint(0xFF45405A.toInt())
            val themed = AdaptiveIconDrawable(android.graphics.drawable.ColorDrawable(0xFFE8DEF8.toInt()), monochrome)
            bitmap.eraseColor(android.graphics.Color.TRANSPARENT)
            themed.setBounds(0, 0, 216, 216); themed.draw(canvas)
            File(folder, "launcher-themed.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
