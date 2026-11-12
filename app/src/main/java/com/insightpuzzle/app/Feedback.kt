package com.insightpuzzle.app

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.flow.drop

/**
 * Interface sounds from the uisfx package (CC0, https://uisfx.com): the "zen" pack, with its "double click" for a solved puzzle. Ogg Opus on Android 10+,
 * MP3 before (res/raw-v29 vs res/raw).
 *
 * [level] is the cue's loudness as a share of the other cues at the same Effects setting (they are 1): a landing tile is 70 %, a solved puzzle 90 %.
 * [stored] is how much louder than the original clip its file is: 1.5 for the original zen cues (see Audio), 2^(1/2) for those added with tools/build-cues.mjs.
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
    /** A puzzle solved: zen "double click" at 90 % of the other cues. */
    SUCCESS(R.raw.zen_double_click, .9f, ADDED_STORED);

    /** The SoundPool volume factor on top of the Effects setting. */
    val gain get() = level * ZEN_STORED / stored
    /** The file name (without extension) in res/raw and res/raw-v29. */
    val file get() = if (this == SUCCESS) "zen_double_click" else "zen_" + name.lowercase()
}

/** Every original zen cue is stored 1.5x louder than the uisfx clip. */
const val ZEN_STORED = 1.5f
/** The cues added later are stored +3 dB: two MP3 gain steps, an Opus output gain of 3 dB. */
val ADDED_STORED = Math.pow(2.0, .5).toFloat()

/** One 11 ms one-shot for every touch: a light tingle on simple and high-definition actuators alike. */
class Haptics(private val context: Context) {
    private fun vibrator(): Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)

    // Looked up on every touch rather than kept: plugging in headphones or earphones can change which output the system routes to,
    // and a vibrator reference (or a "has vibrator" answer) taken earlier must not go stale with it.
    /** [ms] is the tick's length: [TICK_MS] for a touch, [FINE_TICK_MS] for each step of a continuous drag or list scroll; [amplitude] is 1..255 where the actuator honours it. */
    fun tick(ms: Long = TICK_MS, amplitude: Int = TICK_AMPLITUDE) {
        val v = vibrator()?.takeIf { it.hasVibrator() } ?: return
        play(v, effect(v, ms, amplitude))
    }

    /**
     * Three [TRIPLE_TICK_MS] pulses [TRIPLE_STEP_MS] apart (0, 200 and 400 ms), as one waveform so the gaps cannot drift: spread over the half
     * second of the restart cue, very short so the three never add up to one strong buzz.
     */
    fun triple() {
        val v = vibrator()?.takeIf { it.hasVibrator() } ?: return
        val gap = TRIPLE_STEP_MS - TRIPLE_TICK_MS
        val timings = longArrayOf(0, TRIPLE_TICK_MS, gap, TRIPLE_TICK_MS, gap, TRIPLE_TICK_MS)
        play(v, if (v.hasAmplitudeControl()) VibrationEffect.createWaveform(timings, intArrayOf(0, TRIPLE_AMPLITUDE, 0, TRIPLE_AMPLITUDE, 0, TRIPLE_AMPLITUDE), -1)
            // Without amplitude control any pulse is full strength, so only its 5 ms length keeps it light; never DEFAULT_AMPLITUDE, never a longer effect.
            else VibrationEffect.createWaveform(timings, -1))
    }

    /**
     * The effect for one tick. With amplitude control it is always the same explicit one-shot. Without it (simple motors, and the odd moment a
     * lookup lands on a vibrator that reports none) a one-shot can only be full strength, which felt like a jarring maximum buzz: there the
     * system's own light tick is used instead (Android 10+), or the shortest one-shot before that. DEFAULT_AMPLITUDE is never used.
     */
    private fun effect(v: Vibrator, ms: Long, amplitude: Int): VibrationEffect = when {
        v.hasAmplitudeControl() -> VibrationEffect.createOneShot(ms, amplitude.coerceIn(1, 255))
        Build.VERSION.SDK_INT >= 29 -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
        else -> VibrationEffect.createOneShot(FINE_TICK_MS, 255)
    }

    private fun play(v: Vibrator, effect: VibrationEffect) {
        // Touch usage lets the system's touch-vibration setting scale it.
        if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, android.os.VibrationAttributes.createForUsage(android.os.VibrationAttributes.USAGE_TOUCH))
        else @Suppress("DEPRECATION") v.vibrate(effect, android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).build())
    }

    /** Looks the vibrator up and asks what it can do, without vibrating, so the first real touch does not pay for it. */
    fun warm() { vibrator()?.let { it.hasVibrator(); it.hasAmplitudeControl() } }

    // TICK_AMPLITUDE 128 is about 50%: 80 (31%) felt right on the Xiaomi's simple motor but muted on the Samsung's. FINE ticks stay the quieter, shorter ones.
    companion object {
        const val TICK_MS = 11L; const val FINE_TICK_MS = 7L
        const val TICK_AMPLITUDE = 128; const val FINE_TICK_AMPLITUDE = 80
        /** The three restart/clear pulses: 5 ms each, as quiet as the corner-drag tick, 200 ms apart. */
        const val TRIPLE_TICK_MS = 5L
        const val TRIPLE_AMPLITUDE = FINE_TICK_AMPLITUDE
        const val TRIPLE_STEP_MS = 200L
    }
}

/**
 * Compose's own components (a long press, text selection) would otherwise play the system's haptic, at the system's strength and whatever the
 * Haptics setting says. Every haptic in the game goes through [Haptics] instead, so this one does nothing.
 */
object SilentHaptics : androidx.compose.ui.hapticfeedback.HapticFeedback {
    override fun performHapticFeedback(hapticFeedbackType: androidx.compose.ui.hapticfeedback.HapticFeedbackType) {}
}

/** Touch feedback for UI code: the 11 ms haptic (if Haptics is on) plus [Cue]'s sound (if Sound is on). A null cue is haptic only. */
val LocalFeedback = staticCompositionLocalOf<(Cue?) -> Unit> { {} }

/**
 * A quiet tick for every row that scrolls into view at either end of [list], so a fast fling feels like running a thumb along a ratchet.
 * Fires on a change of the first or last visible row while the player scrolls (never on a layout nobody touched) and at most every [SCROLL_TICK_GAP_MS].
 */
@androidx.compose.runtime.Composable
fun ScrollTick(list: androidx.compose.foundation.lazy.LazyListState, tick: () -> Unit) {
    val latest = androidx.compose.runtime.rememberUpdatedState(tick)
    androidx.compose.runtime.LaunchedEffect(list) {
        var last = 0L
        androidx.compose.runtime.snapshotFlow { list.layoutInfo.visibleItemsInfo.let { (it.firstOrNull()?.index ?: -1) to (it.lastOrNull()?.index ?: -1) } }
            .drop(1)
            .collect {
                // Only a scroll the player makes (a drag or its fling) ticks: a list laid out for the first time, refilled by a refresh or
                // resized by the search bar sliding open moves its rows too, but nobody touched it.
                if (!list.isScrollInProgress) return@collect
                val now = android.os.SystemClock.uptimeMillis()
                if (now - last >= SCROLL_TICK_GAP_MS) { last = now; latest.value() }
            }
    }
}
private const val SCROLL_TICK_GAP_MS = 40L
