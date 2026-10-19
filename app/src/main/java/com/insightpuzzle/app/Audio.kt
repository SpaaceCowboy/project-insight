package com.insightpuzzle.app

import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import androidx.core.content.ContextCompat
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import kotlin.concurrent.thread

/** Port of src/sound.js: tile notes and effects through SoundPool, looping forest and mountain ambience through MediaPlayer. */
class Audio(private val context: Context) {
    private val pool = SoundPool.Builder().setMaxStreams(8)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val ids = mutableMapOf<String, Int>()
    @Volatile private var ambient: MediaPlayer? = null
    @Volatile private var mountain: MediaPlayer? = null
    private val beds get() = listOfNotNull(ambient, mountain)
    private val forestLevel = .7f
    private val mountainLevel = .55f
    @Volatile private var released = false
    private var started = false
    private var foreground = true

    var pauseOverOthers = true
    var silenceOnUnplug = true
    // Headphones pulled out: stay quiet (like a music app) until the player toggles Sound or returns to the app.
    private var silenced = false
    private val noisy = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { if (silenceOnUnplug) { silenced = true; beds.forEach { it.pause() } } }
    }
    private val audioManager = context.getSystemService(AudioManager::class.java)

    var enabled = true; set(value) { field = value; if (!value) beds.forEach { it.pause() } else { silenced = false; if (started && foreground) startIfAllowed() } }
    var effects = .8f
    var ambience = .8f; set(value) { field = value; ambient?.setVolume(forestLevel * value, forestLevel * value); mountain?.setVolume(mountainLevel * value, mountainLevel * value) }
    init {
        mapOf(
            "sfx_select" to R.raw.sfx_select, "sfx_move" to R.raw.sfx_move, "sfx_deny" to R.raw.sfx_deny, "sfx_win" to R.raw.sfx_win,
            "note_select_r" to R.raw.note_select_r, "note_select_b" to R.raw.note_select_b, "note_select_g" to R.raw.note_select_g,
            "note_select_y" to R.raw.note_select_y, "note_select_p" to R.raw.note_select_p, "note_select_w" to R.raw.note_select_w,
            "note_move_r" to R.raw.note_move_r, "note_move_b" to R.raw.note_move_b, "note_move_g" to R.raw.note_move_g,
            "note_move_y" to R.raw.note_move_y, "note_move_p" to R.raw.note_move_p, "note_move_w" to R.raw.note_move_w,
        ).forEach { (name, res) -> ids[name] = pool.load(context, res, 1) }
        // MediaPlayer.create() decodes synchronously; doing it on the first tap made that tap hitch.
        thread(name = "ambient-prep") {
            fun prepare(res: Int, level: Float) = MediaPlayer.create(context, res)?.apply { isLooping = true; setVolume(level * ambience, level * ambience) }
            val forest = prepare(R.raw.sfx_ambient, forestLevel)
            if (released) { forest?.release(); return@thread }
            ambient = forest
            Handler(Looper.getMainLooper()).post { if (started && enabled && foreground) startIfAllowed() }
            val mountainBed = prepare(R.raw.ambient_mountain_sanctuary, mountainLevel)
            if (released) { mountainBed?.release(); return@thread }
            mountain = mountainBed
            Handler(Looper.getMainLooper()).post { if (started && enabled && foreground) startIfAllowed() }
        }
        ContextCompat.registerReceiver(context, noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    /** Ambience starts only when nothing else is playing music (if the setting is on) and the headphones weren't just unplugged. */
    private fun startIfAllowed() {
        if (silenced) return
        val idle = beds.filterNot { it.isPlaying }
        if (idle.isEmpty()) return
        // When none of our own beds is playing, an active music stream belongs to another app.
        if (idle.size == beds.size && pauseOverOthers && audioManager.isMusicActive) return
        idle.forEach { it.start() }
    }

    /** kind: select, move, deny, win. Tile notes use the tile's own pitch, like the web game. */
    fun play(kind: String, type: Char? = null) {
        if (!enabled) return
        startAmbience()
        val note = if (type != null && kind in setOf("select", "move")) ids["note_${kind}_${type.lowercaseChar()}"] else null
        val id = note ?: ids["sfx_$kind"] ?: return
        val volume = if (note != null) effects else (if (kind == "deny") .6f else .9f) * effects
        pool.play(id, volume, volume, 1, 0, 1f)
    }

    // Like the web game, ambience starts with the first sound so it never plays before the player interacts.
    private fun startAmbience() {
        started = true
        if (foreground) startIfAllowed()
    }

    fun onForeground(visible: Boolean) {
        foreground = visible
        if (!visible) { beds.forEach { it.pause() }; pool.autoPause() } else { silenced = false; pool.autoResume(); if (started && enabled) startIfAllowed() }
    }

    fun release() { released = true; runCatching { context.unregisterReceiver(noisy) }; pool.release(); ambient?.release(); ambient = null; mountain?.release(); mountain = null }
}
