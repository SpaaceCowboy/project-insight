package com.insightpuzzle.app

import android.media.MediaPlayer
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedbackPlaybackTest {
    @Test fun everyPackagedCueDecodesAndStarts() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        for (cue in Cue.entries) {
            val player = requireNotNull(MediaPlayer.create(context, cue.res)) { "Unable to decode $cue" }
            try {
                assertTrue("Empty audio for $cue", player.duration > 0)
                player.setVolume(0f, 0f)
                player.start()
                SystemClock.sleep(minOf(40L, player.duration.toLong()))
            } finally { player.release() }
        }
    }
}
