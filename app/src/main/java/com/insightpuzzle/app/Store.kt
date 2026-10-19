package com.insightpuzzle.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/** Saved progress and settings. SharedPreferences is enough: a few small values, written on each solve or setting change. */
class Store(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(if (BuildConfig.ONLINE_DEMO) "insight_demo" else "insight", Context.MODE_PRIVATE)
    var activeAccount: String? = prefs.getString("activeAccount", null); private set
    private fun scoped(key: String, account: String? = activeAccount) = account?.let { "account_${it}_$key" } ?: key
    fun selectAccount(id: String?) {
        check(prefs.edit().apply { if (id == null) remove("activeAccount") else putString("activeAccount", id) }.commit())
        activeAccount = id
    }
    fun guestProgress() = prefs.getStringSet("done", emptySet())!!.mapNotNull { it.toIntOrNull() }.toSet()
    fun guestBadges() = prefs.getStringSet("earned", emptySet())!!.map { it.substringBefore('=') }
    var importedInto: String?
        get() = prefs.getString("importedInto", null)
        set(value) { check(prefs.edit().putString("importedInto", value).commit()) }
    var creatorDraft: String?
        get() = prefs.getString("creatorDraft", null)
        set(value) { check(prefs.edit().putString("creatorDraft", value).commit()) }

    /** Bridge the synchronous gameplay result into Room without losing a proof on process death. */
    fun saveProof(payload: JSONObject) {
        val key = scoped("proof_${payload.getString("operationId")}")
        check(prefs.edit().putString(key, payload.toString()).commit())
    }
    fun proofs(account: String? = activeAccount): List<JSONObject> {
        val prefix = scoped("proof_", account)
        return prefs.all.filterKeys { it.startsWith(prefix) }.values.map { JSONObject(it as String) }
    }
    fun removeProof(id: String, account: String?) { check(prefs.edit().remove(scoped("proof_$id", account)).commit()) }

    /** 1-based level numbers that have been solved. */
    var done: Set<Int>
        get() = prefs.getStringSet(scoped("done"), emptySet())!!.mapNotNull { it.toIntOrNull() }.toSet()
        set(value) = prefs.edit().putStringSet(scoped("done"), value.map { it.toString() }.toSet()).apply()

    /** Community history is account-scoped and separate from campaign unlocks and resets. */
    var communityDone: Set<String>
        get() = prefs.getStringSet(scoped("community_done"), emptySet())!!.toSet()
        set(value) { check(prefs.edit().putStringSet(scoped("community_done"), value).commit()) }

    /** Moves made in an unfinished level, as flat cell indices "a,b;c,d", so a level resumes where it was left. */
    fun attempt(level: Int): String? = prefs.getString(scoped("attempt_$level"), null)
    fun saveAttempt(level: Int, path: String?) = prefs.edit().apply { if (path.isNullOrEmpty()) remove(scoped("attempt_$level")) else putString(scoped("attempt_$level"), path) }.apply()
    fun communityAttempt(id: String): String? = prefs.getString(scoped("community_attempt_$id"), null)
    fun saveCommunityAttempt(id: String, path: String?) = prefs.edit().apply {
        if (path.isNullOrEmpty()) remove(scoped("community_attempt_$id")) else putString(scoped("community_attempt_$id"), path)
    }.apply()

    fun playAttempt(id: String): JSONObject? = prefs.getString(scoped("play_attempt_$id"), null)?.let { JSONObject(it) }
    /** Progress, attempt identity, and any terminal proof are committed before navigation. */
    fun savePlayAttempt(id: String, path: String?, attempt: PlayAttempt, proof: JSONObject? = null) {
        check(prefs.edit().apply {
            if (path.isNullOrEmpty()) remove(scoped("community_attempt_$id")) else putString(scoped("community_attempt_$id"), path)
            putString(scoped("play_attempt_$id"), attempt.json().toString())
            if (proof != null) putString(scoped("proof_${proof.getString("operationId")}"), proof.toString())
        }.commit())
    }

    var lastLevel: Int
        get() = prefs.getInt(scoped("lastLevel"), 0)
        set(value) = prefs.edit().putInt(scoped("lastLevel"), value).apply()

    var sound by bool("sound", true)
    var dark by bool("dark", true)
    var haptics by bool("haptics", true)
    var pauseOverOthers by bool("pauseOverOthers", true)
    var silenceOnUnplug by bool("silenceOnUnplug", true)
    /** Not in Options: the instrumented tests set "on" to freeze decorative animation. */
    var motion by string("motion", "system")
    /** "light" or "dark". Older installs stored "system" or only the dark/light boolean; both fall back to dark unless light was chosen. */
    var theme: String
        get() = if ((prefs.getString("theme", null) ?: if (prefs.getBoolean("dark", true)) "dark" else "light") == "light") "light" else "dark"
        set(value) = prefs.edit().putString("theme", value).apply()
    var dev by bool("dev", false)
    var effects by float("effects", .8f)
    var ambience by float("ambience", .8f)
    var background by string("background", "forest")
    var finish by string("finish", "original")

    /** Clears solved levels and unfinished attempts. Badges, cosmetics and settings are kept: rewards are permanent. */
    fun resetProgress() = prefs.edit().apply {
          remove(scoped("done")); remove(scoped("lastLevel"))
          prefs.all.keys.filter { it.startsWith(scoped("attempt_")) }.forEach { remove(it) }
    }.apply()

    /** Achievement id -> time earned (ms). */
    var earned: Map<String, Long>
        get() = prefs.getStringSet(scoped("earned"), emptySet())!!.mapNotNull { entry -> entry.split('=').takeIf { it.size == 2 }?.let { it[0] to (it[1].toLongOrNull() ?: 0L) } }.toMap()
        set(value) = prefs.edit().putStringSet(scoped("earned"), value.map { "${it.key}=${it.value}" }.toSet()).apply()

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
