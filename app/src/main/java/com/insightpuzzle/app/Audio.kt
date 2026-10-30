package com.insightpuzzle.app

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Zen interface cues through SoundPool, plus two loops on it: the zen "streaming" music everywhere but the game screens and the creator (on the Ambience
 * slider), and the creator's own "processing" bed (on the Effects slider).
 */
class Audio(private val context: Context) {
    // USAGE_GAME plays on the media stream, so the phone's volume keys scale the cues together with the music; the Effects slider is the level within that.
    private val pool = SoundPool.Builder().setMaxStreams(8)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val ids = mutableMapOf<Cue, Int>()
    private val loaded = mutableSetOf<Int>()
    /** Sounds that finished loading, well or badly. */
    private var settled = 0
    private val musicId: Int
    /** Every cue and the music loop are decoded (the splash screen waits for this): the first tap is instant and the music is already playing. */
    var ready by mutableStateOf(false); private set
    private fun checkReady() { if (!ready && settled >= Cue.entries.size + 1) ready = true }
    @Volatile private var released = false
    private var foreground = true
    /** The creator wants its processing loop; [processingStream] is the playing stream, 0 when silent. */
    private var processing = false
    private var processingStream = 0
    /** The screen on top is not a game screen or the creator; [musicStream] is the playing stream, 0 when silent. */
    private var musicWanted = true
    private var musicStream = 0

    // SoundPool cannot play above 1.0, so the +50% headroom is in the files: every zen cue is stored 1.5x louder than the original uisfx clip.
    // Effects level 10 (1.0 here) therefore plays at 150% of the old maximum, and each of the ten steps adds 15%.
    var enabled = true; set(value) { field = value; updateLoops() }
    var effects = .8f; set(value) { field = value; if (processingStream != 0) pool.setVolume(processingStream, value, value) }
    var ambience = .8f; set(value) { field = value; if (musicStream != 0) pool.setVolume(musicStream, musicVolume(), musicVolume()) }
    private fun musicVolume() = ambience * MUSIC_LEVEL
    init {
        pool.setOnLoadCompleteListener { _, id, status -> settled++; if (status == 0) { loaded += id; updateLoops() }; checkReady() }
        Cue.entries.forEach { ids[it] = pool.load(context, it.res, 1) }
        musicId = pool.load(context, R.raw.zen_streaming, 1)
    }

    fun play(cue: Cue) {
        if (!enabled) return
        val id = ids[cue]?.takeIf { it in loaded } ?: return
        val volume = effects * cue.gain
        pool.play(id, volume, volume, 1, 0, 1f)
    }

    /** Creator mode's background loop: on while the creator is open, Sound is on and the app is visible. */
    fun startProcessing() { processing = true; updateLoops() }
    fun stopProcessing() { processing = false; updateLoops() }

    /** The music plays on every screen but the game screens (Journey and online) and the creator, which has its own bed. */
    fun music(wanted: Boolean) { if (musicWanted != wanted) { musicWanted = wanted; updateLoops() } }

    private fun updateLoops() {
        val audible = enabled && foreground && !released
        val wantProcessing = processing && audible
        if (!wantProcessing && processingStream != 0) { pool.stop(processingStream); processingStream = 0 }
        val processingId = ids[Cue.PROCESSING]
        if (wantProcessing && processingStream == 0 && processingId != null && processingId in loaded) processingStream = pool.play(processingId, effects, effects, 0, -1, 1f)
        val wantMusic = musicWanted && audible
        if (!wantMusic && musicStream != 0) { pool.stop(musicStream); musicStream = 0 }
        if (wantMusic && musicStream == 0 && musicId in loaded) musicStream = pool.play(musicId, musicVolume(), musicVolume(), 0, -1, 1f)
    }

    fun onForeground(visible: Boolean) {
        foreground = visible
        if (!visible) pool.autoPause() else pool.autoResume()
        updateLoops()
    }

    fun release() { released = true; pool.release() }

    companion object {
        /** The music's level under the Ambience slider. Its file is stored +3 dB like the other added cues; this keeps it a quiet bed under the cues. */
        const val MUSIC_LEVEL = .5f
    }
}
