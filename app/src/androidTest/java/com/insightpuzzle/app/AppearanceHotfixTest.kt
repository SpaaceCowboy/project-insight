package com.insightpuzzle.app

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class AppearanceHotfixTest {
    @Test
    fun sharedLinksOpenOverHttpAndHttpsOnBothHosts() {
        val code = "0123456789ABCDEF"
        // Chat apps turn the shared "www.midoripuzzle.com/p/…" into an http:// link, so that must open the puzzle too.
        for (link in listOf("https://www.midoripuzzle.com/p/$code", "http://www.midoripuzzle.com/p/$code", "https://midoripuzzle.com/p/${code.lowercase()}", "http://midoripuzzle.com/p/$code"))
            assertEquals(link, code, ShareLinks.code(android.net.Uri.parse(link)))
        for (link in listOf("ftp://www.midoripuzzle.com/p/$code", "https://evil.example/p/$code", "https://www.midoripuzzle.com/q/$code", "https://www.midoripuzzle.com/p/XYZ", "https://www.midoripuzzle.com/p/$code/more"))
            assertNull(link, ShareLinks.code(android.net.Uri.parse(link)))
        assertEquals("https://www.midoripuzzle.com/p/$code", ShareLinks.puzzle(code.lowercase()))
        assertEquals("www.midoripuzzle.com/p/$code", ShareLinks.short(code))
    }

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(): List<AccessibilityNodeInfo> {
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
    private fun has2(description: String) = nodes().any { it.contentDescription?.toString() == description }
    private fun has(text: String) = nodes().any { it.text?.toString()?.equals(text, ignoreCase = true) == true }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 15000
        while (SystemClock.uptimeMillis() < deadline) { if (condition()) return; SystemClock.sleep(80) }
        capture("failure")
        throw AssertionError("$message; visible=" + nodes().map { it.text?.toString() ?: it.contentDescription?.toString() }.filterNotNull().joinToString(" | "))
    }
    private fun capture(name: String) {
        val file = File(instrumentation.targetContext.getExternalFilesDir("problem14"), "$name.png")
        file.outputStream().use { instrumentation.uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun tileInkAndGlowFadeRenderCorrectly() {
        fun render(type: Char, glow: Color? = null): Bitmap {
            val bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
            CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, Canvas(bitmap.asImageBitmap()), Size(128f, 128f)) {
                tile(type, Offset(24f, 24f), 80f, glow)
            }
            return bitmap
        }
        for (type in "RBGYPW") {
            val pixels = IntArray(128 * 128)
            render(type).getPixels(pixels, 0, 128, 0, 0, 128, 128)
            assertTrue("Tile $type must be opaque", pixels.count { AndroidColor.alpha(it) == 255 } > 2000)
        }
        val originalPalette = Art.colorblind
        try {
            Art.colorblind = true
            for (type in Rules.TYPES) {
                assertTrue(Art.TILE.containsKey(type)); assertTrue(Art.LIGHT.containsKey(type))
                val pixels = IntArray(128 * 128)
                render(type).getPixels(pixels, 0, 128, 0, 0, 128, 128)
                assertTrue(pixels.count { AndroidColor.alpha(it) == 255 } > 2000)
            }
            val yellow = IntArray(128 * 128)
            render('Y').getPixels(yellow, 0, 128, 0, 0, 128, 128)
            assertTrue("Yellow needs dark symbol ink", yellow.count {
                AndroidColor.alpha(it) == 255 && maxOf(AndroidColor.red(it), AndroidColor.green(it), AndroidColor.blue(it)) < 80
            } > 15)
        } finally { Art.colorblind = originalPalette }
        val bright = render('R', Color.Red)
        val fading = render('R', Color.Red.copy(alpha = .1f))
        assertTrue("Selection ring must respect fading alpha", AndroidColor.alpha(bright.getPixel(21, 64)) > AndroidColor.alpha(fading.getPixel(21, 64)))
        assertEquals(0, AndroidColor.alpha(render('R').getPixel(21, 64)))
        assertEquals("Selection has no outer halo", 0, AndroidColor.alpha(bright.getPixel(18, 64)))
    }

    @Test fun anotherPlayersThirdPuzzleRowSitsClearOfThePageEdge() {
        assumeTrue(BuildConfig.ONLINE_DEMO)
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.login("preview@insight.local", "Hotfix Preview") }
        val store = Store(context)
        store.selectAccount(repository.client.user!!.id)
        store.importedInto = "hotfix-no-import"; store.onboarded = true; store.worldsGuided = true; store.onlineGuided = true; store.creatorGuided = true; store.language = "en"; store.motion = "system"
        // Give one preview creator enough puzzles for all three profile rows.
        val prefs = context.getSharedPreferences("online_demo_data", android.content.Context.MODE_PRIVATE)
        val original = prefs.getString("data", null)
        val root = JSONObject(original!!)
        val grids = root.getJSONArray("grids")
        val creator = root.getJSONArray("users").objects().first { it.getString("id") != repository.client.user!!.id }
        val template = grids.objects().first { it.getString("ownerId") == creator.getString("id") }
        val have = grids.objects().count { it.getString("ownerId") == creator.getString("id") }
        for (n in have + 1..13) {
            grids.put(JSONObject(template.toString()).put("id", UUID.randomUUID().toString()).put("levelNumber", n))
        }
        assertTrue(prefs.edit().putString("data", root.toString()).commit())
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
        try {
            main { model = ViewModelProvider(activity)[GameModel::class.java]; model.push(Route.Profile(creator.getString("id"))) }
            await("Third row of another player's puzzles") { has2("Puzzle 9") && has2("Puzzle 12") }
            SystemClock.sleep(400)
            capture("profile-other-three-rows")
            val bottom = nodes().filter { it.contentDescription?.toString()?.let { d -> d.startsWith("Puzzle ") } == true }
                .mapNotNull { n -> android.graphics.Rect().also { n.getBoundsInScreen(it) } }
                .maxOfOrNull { it.bottom } ?: 0
            val screen = android.graphics.Rect().also { activity.window.decorView.getGlobalVisibleRect(it) }
            assertTrue("The last puzzle row must be above the window's bottom edge", bottom <= screen.bottom)
        } finally {
            instrumentation.runOnMainSync { activity.finish() }
            prefs.edit().putString("data", original).commit()
        }
    }

    @Test fun previewLayoutsAndSolveLifecycle() {
        // The preview login and community data in this test stay on the device.
        assumeTrue(BuildConfig.ONLINE_DEMO)
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.login("preview@insight.local", "Hotfix Preview") }
        val store = Store(context)
        store.selectAccount(repository.client.user!!.id)
        store.importedInto = "hotfix-no-import"; store.onboarded = true; store.worldsGuided = true; store.onlineGuided = true; store.creatorGuided = true; store.language = "en"
        val badges = mapOf("first" to 789L, "first-clean" to 123L, "world-1" to 456L)
        store.earned = badges; store.done = setOf(1); store.background = "aurora"; store.motion = "system"; store.dev = false
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
        try {
            main { model = ViewModelProvider(activity)[GameModel::class.java] }
            assertEquals("forest", store.background)
            assertEquals(badges, model.earned); assertEquals(setOf(1), model.done)
            main { model.push(Route.Options) }
            await("Options must open") {
                if (!has("Rulebook")) false else if (has("Colourblind mode")) true
                else { nodes().lastOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); false }
            }
            assertFalse(has("Reset level progress")); assertFalse(has("Obsidian"))
            main { model.toggleColorblind() }
            assertTrue(Art.colorblind); main { model.toggleColorblind() }
            assertFalse(Art.colorblind)
            main { model.mainMenu() }
            await("Home must open") { has("Journey") }; capture("home")
            main { model.push(Route.Levels) }
            await("Level numbers must be present, without a leading zero") { has("1") && !has("01") }; capture("levels")
            main {
                if (model.creator.phase != Phase.BUILD) model.creator.pressStart()
                model.creator.resize(3, 3)
                "RBGYPW".forEachIndexed { i, type -> model.creator.place(type, Pos(i / 3, i % 3)) }
                model.push(Route.Create)
            }
            SystemClock.sleep(600); capture("creator-six-symbols")
            main { model.creator.pressStart() }
            await("Target stage shows its heading and the Next button") { nodes().any { it.text?.toString() == "Next" } && nodes().any { it.text?.toString() == "Find your target" } }
            assertFalse("No start preview while choosing the target", nodes().any { it.contentDescription?.toString() == "Start arrangement" })
            assertEquals("Only the Next button should have a caption", 1, nodes().count { it.text?.toString()?.equals("Next", ignoreCase = true) == true })
            capture("creator-start-preview")
            main { model.creator.move(Pos(0, 0), Pos(1, 0)); model.creator.pressTarget() }
            await("Target preview must be announced") { nodes().any { it.contentDescription?.toString() == "Target arrangement" } }
            assertEquals("Only the Create button should have a caption", 1, nodes().count { it.text?.toString()?.equals("Create", ignoreCase = true) == true })
            capture("creator-target-preview")
            main { model.start(0) }
            await("Campaign must open") { model.top == Route.Game }; capture("campaign-target")
            main { model.move(Pos(0, 0), Pos(1, 0)) }
            SystemClock.sleep(400); capture("solve-wave")
            await("Result must appear") { model.top == Route.Win && has2("Next level") }
            SystemClock.sleep(1600)
            assertTrue(has2("Restart level")); capture("solved-normal")
            main { model.restart() }; await("Restart must remove result") { model.top == Route.Game }
            assertFalse(model.solved)
            main { model.move(Pos(0, 0), Pos(1, 0)) }
            await("Replay solve must show result") { model.top == Route.Win }
            main { model.next() }; await("Next puzzle must open") { model.level == 1 && model.top == Route.Game }
            val grid = JSONObject().put("id", "hotfix-grid").put("ownerId", "hotfix-owner").put("username", "Hotfix Maker").put("levelNumber", 1)
                .put("start", JSONArray(model.levels[0].start)).put("target", JSONArray(model.levels[0].target))
            // This synthetic grid checks rendering; valid online sessions are exercised by PlayDiscoveryFlowTest.
            main { model.toggleDev(); model.startCommunity(grid, "hotfix-session"); model.move(Pos(0, 0), Pos(1, 0)) }
            await("Online result must appear") { model.top == Route.Win }
            SystemClock.sleep(1600); capture("online-solved-normal")
            main { model.restart() }; assertFalse(model.solved)
            main { store.motion = "on"; model.changeTheme("light"); model.move(Pos(0, 0), Pos(1, 0)) }
            await("Reduced motion must retain the result") { model.top == Route.Win }
            SystemClock.sleep(1300); capture("online-reduced-motion")
            main { model.mainMenu() }
            await("Light home must open: route=${model.top}, error=${model.online.error}") { has("Journey") }; capture("home-light")
            assertTrue("Existing badges must be preserved when new badges are earned", model.earned.entries.containsAll(badges.entries))
        } finally {
            main { activity.finish() }
        }
    }
}
