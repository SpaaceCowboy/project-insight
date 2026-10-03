# Cozy Sound Pack

Six small local WAV assets, loaded without a network service:

- `ambient.wav`: a seamless 32-second bed of spacious, gently swelling forest-toned pads with two distant chimes.
- `select.wav`: a short, soft pluck.
- `move.wav`: a rounded two-note movement sound.
- `deny.wav`: a quiet low note.
- `win.wav`: a soft three-note completion chime.
- `voice.wav`: a gentle “Lovely.” completion cue, synthesized with Windows Microsoft Zira. It plays at most once every 90 seconds and gives no instructions.

Selection and movement now use native Web Audio plucks: each color has a distinct note in a shared C-major pentatonic palette. Movement has a longer, soft harmonic tail; undo answers with a descending pair. The WAV selection/movement cues remain as a fallback when Web Audio is unavailable. Mute and page visibility stop ringing notes as well as the recordings, and mute survives reload.

The instrumental recordings are normalized to peaks of 0.40 (ambience) and 0.45 (effects), with no clipping. Ambience and Effects now have separate saved volume sliders, defaulting to 80%; the previous master volume initializes both on migration. Generated plucks and speech follow Effects. The spoken celebration checkbox can silence speech independently and preserves the previous enabled default. Volume changes and mute use short fades; the Sound button mutes every layer, and background audio pauses when the page is hidden.

`node make-sounds.cjs` rebuilds the five original instrumental assets using only Node's standard library. The voice file is bundled and does not require Windows speech services during gameplay. These assets evoke a cozy, luminous woodland mood without using music or sound effects from Ori.
