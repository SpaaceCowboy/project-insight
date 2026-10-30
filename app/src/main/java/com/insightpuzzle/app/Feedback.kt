package com.insightpuzzle.app

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Interface sounds from the uisfx package (CC0, https://uisfx.com): the "zen" pack, plus the "minimal" pack's checkout for a solved puzzle. Ogg Opus on Android 10+,
 * MP3 before (res/raw-v29 vs res/raw).
 *
 * [level] is the cue's loudness as a share of the other cues at the same Effects setting (they are 1): a landing tile is 70 %, a solved puzzle 90 %.
 * [stored] is how much louder than the original clip its file is: 1.5 for the original zen cues (see Audio), 2^(1/2) for the two added with tools/build-cues.mjs.
 * Playing needs only the quotient of the two, always at most 1 (SoundPool cannot play above 1.0).
 */
enum class Cue(val res: Int, val level: Float = 1f, val stored: Float = ZEN_STORED) {
    DRAG_START(R.raw.zen_drag_start), REORDER(R.raw.zen_reorder), INVALID_DROP(R.raw.zen_invalid_drop),
    START(R.raw.zen_start), STOP(R.raw.zen_stop), PROCESSING(R.raw.zen_processing),
    TOGGLE_ON(R.raw.zen_toggle_on), TOGGLE_OFF(R.raw.zen_toggle_off), SWIPE(R.raw.zen_swipe), FOCUS(R.raw.zen_focus),
    LONG_PRESS(R.raw.zen_long_press), CHECK(R.raw.zen_check), DELETE(R.raw.zen_delete), SELECT(R.raw.zen_select),
    BACK(R.raw.zen_back), FORWARD(R.raw.zen_forward), PRESS(R.raw.zen_press), SEEK(R.raw.zen_seek),
    UNLOCK(R.raw.zen_unlock),
    /** A tile landing in its place: zen "drop" at 70 % of the other cues. */
    DROP(R.raw.zen_drop, .7f, ADDED_STORED),
    /** A puzzle solved: minimal "checkout" at 90 % of the other cues. */
    SUCCESS(R.raw.minimal_checkout, .9f, ADDED_STORED);

    /** The SoundPool volume factor on top of the Effects setting. */
    val gain get() = level * ZEN_STORED / stored
    /** The file name (without extension) in res/raw and res/raw-v29. */
    val file get() = if (this == SUCCESS) "minimal_checkout" else "zen_" + name.lowercase()
}

/** Every original zen cue is stored 1.5x louder than the uisfx clip. */
const val ZEN_STORED = 1.5f
/** The cues added later are stored +3 dB: two MP3 gain steps, an Opus output gain of 3 dB. */
val ADDED_STORED = Math.pow(2.0, .5).toFloat()

/** One 10 ms one-shot for every touch: a light tingle on simple and high-definition actuators alike. */
class Haptics(private val context: Context) {
    private fun vibrator(): Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)

    // Looked up on every touch rather than kept: plugging in headphones or earphones can change which output the system routes to,
    // and a vibrator reference (or a "has vibrator" answer) taken earlier must not go stale with it.
    fun tick() {
        val v = vibrator()?.takeIf { it.hasVibrator() } ?: return
        // Always the same one-shot, never a predefined effect whose length the system picks. DEFAULT_AMPLITUDE is full strength on some devices,
        // so the strength is explicit wherever the actuator can honour it.
        val effect = VibrationEffect.createOneShot(TICK_MS, if (v.hasAmplitudeControl()) TICK_AMPLITUDE else VibrationEffect.DEFAULT_AMPLITUDE)
        // Touch usage lets the system's touch-vibration setting scale it.
        if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, android.os.VibrationAttributes.createForUsage(android.os.VibrationAttributes.USAGE_TOUCH))
        else @Suppress("DEPRECATION") v.vibrate(effect, android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).build())
    }

    companion object { const val TICK_MS = 10L; const val TICK_AMPLITUDE = 80 }
}

/** Touch feedback for UI code: the 10 ms haptic (if Haptics is on) plus [Cue]'s sound (if Sound is on). A null cue is haptic only. */
val LocalFeedback = staticCompositionLocalOf<(Cue?) -> Unit> { {} }
