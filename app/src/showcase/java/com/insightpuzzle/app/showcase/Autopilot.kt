package com.insightpuzzle.app.showcase

import android.app.Activity
import android.app.Application
import android.content.BroadcastReceiver
import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.InputDevice
import android.view.MotionEvent
import androidx.core.content.ContextCompat
import java.io.File

/**
 * Showcase recording build only: replays a recorded-by-hand gesture timeline as touches inside the app, so the clips can be filmed without anyone
 * touching the phone. `adb push g.txt /sdcard/Android/data/com.insightpuzzle.app.showcase/files/` then
 * `adb shell am broadcast -a com.insightpuzzle.app.showcase.PLAY -p com.insightpuzzle.app.showcase`.
 * Each line of g.txt is "ms action x y" with action d (down), m (move) or u (up); ms counts from the start of the timeline.
 */
class AutopilotProvider : ContentProvider() {
    private var current: Activity? = null
    private val main = Handler(Looper.getMainLooper())

    override fun onCreate(): Boolean {
        val app = context!!.applicationContext as Application
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) { current = activity }
            override fun onActivityPaused(activity: Activity) { if (current === activity) current = null }
            override fun onActivityCreated(activity: Activity, state: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
        ContextCompat.registerReceiver(app, object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val file = File(context.getExternalFilesDir(null), intent.getStringExtra("file") ?: "g.txt")
                play(file.readLines().filter { it.isNotBlank() }.map { it.trim().split(' ') })
            }
        }, IntentFilter("com.insightpuzzle.app.showcase.PLAY"), ContextCompat.RECEIVER_EXPORTED)
        return true
    }

    private fun play(lines: List<List<String>>) {
        val start = SystemClock.uptimeMillis() + 60
        var downAt = start
        Log.i("Autopilot", "play ${lines.size} events")
        for (line in lines) {
            val at = start + line[0].toLong()
            val action = when (line[1]) { "d" -> MotionEvent.ACTION_DOWN; "u" -> MotionEvent.ACTION_UP; else -> MotionEvent.ACTION_MOVE }
            val x = line[2].toFloat(); val y = line[3].toFloat()
            main.postAtTime({
                val activity = current ?: return@postAtTime
                if (action == MotionEvent.ACTION_DOWN) downAt = at
                val props = arrayOf(MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER })
                val coords = arrayOf(MotionEvent.PointerCoords().apply { this.x = x; this.y = y; pressure = 1f; size = 0.05f; touchMajor = 20f; touchMinor = 20f })
                val event = MotionEvent.obtain(downAt, SystemClock.uptimeMillis(), action, 1, props, coords, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
                activity.dispatchTouchEvent(event)
                event.recycle()
            }, at)
        }
        main.postAtTime({ Log.i("Autopilot", "done") }, start + (lines.lastOrNull()?.get(0)?.toLong() ?: 0) + 1)
    }

    override fun query(uri: Uri, projection: Array<String>?, selection: String?, args: Array<String>?, sort: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, args: Array<String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<String>?): Int = 0
}
