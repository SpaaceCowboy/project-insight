package com.insightpuzzle.app

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import kotlin.concurrent.thread

/** Zen interface cues through SoundPool (plus the creator's looping "processing" bed), and the forest and mountain ambience through MediaPlayer. */
class Audio(private val context: Context) {
    private val pool = SoundPool.Builder().setMaxStreams(8)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val ids = mutableMapOf<Cue, Int>()
    private val loaded = mutableSetOf<Int>()
    @Volatile private var ambient: MediaPlayer? = null
    @Volatile private var mountain: MediaPlayer? = null
    private val beds get() = listOfNotNull(ambient, mountain)
    private val forestLevel = .7f
    private val mountainLevel = .55f
    @Volatile private var released = false
    private var started = false
    private var foreground = true
    /** The creator wants its processing loop; [processingStream] is the playing stream, 0 when silent. */
    private var processing = false
    private var processingStream = 0

    var enabled = true; set(value) { field = value; if (!value) beds.forEach { it.pause() } else if (started && foreground) startIfAllowed(); updateProcessing() }
    var effects = .8f; set(value) { field = value; if (processingStream != 0) pool.setVolume(processingStream, value, value) }
    var ambience = .8f; set(value) { field = value; ambient?.setVolume(forestLevel * value, forestLevel * value); mountain?.setVolume(mountainLevel * value, mountainLevel * value) }
    init {
        pool.setOnLoadCompleteListener { _, id, status -> if (status == 0) { loaded += id; if (id == ids[Cue.PROCESSING]) updateProcessing() } }
        Cue.entries.forEach { ids[it] = pool.load(context, it.res, 1) }
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
    }

    private fun startIfAllowed() = beds.filterNot { it.isPlaying }.forEach { it.start() }

    fun play(cue: Cue) {
        if (!enabled) return
        startAmbience()
        val id = ids[cue]?.takeIf { it in loaded } ?: return
        pool.play(id, effects, effects, 1, 0, 1f)
    }

    /** Creator mode's background loop: on while the creator is open, Sound is on and the app is visible. */
    fun startProcessing() { processing = true; updateProcessing() }
    fun stopProcessing() { processing = false; updateProcessing() }

    private fun updateProcessing() {
        val want = processing && enabled && foreground && !released
        if (!want && processingStream != 0) { pool.stop(processingStream); processingStream = 0 }
        val id = ids[Cue.PROCESSING]
        if (want && processingStream == 0 && id != null && id in loaded) processingStream = pool.play(id, effects, effects, 0, -1, 1f)
    }

    // Like the web game, ambience starts with the first sound so it never plays before the player interacts.
    private fun startAmbience() {
        started = true
        if (foreground) startIfAllowed()
    }

    fun onForeground(visible: Boolean) {
        foreground = visible
        if (!visible) { beds.forEach { it.pause() }; pool.autoPause() } else { pool.autoResume(); if (started && enabled) startIfAllowed() }
        updateProcessing()
    }

    fun release() { released = true; pool.release(); ambient?.release(); ambient = null; mountain?.release(); mountain = null }
}
