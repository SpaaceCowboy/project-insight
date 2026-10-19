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

@RunWith(AndroidJUnit4::class)
class AppearanceHotfixTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(): List<AccessibilityNodeInfo> {
        fun collect(n: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = listOf(n) + (0 until n.childCount).flatMap { n.getChild(it)?.let(::collect) ?: emptyList() }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::collect) ?: emptyList()
    }
    private fun has(text: String) = nodes().any { it.text?.toString()?.equals(text, ignoreCase = true) == true }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 15000
        while (SystemClock.uptimeMillis() < deadline) { if (condition()) return; SystemClock.sleep(80) }
        throw AssertionError(message)
    }
    private fun capture(name: String) {
        val file = File(instrumentation.targetContext.getExternalFilesDir("problem14"), "$name.png")
        file.outputStream().use { instrumentation.uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun tileInkAndGlowFadeRenderCorrectly() {
        fun render(type: Char, finish: String, glow: Color? = null): Bitmap {
            val bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
            CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, Canvas(bitmap.asImageBitmap()), Size(128f, 128f)) {
                tile(type, Offset(24f, 24f), 80f, finish, glow)
            }
            return bitmap
        }
        for (type in "RBGYPW") {
            val pixels = IntArray(128 * 128)
            render(type, "obsidian").getPixels(pixels, 0, 128, 0, 0, 128, 128)
            assertTrue("Symbol for $type must be coloured", pixels.count { AndroidColor.alpha(it) == 255 && maxOf(AndroidColor.red(it), AndroidColor.green(it), AndroidColor.blue(it)) > 200 } > 15)
        }
        val white = render('W', "obsidian")
        assertEquals("White designator must be white", AndroidColor.WHITE, white.getPixel(64, 54))
        val bright = render('R', "original", Color.Red)
        val fading = render('R', "original", Color.Red.copy(alpha = .1f))
        assertTrue("Glow halo must respect fading alpha", AndroidColor.alpha(bright.getPixel(18, 64)) > AndroidColor.alpha(fading.getPixel(18, 64)))
        assertEquals(0, AndroidColor.alpha(render('R', "original").getPixel(18, 64)))
    }

    @Test fun previewLayoutsCosmeticMigrationAndSolveLifecycle() {
        // The preview login and community data in this test stay on the device.
        assumeTrue(BuildConfig.ONLINE_DEMO)
        val context = instrumentation.targetContext
        val repository = OnlineRepository.get(context)
        runBlocking { repository.client.login("preview@insight.local", "Hotfix Preview") }
        val store = Store(context)
        store.selectAccount(repository.client.user!!.id)
        store.importedInto = "hotfix-no-import"
        val badges = mapOf("first-clean" to 123L, "world-1" to 456L)
        store.earned = badges; store.done = setOf(1); store.background = "aurora"; store.finish = "metal"; store.motion = "system"; store.dev = false
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        lateinit var model: GameModel
        fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
        try {
            main { model = ViewModelProvider(activity)[GameModel::class.java] }
            assertEquals("forest", store.background); assertEquals("original", model.finish)
            assertEquals(badges, model.earned); assertEquals(setOf(1), model.done)
            main { model.push(Route.Options) }
            await("Options must open") { has("Appearance") }
            val appearance = nodes().first { it.text?.toString() == "Appearance" }
            var tab = appearance
            while (!tab.isClickable) tab = tab.parent
            tab.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            await("Both finishes must be present") { has("Original") && has("Obsidian") }
            assertFalse(has("Background")); assertTrue(has("Earn Pristine")); capture("appearance-locked")
            main { model.toggleDev(); model.equip(COSMETICS.last()) }
            assertEquals("obsidian", model.finish); assertEquals(badges, model.earned)
            main { model.toggleDev() }
            assertEquals("original", model.finish)
            main { model.toggleDev(); model.equip(COSMETICS.last()); model.mainMenu() }
            await("Home must open") { has("Journey") }; capture("home-obsidian")
            main { model.push(Route.Levels(1)) }
            await("Level numbers must be present") { has("01") }; capture("levels")
            main {
                if (model.creator.phase != Phase.BUILD) model.creator.pressStart()
                model.creator.resize(3, 3)
                "RBGYPW".forEachIndexed { i, type -> model.creator.place(type, Pos(i / 3, i % 3)) }
                model.push(Route.Create)
            }
            SystemClock.sleep(600); capture("creator-six-symbols")
            main { model.creator.pressStart() }
            await("Start preview must be announced") { nodes().any { it.contentDescription?.toString() == "Start arrangement" } }
            assertEquals("Only the Start control should have a caption", 1, nodes().count { it.text?.toString()?.equals("Start", ignoreCase = true) == true })
            capture("creator-start-preview")
            main { model.creator.move(Pos(0, 0), Pos(1, 0)); model.creator.pressTarget() }
            await("Target preview must be announced") { nodes().any { it.contentDescription?.toString() == "Target arrangement" } }
            assertEquals("Only the Target control should have a caption", 1, nodes().count { it.text?.toString()?.equals("Target", ignoreCase = true) == true })
            capture("creator-target-preview")
            main { model.start(0) }
            await("Campaign must open") { has("The First Turn") }; capture("campaign-target")
            main { model.move(Pos(0, 0), Pos(0, 1)) }
            SystemClock.sleep(400); capture("solve-wave")
            await("Result heading must appear") { has("Grid solved") }
            SystemClock.sleep(1600)
            assertFalse(has("Beautifully solved.")); assertTrue(has("Replay")); capture("solved-normal")
            main { model.restart() }; await("Replay must remove result") { !has("Grid solved") }
            assertFalse(model.solved)
            main { model.move(Pos(0, 0), Pos(0, 1)) }
            await("Replay solve must show result") { has("Grid solved") }
            main { model.next() }; await("Next puzzle must open") { has("Opposite Corners") }
            val grid = JSONObject().put("id", "hotfix-grid").put("worldId", "hotfix-world").put("worldName", "Hotfix World").put("name", "Online hotfix")
                .put("start", JSONArray(model.levels[0].start)).put("target", JSONArray(model.levels[0].target))
            main { model.startCommunity(grid, "hotfix-session"); model.move(Pos(0, 0), Pos(0, 1)) }
            await("Online result must appear") { has("Grid solved") }
            SystemClock.sleep(1600); capture("online-solved-normal")
            main { model.restart() }; assertFalse(model.solved)
            main { store.motion = "on"; model.changeTheme("light"); model.move(Pos(0, 0), Pos(0, 1)) }
            await("Reduced motion must retain the result") { has("Grid solved") }
            SystemClock.sleep(1300); capture("online-reduced-motion")
            main { model.mainMenu() }
            await("Light home must open") { has("Journey") }; capture("home-light")
            assertEquals(badges, model.earned)
        } finally {
            main { activity.finish() }
        }
    }
}
