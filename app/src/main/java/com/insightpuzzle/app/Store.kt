package com.insightpuzzle.app

import android.content.Context
import android.content.SharedPreferences

/** Saved progress and settings. SharedPreferences is enough: a few small values, written on each solve or setting change. */
class Store(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("insight", Context.MODE_PRIVATE)

    /** 1-based level numbers that have been solved. */
    var done: Set<Int>
        get() = prefs.getStringSet("done", emptySet())!!.mapNotNull { it.toIntOrNull() }.toSet()
        set(value) = prefs.edit().putStringSet("done", value.map { it.toString() }.toSet()).apply()

    /** Moves made in an unfinished level, as flat cell indices "a,b;c,d", so a level resumes where it was left. */
    fun attempt(level: Int): String? = prefs.getString("attempt_$level", null)
    fun saveAttempt(level: Int, path: String?) = prefs.edit().apply { if (path.isNullOrEmpty()) remove("attempt_$level") else putString("attempt_$level", path) }.apply()

    var lastLevel: Int
        get() = prefs.getInt("lastLevel", 0)
        set(value) = prefs.edit().putInt("lastLevel", value).apply()

    var sound by bool("sound", true)
    var voice by bool("voice", true)
    var dark by bool("dark", true)
    var haptics by bool("haptics", true)
    var moveCounter by bool("moveCounter", false)
    var animatedBackground by bool("animatedBackground", true)
    var pauseOverOthers by bool("pauseOverOthers", true)
    var silenceOnUnplug by bool("silenceOnUnplug", true)
    /** "system" follows the phone, "on" always removes decorative motion. */
    var motion by string("motion", "system")
    /** "light", "dark" or "system". Older installs only stored the dark/light boolean, so that is the fallback. */
    var theme: String
        get() = prefs.getString("theme", null) ?: if (prefs.getBoolean("dark", true)) "dark" else "light"
        set(value) = prefs.edit().putString("theme", value).apply()
    var dev by bool("dev", false)
    var effects by float("effects", .8f)
    var ambience by float("ambience", .8f)
    var background by string("background", "forest")
    var finish by string("finish", "original")

    /** Clears solved levels and unfinished attempts. Badges, cosmetics and settings are kept: rewards are permanent. */
    fun resetProgress() = prefs.edit().apply {
        remove("done"); remove("lastLevel")
        prefs.all.keys.filter { it.startsWith("attempt_") }.forEach { remove(it) }
    }.apply()

    /** Achievement id -> time earned (ms). */
    var earned: Map<String, Long>
        get() = prefs.getStringSet("earned", emptySet())!!.mapNotNull { entry -> entry.split('=').takeIf { it.size == 2 }?.let { it[0] to (it[1].toLongOrNull() ?: 0L) } }.toMap()
        set(value) = prefs.edit().putStringSet("earned", value.map { "${it.key}=${it.value}" }.toSet()).apply()

    private fun bool(key: String, default: Boolean) = object : kotlin.properties.ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = prefs.getBoolean(key, default)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Boolean) = prefs.edit().putBoolean(key, value).apply()
    }
    private fun float(key: String, default: Float) = object : kotlin.properties.ReadWriteProperty<Any?, Float> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = prefs.getFloat(key, default)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Float) = prefs.edit().putFloat(key, value).apply()
    }
    private fun string(key: String, default: String) = object : kotlin.properties.ReadWriteProperty<Any?, String> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = prefs.getString(key, default)!!
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: String) = prefs.edit().putString(key, value).apply()
    }
}
