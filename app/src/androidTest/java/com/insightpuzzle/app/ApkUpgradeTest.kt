package com.insightpuzzle.app

import android.content.Intent
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Run only after installing v0.2.0, seeding the upgrade fixture, then updating in place. */
@RunWith(AndroidJUnit4::class)
class ApkUpgradeTest {
    @Test fun publishedVersionUpgradeRetainsCampaignAndCreatorDraft() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("verifyUpgrade") == "true")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        assertFalse(BuildConfig.ONLINE_DEMO)
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) as MainActivity
        try {
            instrumentation.runOnMainSync {
                val model = ViewModelProvider(activity)[GameModel::class.java]
                assertEquals(setOf(1), model.done)
                model.startJourney()
                assertEquals(1, model.level); assertEquals(1, model.moves)
                val original = model.levels[1].start
                assertEquals(Rules.swap(original, Pos(0, 1), Pos(1, 1)), model.board)
                assertEquals(Phase.CHECK, model.creator.phase)
                assertEquals("problem15-upgrade-draft", model.creator.creationId)
                assertEquals(listOf(0 to 3), model.creator.proof)
                model.selectAccount("upgrade-account-a")
                assertEquals(setOf(1, 2, 3), model.done)
                model.startJourney(); assertEquals(3, model.level)
                assertEquals(mapOf("first" to 1234L), model.earned)
            }
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
}
