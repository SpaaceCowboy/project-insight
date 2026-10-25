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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

@Composable
fun HomeScreen(m: GameModel) {
    val p = LocalPalette.current
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp)) {
        val compact = maxHeight < 640.dp
        // Fit the letter-spaced wordmark between the touch targets, including at large font scales.
        val titleSize = minOf(if (compact) 26f else 29f, (minOf(maxWidth, 360.dp).value - 96f) / 6.35f / LocalDensity.current.fontScale).sp
        // The two modes split the space below the header: Journey the top half, Worlds the bottom half.
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 14.dp)) {
            // These two shortcuts have physical left/right positions even in RTL layouts.
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Box(Modifier.fillMaxWidth().heightIn(min = 48.dp), contentAlignment = Alignment.Center) {
                    HomeIconButton("Options", Modifier.align(Alignment.CenterStart), { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                    Label("INSIGHT", titleSize, Modifier.padding(horizontal = 48.dp).semantics { heading() }, color = p.accent, weight = FontWeight.SemiBold, spacing = .3.em, align = TextAlign.Center, lines = 1)
                    HomeIconButton("Profile", Modifier.align(Alignment.CenterEnd), { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
                }
            }
            MenuButton("Journey", Modifier.weight(1f), fontSize = 30.sp, weight = FontWeight.ExtraBold, raised = true, cue = Cue.FORWARD) { m.startJourney() }
            MenuButton("Worlds", Modifier.weight(1f), fontSize = 30.sp, weight = FontWeight.ExtraBold, raised = true, cue = Cue.FORWARD) { m.openOnline(Route.Online) }
        }
    }
}

/** Line art that moves with its button: [draw] gets how far the button is pressed (0..1). [stays] keeps it at 1 after a tap, while the screen it opens comes up. */
class AnimatedIcon(val stays: Boolean, val draw: DrawScope.(Color, Float) -> Unit)

/** Small raised plush button with line art: it sinks when touched; a border shows only while keyboard-focused. */
@Composable
fun HomeIconButton(label: String, modifier: Modifier, onClick: () -> Unit, icon: DrawScope.(Color) -> Unit, cue: Cue?, enabled: Boolean = true) =
    PlushIconButton(label, modifier, onClick, cue, enabled, false) { c, _ -> icon(c) }

/** The same button with icon art that animates as it is pressed (Options' knobs swap sides, Profile's head bobs). */
@Composable
fun HomeIconButton(label: String, modifier: Modifier, onClick: () -> Unit, icon: AnimatedIcon, cue: Cue?, enabled: Boolean = true) =
    PlushIconButton(label, modifier, onClick, cue, enabled, icon.stays, icon.draw)

@Composable
private fun PlushIconButton(label: String, modifier: Modifier, onClick: () -> Unit, cue: Cue?, enabled: Boolean, stays: Boolean, icon: DrawScope.(Color, Float) -> Unit) {
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
    Box(modifier.size(48.dp).padding(2.dp)
        .plush(shape, press, p.paper2, if (focused) p.accent else p.line, rest = 4.dp)
        .clickable(enabled = enabled, interactionSource = interactions, indication = null, role = Role.Button, onClickLabel = label) { tapped = true; feedback(cue); onClick() }
        .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(20.dp)) { icon(p.ink, if (stays) art else press) }
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
/** Players: two people, the one behind smaller. */
val peopleIcon: DrawScope.(Color) -> Unit = { c ->
    val u = size.width / 24f
    val line = Stroke(1.7f * u, cap = StrokeCap.Round)
    drawCircle(c, 3f * u, Offset(9 * u, 8.5f * u), style = line)
    drawArc(c, 180f, 180f, false, Offset(3 * u, 14 * u), Size(12 * u, 12 * u), style = line)
    drawCircle(c, 2.5f * u, Offset(16.5f * u, 9 * u), style = line)
    drawArc(c, 270f, 90f, false, Offset(11.5f * u, 15 * u), Size(10 * u, 10 * u), style = line)
}
/** Puzzles: four outlined squares, in the same margins as the other icons. */
val gridIcon: DrawScope.(Color) -> Unit = { c ->
    val u = size.width / 24f
    for (r in 0..1) for (col in 0..1) drawRoundRect(c, Offset((4.5f + col * 8.5f) * u, (4.5f + r * 8.5f) * u), Size(6.5f * u, 6.5f * u), CornerRadius(1.6f * u), style = Stroke(1.7f * u))
}
/** Log out: an open door bracket with an arrow leaving it. */
val logoutIcon: DrawScope.(Color) -> Unit = { c ->
    stroke(c, path { u -> moveTo(10 * u, 4 * u); lineTo(5 * u, 4 * u); lineTo(5 * u, 20 * u); lineTo(10 * u, 20 * u)
        moveTo(11 * u, 12 * u); lineTo(20 * u, 12 * u); moveTo(16.5f * u, 8.5f * u); lineTo(20 * u, 12 * u); lineTo(16.5f * u, 15.5f * u) })
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
    var showLicences by remember { mutableStateOf(false) }
    val p = LocalPalette.current
    val context = LocalContext.current
    val feedback = LocalFeedback.current
    BackHandler(enabled = showLicences) { feedback(Cue.BACK); showLicences = false }
    Box(Modifier.fillMaxSize()) {
        Page("Options", 520.dp) {
            Tabs(tabs, tab) { tab = it }
            if (tab == "rulebook") RulebookTab(m)
            else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (tab) {
                    "options" -> {
                        ToggleRow("Haptics", m.haptics) { m.toggleHaptics() }
                        ToggleRow("Sound", m.sound) { m.toggleSound() }
                        VolumeSlider("Ambience", m.ambience) { m.changeAmbience(it) }
                        VolumeSlider("Effects", m.effects) { m.changeEffects(it) }
                        Label("Theme", 14.sp, weight = FontWeight.SemiBold)
                        Tabs(listOf("light" to "Light", "dark" to "Dark"), m.theme, Cue.CHECK) { m.changeTheme(it) }
                        ToggleRow("Colourblind mode", m.colorblind) { m.toggleColorblind() }
                    }
                    else -> {
                        // Both open a page to write in; Send mails it to the team.
                        InfoRow("Share feedback", "", onClick = { m.push(Route.Feedback("feedback")) })
                        InfoRow("Report a bug", "", onClick = { m.push(Route.Feedback("bug")) })
                        val info = remember { context.packageManager.getPackageInfo(context.packageName, 0) }
                        InfoRow("Version", "${info.versionName} (${androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(info)})")
                        InfoRow("Open-source licences", "Fonts", onClick = { showLicences = true })
                        if (AppLinks.PRIVACY_URL.isNotEmpty()) InfoRow("Privacy policy", "Open", onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppLinks.PRIVACY_URL))) })
                        if (AppLinks.CONTACT_EMAIL.isNotEmpty()) InfoRow("Contact", AppLinks.CONTACT_EMAIL, onClick = { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:${AppLinks.CONTACT_EMAIL}"))) })

                        if (BuildConfig.DEBUG) ToggleRow("Developer mode", m.dev) { m.toggleDev() }
                    }
                }
            }
        }
        if (showLicences) Overlay("Open-source licences", { showLicences = false }) {
            Label("Open-source licences", 22.sp, Modifier.semantics { heading() }, serif = true, align = TextAlign.Center)
            val texts = remember { listOf("JetBrains Mono" to "licenses/jetbrains-mono-OFL.txt", "Source Serif 4" to "licenses/source-serif-4-OFL.txt").map { (name, path) -> name to context.assets.open(path).bufferedReader().use { it.readText() } } }
            Column(Modifier.padding(vertical = 12.dp).heightIn(max = 380.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for ((name, text) in texts) { Label(name, 14.sp, weight = FontWeight.SemiBold); Label(text.trim(), 11.sp, color = p.muted) }
            }
            MenuButton("Close", primary = true) { showLicences = false }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VolumeSlider(label: String, value: Float, onChange: (Float) -> Unit) {
    val p = LocalPalette.current
    val source = remember { MutableInteractionSource() }
    val feedback by androidx.compose.runtime.rememberUpdatedState(LocalFeedback.current)
    val colors = SliderDefaults.colors(thumbColor = p.accent, activeTrackColor = p.accent, inactiveTrackColor = p.muted.copy(alpha = .35f))
    Column {
        Row { Label(label, 13.sp, weight = FontWeight.SemiBold); Spacer(Modifier.weight(1f)); Label("${(value * 100).toInt()}%", 13.sp, color = p.muted) }
        // A round thumb and a plain track: no stock-Material bar thumb or end-stop dot.
        Slider(value, onChange, interactionSource = source, colors = colors,
            thumb = { SliderDefaults.Thumb(source, colors = colors, thumbSize = DpSize(24.dp, 24.dp)) },
            track = { state -> SliderDefaults.Track(state, colors = colors, drawStopIndicator = null, thumbTrackGapSize = 0.dp) },
            // One swipe cue per touch, wherever it lands on the slider (track or thumb), seen before the slider takes it.
            modifier = Modifier.pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial); feedback(Cue.SWIPE)
                }
            }.semantics { contentDescription = "$label volume" })
    }
}

@Composable
fun AchievementsScreen(m: GameModel) {
    val p = LocalPalette.current
    val badges = m.achievements.catalog
    val account = m.online.user?.id
    LaunchedEffect(account) { if (account != null) m.online.refreshProgress() }
    Page("Achievements") {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (badge in badges) {
                    val earned = badge.id in m.earned; val progress = m.achievements.progress(badge, m.done, m.onlineStats)
                    val shape = RoundedCornerShape(16.dp)
                    Row(Modifier.fillMaxWidth().clip(shape).background(if (earned) lerp(p.paper2, p.accent, .14f) else p.paper).border(1.dp, if (earned) p.accent else p.line, shape).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            if (earned) Eyebrow("Earned")
                            Label(badge.name, 15.sp, weight = FontWeight.SemiBold)
                            Label(badge.requirement, 12.sp, color = p.muted)
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

/** The result: two text-free bars along the bottom (restart left, next right), in the page colours, with the solved board still visible above. GameScreen animates it in. */
@Composable
fun WinPopup(m: GameModel) {
    val final = m.level == m.levels.size - 1
    val casual = m.community?.casual == true
    val nextEnabled = if (casual) !m.online.busy else if (m.community != null || final) true else m.canAccess(m.level + 1)
    val p = LocalPalette.current
    val ink = p.ink
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, bottom = 24.dp)
            .semantics { paneTitle = "Grid solved"; liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        m.winBadges.firstOrNull()?.let { badge ->
            Label(badge.name, 12.sp, Modifier.heightIn(min = 32.dp).clip(shape).background(p.paper2).border(1.dp, p.line, shape)
                .clickable(role = Role.Button, onClickLabel = "Open achievements") { m.feedback(Cue.CHECK); m.push(Route.Achievements) }
                .semantics { contentDescription = "Achievement earned: ${badge.name}" }.padding(horizontal = 14.dp, vertical = 8.dp),
                color = ink, weight = FontWeight.SemiBold)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            WinButton("Restart level", Modifier.weight(1f), true, { m.restart() }) { restartIcon(ink) }
            WinButton("Next level", Modifier.weight(1f), nextEnabled, { m.next() }) { polyline(ink, 4f, 12f, 20f, 12f); polyline(ink, 14f, 6f, 20f, 12f); polyline(ink, 14f, 18f, 20f, 12f) }
        }
    }
}

@Composable
private fun WinButton(label: String, modifier: Modifier, enabled: Boolean, onClick: () -> Unit, icon: DrawScope.() -> Unit) {
    val feedback = LocalFeedback.current
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    Box(modifier.height(64.dp).alpha(if (enabled) 1f else .4f).clip(shape).background(p.paper2).border(1.dp, p.line, shape)
        .then(if (enabled) Modifier.clickable(role = Role.Button, onClickLabel = label) { feedback(Cue.PRESS); onClick() } else Modifier.semantics { disabled() })
        .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(28.dp)) { icon() }
    }
}
