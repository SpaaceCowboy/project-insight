package com.insightpuzzle.app

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.staticCompositionLocalOf

/** Interface sounds from the uisfx "zen" pack (CC0, https://uisfx.com). Ogg Opus on Android 10+, MP3 before (res/raw-v29 vs res/raw). */
enum class Cue(val res: Int) {
    DRAG_START(R.raw.zen_drag_start), REORDER(R.raw.zen_reorder), INVALID_DROP(R.raw.zen_invalid_drop),
    START(R.raw.zen_start), STOP(R.raw.zen_stop), PROCESSING(R.raw.zen_processing),
    TOGGLE_ON(R.raw.zen_toggle_on), TOGGLE_OFF(R.raw.zen_toggle_off), SWIPE(R.raw.zen_swipe), FOCUS(R.raw.zen_focus),
    LONG_PRESS(R.raw.zen_long_press), CHECK(R.raw.zen_check), DELETE(R.raw.zen_delete), SELECT(R.raw.zen_select),
    BACK(R.raw.zen_back), FORWARD(R.raw.zen_forward), PRESS(R.raw.zen_press), SEEK(R.raw.zen_seek),
    UNLOCK(R.raw.zen_unlock), SUCCESS(R.raw.zen_success),
}

/** One 6 ms one-shot for every touch: a light tingle on simple and high-definition actuators alike. */
class Haptics(context: Context) {
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)
    private val tick = VibrationEffect.createOneShot(6, VibrationEffect.DEFAULT_AMPLITUDE)

    fun tick() { vibrator?.takeIf { it.hasVibrator() }?.vibrate(tick) }
}

/** Touch feedback for UI code: the 6 ms haptic (if Haptics is on) plus [Cue]'s sound (if Sound is on). A null cue is haptic only. */
val LocalFeedback = staticCompositionLocalOf<(Cue?) -> Unit> { {} }
