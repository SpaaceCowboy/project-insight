package com.insightpuzzle.app

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.ui.platform.LocalContext
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SliderDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import kotlin.math.roundToInt
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** Sidewall height of the Journey and Worlds keys; the board frame uses the same deep wall. */
private val MODE_WALL = 8.dp

@Composable
fun HomeScreen(m: GameModel) {
    val p = LocalPalette.current
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
        val compact = maxHeight < 640.dp
        // Fit the letter-spaced wordmark between the touch targets, including at large font scales.
        val titleSize = minOf(if (compact) 26f else 29f, (minOf(maxWidth, 360.dp).value - 96f) / 6.35f / LocalDensity.current.fontScale).sp
        // The wordmark and the two mode buttons share one size, so the wordmark's narrow-screen fit sets it for all three.
        val homeSize = minOf(30f, titleSize.value).sp
        // The two modes split the space below the header: Journey the top half, Worlds the bottom half.
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 14.dp)) {
            // These two shortcuts have physical left/right positions even in RTL layouts.
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Box(Modifier.fillMaxWidth().heightIn(min = 48.dp), contentAlignment = Alignment.Center) {
                    HomeIconButton("Options", Modifier.align(Alignment.CenterStart), { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                    Label("MIDORI", homeSize, Modifier.padding(horizontal = 48.dp).semantics { heading() }, color = p.accent, weight = FontWeight.Bold, spacing = .3.em, align = TextAlign.Center, lines = 1)
                    HomeIconButton("Profile", Modifier.align(Alignment.CenterEnd), { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
                }
            }
            // Slightly smaller than the half each mode owns, with room under it for the tall sidewall.
            Box(Modifier.weight(1f).fillMaxWidth().padding(bottom = MODE_WALL), contentAlignment = Alignment.Center) {
                MenuButton(tr("Journey").uppercase(), Modifier.fillMaxWidth(.94f).fillMaxHeight(.94f), fontSize = homeSize, description = "Journey", weight = FontWeight.Bold, raised = true, depth = MODE_WALL, cue = Cue.FORWARD) { m.startJourney() }
            }
            Box(Modifier.weight(1f).fillMaxWidth().padding(bottom = MODE_WALL), contentAlignment = Alignment.Center) {
                MenuButton(tr("Worlds").uppercase(), Modifier.fillMaxWidth(.94f).fillMaxHeight(.94f), fontSize = homeSize, description = "Worlds", weight = FontWeight.Bold, raised = true, depth = MODE_WALL, cue = Cue.FORWARD) { m.openOnline(Route.Online) }
            }
        }
    }
}

/** Line art that moves with its button: [draw] gets how far the button is pressed (0..1). [stays] keeps it at 1 after a tap, while the screen it opens comes up. */
class AnimatedIcon(val stays: Boolean, val draw: DrawScope.(Color, Float) -> Unit)

/** Small raised plush button with line art: it sinks when touched; a border shows only while keyboard-focused. */
@Composable
fun HomeIconButton(label: String, modifier: Modifier, onClick: () -> Unit, icon: DrawScope.(Color) -> Unit, cue: Cue?, enabled: Boolean = true) =
    PlushIconButton(label, modifier, onClick, cue, enabled, false, true, icon = { c, _ -> icon(c) })

/** The same button with icon art that animates as it is pressed (Options' knobs swap sides, Profile's head bobs). */
@Composable
fun HomeIconButton(label: String, modifier: Modifier, onClick: () -> Unit, icon: AnimatedIcon, cue: Cue?, enabled: Boolean = true) =
    PlushIconButton(label, modifier, onClick, cue, enabled, icon.stays, true, icon.draw)

@Composable
private fun PlushIconButton(label: String, modifier: Modifier, onClick: () -> Unit, cue: Cue?, enabled: Boolean, stays: Boolean, plush: Boolean, icon: DrawScope.(Color, Float) -> Unit, tint: Color? = null) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    var tapped by remember { mutableStateOf(false) }
    val press = pressProgress(interactions)
    // The icon follows the press; an icon that [stays] finishes its move after the tap instead of springing back.
    val art by androidx.compose.animation.core.animateFloatAsState(if (tapped && stays) 1f else press, if (LocalReduceMotion.current) androidx.compose.animation.core.snap()
        else androidx.compose.animation.core.spring(dampingRatio = .5f, stiffness = 500f), label = "icon")
    val shape = RoundedCornerShape(14.dp)
    // The bare variant (Back) has no face at all: only the line art, which moves with the press.
    val face = if (plush) Modifier.padding(2.dp).plush(shape, press, p.paper2, rest = 4.dp).then(if (focused) Modifier.border(2.dp, p.accent, shape) else Modifier) else Modifier
    Box(modifier.size(48.dp).then(face)
        .then(if (enabled) Modifier.pressOnTouch(interactions) else Modifier)
        .clickable(enabled = enabled, interactionSource = interactions, indication = null, role = Role.Button, onClickLabel = tr(label)) { tapped = true; feedback(cue); onClick() }
        .semantics { contentDescription = tr(label) },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(20.dp)) { icon(tint ?: p.ink, if (stays) art else press) }
    }
}

private fun DrawScope.stroke(color: Color, path: androidx.compose.ui.graphics.Path) =
    drawPath(path, color, style = Stroke(1.7f * size.width / 24f, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
private fun DrawScope.path(build: androidx.compose.ui.graphics.Path.(Float) -> Unit) = androidx.compose.ui.graphics.Path().apply { build(size.width / 24f) }
/** Two sliders; pressing slides each knob to where the other one sits (top 10 → 14, bottom 14 → 10). */
val optionsIcon = AnimatedIcon(stays = true) { c, t ->
    val u = size.width / 24f
    for ((y, knob) in listOf(7f to 10f + 4f * t, 17f to 14f - 4f * t)) {
        polyline(c, 4f, y, knob - 3f, y); polyline(c, knob + 3f, y, 20f, y)
        drawCircle(c, 3f * u, Offset(knob * u, y * u), style = Stroke(1.7f * u))
    }
}
/** A person; pressing lifts the head a little and it settles back with a small bob. */
val personIcon = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    drawCircle(c, 3.5f * u, Offset(12 * u, (8.5f - 2f * t) * u), style = Stroke(1.7f * u))
    drawArc(c, 180f, 180f, false, Offset(5 * u, 13 * u), Size(14 * u, 14 * u), style = Stroke(1.7f * u, cap = StrokeCap.Round))
}
/** Players: two people, the one behind smaller; pressing lifts the front one while the one behind settles. */
val peopleIcon = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    val line = Stroke(1.7f * u, cap = StrokeCap.Round)
    val front = -1.6f * t; val back = 1.1f * t
    drawCircle(c, 3f * u, Offset(9 * u, (8.5f + front) * u), style = line)
    drawArc(c, 180f, 180f, false, Offset(3 * u, (14 + front) * u), Size(12 * u, 12 * u), style = line)
    drawCircle(c, 2.5f * u, Offset(16.5f * u, (9 + back) * u), style = line)
    drawArc(c, 270f, 90f, false, Offset(11.5f * u, (15 + back) * u), Size(10 * u, 10 * u), style = line)
}
/** Puzzles: four outlined squares, in the same margins as the other icons; pressing gathers them towards the middle. */
val gridIcon = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    val pull = 1.3f * t
    for (r in 0..1) for (col in 0..1) {
        val x = 4.5f + col * 8.5f + if (col == 0) pull else -pull; val y = 4.5f + r * 8.5f + if (r == 0) pull else -pull
        drawRoundRect(c, Offset(x * u, y * u), Size(6.5f * u, 6.5f * u), CornerRadius(1.6f * u), style = Stroke(1.7f * u))
    }
}
/** Log out: an open door bracket with an arrow leaving it; pressing pushes the arrow a little further out. */
val logoutIcon = AnimatedIcon(stays = false) { c, t ->
    val x = 2.5f * t
    stroke(c, path { u -> moveTo(10 * u, 4 * u); lineTo(5 * u, 4 * u); lineTo(5 * u, 20 * u); lineTo(10 * u, 20 * u)
        moveTo((11 + x) * u, 12 * u); lineTo((20 + x) * u, 12 * u); moveTo((16.5f + x) * u, 8.5f * u); lineTo((20 + x) * u, 12 * u); lineTo((16.5f + x) * u, 15.5f * u) })
}
/** Gameplay tips: a plain lamp (bulb, neck and two base lines); pressing dips it a little. */
val guideIcon = AnimatedIcon(stays = false) { c, t ->
    val u = size.width / 24f
    translate(0f, 1.5f * u * t) {
        drawArc(c, 130f, 280f, false, Offset(6.5f * u, 3.5f * u), Size(11f * u, 11f * u), style = Stroke(1.7f * u, cap = StrokeCap.Round))
        polyline(c, 8.46f, 13.2f, 9.5f, 16f, 14.5f, 16f, 15.54f, 13.2f)
        polyline(c, 10f, 19f, 14f, 19f)
    }
}
/** Back: a chevron pointing down; pressing dips it. */
val chevronIcon = AnimatedIcon(stays = false) { c, t ->
    val y = 2f * t
    stroke(c, path { u -> moveTo(5 * u, (9 + y) * u); lineTo(12 * u, (16 + y) * u); lineTo(19 * u, (9 + y) * u) })
}
/** Sort: three bars, each shorter than the one above; pressing flips the order (the top bar shortens while the bottom one grows). */
val sortIcon = AnimatedIcon(stays = false) { c, t ->
    polyline(c, 4f, 7f, 20f - 10f * t, 7f); polyline(c, 4f, 12f, 15f, 12f); polyline(c, 4f, 17f, 10f + 10f * t, 17f)
}
/** Share feedback: a speech bubble. */
val feedbackIcon: DrawScope.(Color) -> Unit = { c ->
    stroke(c, path { u -> moveTo(5 * u, 5 * u); lineTo(19 * u, 5 * u); lineTo(19 * u, 15 * u); lineTo(11 * u, 15 * u); lineTo(7 * u, 19 * u); lineTo(7 * u, 15 * u); lineTo(5 * u, 15 * u); close() })
}
/** Report a bug: an oval body with a centre seam, two antennae and three legs a side. */
val bugIcon: DrawScope.(Color) -> Unit = { c ->
    val u = size.width / 24f
    drawOval(c, Offset(8 * u, 7 * u), Size(8 * u, 13 * u), style = Stroke(1.7f * u))
    polyline(c, 12f, 8f, 12f, 19f); polyline(c, 10f, 7.5f, 8f, 4f); polyline(c, 14f, 7.5f, 16f, 4f)
    for (y in listOf(10f, 13.5f, 17f)) { polyline(c, 8f, y, 4.5f, y - 1f); polyline(c, 16f, y, 19.5f, y - 1f) }
}
/** Licences: a page with a folded corner and three lines of text. */
val documentIcon: DrawScope.(Color) -> Unit = { c ->
    stroke(c, path { u -> moveTo(6 * u, 3.5f * u); lineTo(14 * u, 3.5f * u); lineTo(18 * u, 7.5f * u); lineTo(18 * u, 20.5f * u); lineTo(6 * u, 20.5f * u); close()
        moveTo(14 * u, 3.5f * u); lineTo(14 * u, 7.5f * u); lineTo(18 * u, 7.5f * u)
        for (y in listOf(11f, 14f, 17f)) { moveTo(9 * u, y * u); lineTo(15 * u, y * u) } })
}

/** The Back button every screen but Home has, centred between Options and Profile. Tap it, or pull it down to bring the screen down with it. */
@Composable
fun BackChevron(m: GameModel, modifier: Modifier = Modifier) = PlushIconButton("Back", modifier.sheetDrag(m), { m.back() }, Cue.BACK, true, false, false, chevronIcon.draw)

/**
 * The gameplay-tips lamp, etched into the top right of the board's outline: line art only, no key, and greyer than the other icons.
 * [onClick] opens the tips (the game screen and the creator each decide what that means).
 */
@Composable
fun GuideButton(modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    PlushIconButton("Gameplay tips", modifier, onClick, Cue.SELECT, true, false, false, guideIcon.draw, tint = lerp(p.paper2, p.ink, .5f))
}

/** Where the lamp sits for an outline [shell]: its 48dp touch area has the icon about 28dp in from the outline's top and right edges. */
fun Density.guideLampOffset(shell: androidx.compose.ui.geometry.Rect) = IntOffset((shell.right - 52.dp.toPx()).roundToInt(), (shell.top + 4.dp.toPx()).roundToInt())

/** For pages without their own icon row: the Back chevron alone in a 48dp row, then [ScreenGap]. */
@Composable
fun ChevronBar(m: GameModel) {
    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) { BackChevron(m) }
    Spacer(Modifier.height(ScreenGap))
}

/** Real values go here before release. A row is shown only when its value is set, so nothing broken ships. */
object AppLinks {
    const val PRIVACY_URL = ""
    const val CONTACT_EMAIL = ""
}

@Composable
fun OptionsScreen(m: GameModel) {
    val tabs = listOf("options" to "Options", "rulebook" to "Rulebook", "about" to "About")
    var tab by m::optionsTab
    val context = LocalContext.current
    Box(Modifier.fillMaxSize()) {
        Page("Options", 520.dp) {
            ChevronBar(m)
            // The raised rows cast a shadow past their edges, which the scroll area would clip; this inset leaves it room.
            Tabs(tabs, tab, modifier = Modifier.padding(horizontal = 6.dp)) { tab = it }
            if (tab == "rulebook") RulebookTab(m)
            else Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 6.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (tab) {
                    "options" -> {
                        ToggleRow("Haptics", m.haptics) { m.toggleHaptics() }
                        ToggleRow("Sound", m.sound) { m.toggleSound() }
                        VolumeSlider("Ambience", m.ambience) { m.changeAmbience(it) }
                        VolumeSlider("Effects", m.effects) { m.changeEffects(it) }
                        // No headings: Light/Dark and the languages sit as close to their neighbours as Haptics and Sound do, so the page fits without scrolling.
                        Tabs(listOf("light" to "Light", "dark" to "Dark"), m.theme, Cue.CHECK, bottom = 0.dp) { m.changeTheme(it) }
                        ToggleRow("Colourblind mode", m.colorblind) { m.toggleColorblind() }
                        ToggleRow("Gameplay tips", m.guideOn) { m.toggleGuide() }
                        // Each language is named in itself; the same sound as the Light and Dark buttons.
                        Tabs(L10n.LANGUAGES, m.language, Cue.CHECK, labelSize = 10.5.sp, bottom = 0.dp) { m.changeLanguage(it) }
                    }
                    else -> {
                        // Both open a page to write in; Send mails it to the team.
                        InfoRow("Share feedback", "", icon = feedbackIcon, onClick = { m.push(Route.Feedback("feedback")) })
                        InfoRow("Report a bug", "", icon = bugIcon, onClick = { m.push(Route.Feedback("bug")) })
                        val info = remember { context.packageManager.getPackageInfo(context.packageName, 0) }
                        InfoRow("Version", "${info.versionName} (${androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(info)})", pressable = true)
                        InfoRow("Licences", "", icon = documentIcon, onClick = { m.push(Route.Licences) })
                        if (AppLinks.PRIVACY_URL.isNotEmpty()) InfoRow("Privacy policy", "Open", onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppLinks.PRIVACY_URL))) })
                        if (AppLinks.CONTACT_EMAIL.isNotEmpty()) InfoRow("Contact", AppLinks.CONTACT_EMAIL, onClick = { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:${AppLinks.CONTACT_EMAIL}"))) })

                        if (BuildConfig.DEBUG) ToggleRow("Developer mode", m.dev) { m.toggleDev() }
                    }
                }
            }
        }
    }
}

/** Options → About → Licences: the bundled font's licence, a page of its own like Report a bug. */
@Composable
fun LicencesScreen(m: GameModel) {
    val p = LocalPalette.current
    val context = LocalContext.current
    val text = remember { context.assets.open("licenses/jetbrains-mono-OFL.txt").bufferedReader().use { it.readText() } }
    val words = remember { context.assets.open("licenses/ldnoobw-CC-BY-4.0.txt").bufferedReader().use { it.readText() } }
    Page("Licences", 560.dp) {
        ChevronBar(m)
        Label("Licences", 22.sp, Modifier.fillMaxWidth().semantics { heading() }, align = TextAlign.Center)
        Column(Modifier.weight(1f).padding(top = 12.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label("JetBrains Mono", 14.sp, weight = FontWeight.SemiBold, translate = false)
            Label(text.trim(), 11.sp, color = p.muted, translate = false)
            Spacer(Modifier.height(4.dp))
            Label("Banned-word list", 14.sp, weight = FontWeight.SemiBold)
            Label(words.trim(), 11.sp, color = p.muted, translate = false)
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** Where a slider settles while dragged from [current] towards raw position [raw] (in stops): it leaves a stop only past [DETENT] of the way to the next one. */
internal fun detentStop(current: Int, raw: Float, max: Int): Int {
    var stop = current
    while (stop < max && raw >= stop + DETENT) stop++
    while (stop > 0 && raw <= stop - DETENT) stop--
    return stop
}
private const val DETENT = .6f
private const val TURN_CUE_GAP_MS = 120L

/** Plays the slider's touch sound for a change of direction, at most once per [TURN_CUE_GAP_MS]; returns the time to remember. */
private fun playTurn(feedback: (Cue?) -> Unit, last: Long): Long {
    val now = android.os.SystemClock.uptimeMillis()
    if (now - last < TURN_CUE_GAP_MS) return last
    feedback(Cue.SWIPE)
    return now
}
private const val STOPS = 10

/** Volume 0–10: a fat track and a soft knob that lags behind the finger and settles into each stop with a little give; a haptic tick at each stop. Stored as 0..1. */
@Composable
private fun VolumeSlider(label: String, value: Float, onChange: (Float) -> Unit) {
    val p = LocalPalette.current
    val feedback by androidx.compose.runtime.rememberUpdatedState(LocalFeedback.current)
    val change by androidx.compose.runtime.rememberUpdatedState(onChange)
    val stop = (value * STOPS).let { kotlin.math.round(it).toInt() }.coerceIn(0, STOPS)
    val current by androidx.compose.runtime.rememberUpdatedState(stop)
    var pressed by remember { mutableStateOf(false) }
    val reduce = LocalReduceMotion.current
    // The knob chases its stop on a loose spring (so dragging has weight) and swells while held.
    val at by androidx.compose.animation.core.animateFloatAsState(stop.toFloat(), if (reduce) androidx.compose.animation.core.snap()
        else androidx.compose.animation.core.spring(dampingRatio = .55f, stiffness = 380f), label = "knob")
    val swell by androidx.compose.animation.core.animateFloatAsState(if (pressed) 1.18f else 1f, if (reduce) androidx.compose.animation.core.snap()
        else androidx.compose.animation.core.spring(dampingRatio = .5f, stiffness = 600f), label = "swell")
    fun set(next: Int) { if (next != current) { change(next / STOPS.toFloat()); feedback(null) } }
    Column {
        Row { Label(label, 13.sp, weight = FontWeight.SemiBold); Spacer(Modifier.weight(1f)); Label("$stop", 13.sp, color = p.muted) }
        val knob = 32.dp
        Canvas(Modifier.fillMaxWidth().height(52.dp)
            .pointerInput(Unit) {
                val r = knob.toPx() / 2
                fun raw(x: Float) = ((x - r) / (size.width - 2 * r) * STOPS).coerceIn(0f, STOPS.toFloat())
                awaitEachGesture {
                    val down = awaitFirstDown(); down.consume(); feedback(Cue.SWIPE); pressed = true
                    // A tap jumps to the nearest stop; a drag walks the stops with the detent.
                    set(kotlin.math.round(raw(down.position.x)).toInt())
                    // Still holding, every turn of the finger (right then left, left then right...) plays the sound again.
                    val turn = 6.dp.toPx()
                    var dir = 0; var extreme = down.position.x; var lastCue = android.os.SystemClock.uptimeMillis()
                    while (true) {
                        val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        change.consume()
                        val x = change.position.x
                        if (dir == 0) { if (kotlin.math.abs(x - extreme) >= turn) { dir = if (x > extreme) 1 else -1; extreme = x } }
                        else if (dir > 0) {
                            if (x > extreme) extreme = x
                            else if (extreme - x >= turn) { dir = -1; extreme = x; lastCue = playTurn(feedback, lastCue) }
                        } else {
                            if (x < extreme) extreme = x
                            else if (x - extreme >= turn) { dir = 1; extreme = x; lastCue = playTurn(feedback, lastCue) }
                        }
                        set(detentStop(current, raw(x), STOPS))
                    }
                    pressed = false
                }
            }
            .semantics {
                contentDescription = tr("{0} volume", tr(label))
                progressBarRangeInfo = androidx.compose.ui.semantics.ProgressBarRangeInfo(stop.toFloat(), 0f..STOPS.toFloat(), STOPS - 1)
                setProgress { target -> set(kotlin.math.round(target).toInt().coerceIn(0, STOPS)); true }
            }) {
            val r = knob.toPx() / 2; val y = size.height / 2; val span = size.width - 2 * r
            val x = r + span * at / STOPS
            val thickness = 16.dp.toPx()
            drawLine(p.muted.copy(alpha = .3f), Offset(r, y), Offset(size.width - r, y), thickness, StrokeCap.Round)
            drawLine(p.accent, Offset(r, y), Offset(x, y), thickness, StrokeCap.Round)
            drawCircle(Color.Black.copy(alpha = if (p.dark) .45f else .2f), r * swell, Offset(x, y + 2.dp.toPx()))
            drawCircle(p.ink, r * swell, Offset(x, y))
        }
    }
}

@Composable
fun AchievementsScreen(m: GameModel) {
    val p = LocalPalette.current
    val badges = m.achievements.catalog
    val account = m.online.user?.id
    LaunchedEffect(account) { if (account != null) m.online.refreshProgress() }
    Page("Achievements") {
            ChevronBar(m)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (badge in badges) {
                    val earned = badge.id in m.earned; val progress = m.achievements.progress(badge, m.done, m.onlineStats)
                    val shape = RoundedCornerShape(16.dp)
                    // The rows do nothing when tapped, but they sink like every other key.
                    val source = remember { MutableInteractionSource() }
                    Row(Modifier.fillMaxWidth().plush(shape, pressProgress(source), if (earned) lerp(p.paper2, p.accent, .14f) else p.paper2, rest = 4.dp)
                        .pressOnTouch(source).clickable(source, null) {}.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Label(tr(badge.nameTemplate, badge.goal), 15.sp, weight = FontWeight.SemiBold, translate = false)
                            Label(tr(badge.requirementTemplate, badge.goal), 12.sp, color = p.muted, translate = false)
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                                Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(p.line)) {
                                    Box(Modifier.fillMaxWidth(progress / badge.goal.toFloat()).height(6.dp).background(p.accent))
                                }
                                Spacer(Modifier.width(8.dp)); Label("$progress / ${badge.goal}", 11.sp, color = p.muted)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
    }
}

/** The result: two text-free bars along the bottom (restart left, next right), in the page colours, with the solved board still visible above. GameScreen animates it in and out; while it leaves ([interactive] false) nothing in it can be pressed again. */
@Composable
fun WinPopup(m: GameModel, interactive: Boolean = true, onRestart: () -> Unit = { m.restart() }) {
    val final = m.level == m.levels.size - 1
    val casual = m.community?.casual == true
    val nextEnabled = if (casual) !m.online.busy else if (m.community != null || final) true else m.canAccess(m.level + 1)
    val p = LocalPalette.current
    val ink = p.ink
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, bottom = 24.dp)
            // Leaving: every touch is swallowed before the buttons see it, so Next can't fire twice and skip a level.
            .then(if (interactive) Modifier else Modifier.clearAndSetSemantics { }.pointerInput(Unit) {
                awaitPointerEventScope { while (true) awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial).changes.forEach { it.consume() } }
            })
            .semantics { paneTitle = tr("Grid solved"); liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        m.winBadges.firstOrNull()?.let { badge ->
            val source = remember { MutableInteractionSource() }
            val badgeName = tr(badge.nameTemplate, badge.goal)
            Label(badgeName, 12.sp, Modifier.heightIn(min = 32.dp).plush(shape, pressProgress(source), p.paper2, rest = 4.dp)
                .pressOnTouch(source).clickable(source, null, role = Role.Button, onClickLabel = tr("Open achievements")) { m.feedback(Cue.CHECK); m.push(Route.Achievements) }
                .semantics { contentDescription = tr("Achievement earned: {0}", badgeName) }.padding(horizontal = 14.dp, vertical = 8.dp),
                color = ink, weight = FontWeight.SemiBold, translate = false)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // The restart itself plays its cue and haptic once (runRestart), so the button adds none of its own.
            WinButton("Restart level", Modifier.weight(1f), true, onRestart, cue = null) { restartIcon(ink) }
            WinButton("Next level", Modifier.weight(1f), nextEnabled, { m.next() }, Cue.PRESS) { polyline(ink, 4f, 12f, 20f, 12f); polyline(ink, 14f, 6f, 20f, 12f); polyline(ink, 14f, 18f, 20f, 12f) }
        }
    }
}

@Composable
private fun WinButton(label: String, modifier: Modifier, enabled: Boolean, onClick: () -> Unit, cue: Cue? = Cue.PRESS, icon: DrawScope.() -> Unit) {
    val feedback = LocalFeedback.current
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    val source = remember { MutableInteractionSource() }
    Box(modifier.height(64.dp).alpha(if (enabled) 1f else .4f).plush(shape, pressProgress(source), p.paper2)
        .then(if (enabled) Modifier.pressOnTouch(source).clickable(source, null, role = Role.Button, onClickLabel = tr(label)) { feedback(cue); onClick() } else Modifier.semantics { disabled() })
        .semantics { contentDescription = tr(label) }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(28.dp)) { icon() }
    }
}
