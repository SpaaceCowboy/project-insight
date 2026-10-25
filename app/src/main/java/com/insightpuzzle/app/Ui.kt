package com.insightpuzzle.app

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlin.math.max

/** True when the system "remove animations" setting is on; infinite decorative animations stop. */
val LocalReduceMotion = staticCompositionLocalOf { false }

// Bundled in res/font (OFL, licences in assets/licenses). Serif is regular only, per DESIGN.md.
private val Mono = FontFamily(Font(R.font.jetbrains_mono_regular, FontWeight.Normal), Font(R.font.jetbrains_mono_semibold, FontWeight.SemiBold),
    Font(R.font.jetbrains_mono_bold, FontWeight.Bold), Font(R.font.jetbrains_mono_extrabold, FontWeight.ExtraBold))
private val Serif = FontFamily(Font(R.font.source_serif_4_regular, FontWeight.Normal))

@Composable fun Label(text: String, size: TextUnit, modifier: Modifier = Modifier, color: Color = LocalPalette.current.ink, weight: FontWeight = FontWeight.Normal, spacing: TextUnit = 0.sp, serif: Boolean = false, align: TextAlign? = null, lines: Int = Int.MAX_VALUE) =
    Text(text, modifier, color = color, fontSize = size, fontWeight = weight, letterSpacing = spacing, fontFamily = if (serif) Serif else Mono, textAlign = align, maxLines = lines, overflow = TextOverflow.Ellipsis, lineHeight = size * 1.2f)

@Composable fun Eyebrow(text: String, modifier: Modifier = Modifier) = Label(text.uppercase(), 11.sp, modifier, LocalPalette.current.muted, FontWeight.Bold, .16.em)

/** App background: base gradient, two glows, and two slow ambient lights tinted by the last moved tile (src/styles.css). */
@Composable
fun Backdrop(light: Color, content: @Composable BoxScope.() -> Unit) {
    val p = LocalPalette.current
    val b = backdrop(p.dark)
    val tint by animateColorAsState(light, tween(1600), label = "light")
    val reduce = LocalReduceMotion.current
    val drift = rememberInfiniteTransition(label = "drift")
    val t1 by drift.animateFloat(0f, 1f, infiniteRepeatable(tween(42_000, easing = LinearEasing), RepeatMode.Reverse), label = "t1")
    val t2 by drift.animateFloat(1f, 0f, infiniteRepeatable(tween(57_000, easing = LinearEasing), RepeatMode.Reverse), label = "t2")
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().drawWithCache {
            // Brushes are built once per size / tint / mode, not on every drift frame.
            val w = size.width; val h = size.height; val m = max(w, h); val r = m * .85f / 2
            val base = Brush.linearGradient(b.base, Offset(w * .35f, 0f), Offset(w * .65f, h))
            val g1 = Brush.radialGradient(listOf(b.glow1, Color.Transparent), Offset(w * .18f, h * .08f), m * .65f)
            val g2 = Brush.radialGradient(listOf(b.glow2, Color.Transparent), Offset(w * .86f, h * .75f), m * .6f)
            val light1 = Brush.radialGradient(listOf(lerp(tint, Color.White, .5f), tint.copy(alpha = .65f), Color.Transparent), Offset.Zero, r)
            val light2 = Brush.radialGradient(listOf(lerp(tint, Color(0xFF30344B), .35f), Color.Transparent), Offset.Zero, r)
            onDrawBehind {
                drawRect(base); drawRect(g1); drawRect(g2)
                val a = if (reduce) .5f else t1; val c = if (reduce) .5f else t2
                translate(-w * .1f + a * w * .25f, -h * .02f + a * h * .08f) { drawCircle(light1, r, Offset.Zero, alpha = .2f) }
                translate(w * 1.1f - c * w * .25f, h * 1.02f - c * h * .08f) { drawCircle(light2, r, Offset.Zero, alpha = .16f) }
            }
        })
        content()
    }
}

/** How far a raised button is pushed in: 0 at rest, 1 fully down. It springs back with a little give; [hold] keeps it down (for example while its screen opens). */
@Composable
fun pressProgress(source: androidx.compose.foundation.interaction.InteractionSource, hold: Boolean = false): Float {
    val pressed by source.collectIsPressedAsState()
    val reduce = LocalReduceMotion.current
    val value by androidx.compose.animation.core.animateFloatAsState(if (pressed || hold) 1f else 0f,
        if (reduce) androidx.compose.animation.core.snap() else androidx.compose.animation.core.spring(dampingRatio = .55f, stiffness = 700f), label = "press")
    return value
}

/**
 * A minimal raised "plush" face: a soft shadow under it, a faint light top and darker bottom edge. At [press] 1 it sinks
 * about 3dp, its shadow nearly disappears and it shrinks a hair, like a soft key pushed down.
 */
@Composable
fun Modifier.plush(shape: androidx.compose.ui.graphics.Shape, press: Float, face: Color, edge: Color, rest: Dp = 6.dp): Modifier {
    val p = LocalPalette.current
    val shade = Color.Black.copy(alpha = if (p.dark) .55f else .22f)
    return this
        .graphicsLayer { translationY = press * 3.dp.toPx(); val s = 1f - .03f * press; scaleX = s; scaleY = s }
        .shadow(rest - (rest - 1.dp) * press, shape, clip = false, ambientColor = shade, spotColor = shade)
        .clip(shape)
        .background(face)
        .drawWithContent {
            drawContent()
            // Light from above: a soft sheen at the top, a slightly darker lip at the bottom.
            drawRect(Brush.verticalGradient(0f to Color.White.copy(alpha = (if (p.dark) .07f else .5f) * (1f - .6f * press)), .45f to Color.Transparent,
                1f to Color.Black.copy(alpha = if (p.dark) .16f else .05f)))
        }
        .border(1.dp, edge, shape)
}

/** Rounded button with the web game's .menu-main-btn look. A null [onClick] means "not built yet": it is dimmed and labelled "Coming soon". */
@Composable
fun MenuButton(text: String, modifier: Modifier = Modifier, height: Dp = 48.dp, primary: Boolean = false, enabled: Boolean = true, fontSize: TextUnit = 14.sp, description: String? = null, subtitle: String? = null, cue: Cue? = Cue.PRESS,
               weight: FontWeight = FontWeight.SemiBold, raised: Boolean = false, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val soon = onClick == null
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    // A raised button shows its press by sinking, not by a ripple.
    val face = if (raised) Modifier.plush(shape, pressProgress(source), if (primary) p.accent else p.paper2, if (primary) p.accent else p.line)
        else Modifier.clip(shape).background(if (primary) p.accent else p.paper).border(2.dp, if (primary) p.accent else p.line, shape)
    Box(
        modifier.alpha(if (!enabled) .4f else if (soon) .6f else 1f).fillMaxWidth().heightIn(min = height).then(face)
            .then(if (onClick != null && enabled) Modifier.clickable(source, if (raised) null else androidx.compose.foundation.LocalIndication.current, role = Role.Button) { feedback(cue); onClick() }
                else Modifier.semantics { role = Role.Button; disabled(); if (soon) stateDescription = "Coming soon" })
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
            .padding(10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Label(text, fontSize, color = if (primary) p.accentInk else p.ink, weight = weight, spacing = .05.em, align = TextAlign.Center)
            val sub = subtitle ?: if (soon) "Coming soon" else null
            if (sub != null) Label(sub, 12.sp, Modifier.padding(top = 2.dp), color = if (primary) p.accentInk else p.muted, align = TextAlign.Center)
        }
    }
}

/** Small heading that groups rows on a settings page. */
@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) =
    Label(text, 13.sp, modifier.padding(top = 8.dp).semantics { heading() }, color = LocalPalette.current.muted, weight = FontWeight.SemiBold, spacing = .06.em)

/** A read-only row (label left, value right); with [onClick] it becomes a button that ends in an arrow. */
@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier, cue: Cue? = Cue.CHECK, arrow: Boolean = true, onClick: (() -> Unit)? = null) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(14.dp)
    BoxWithConstraints(
        modifier.fillMaxWidth().heightIn(min = 56.dp).clip(shape).background(p.paper).border(if (onClick != null) 2.dp else 1.dp, p.line, shape)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button) { feedback(cue); onClick() } else Modifier)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        val valueWidth = maxWidth / 2
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Label(label, 14.sp, Modifier.weight(1f), weight = FontWeight.SemiBold, spacing = .03.em)
        Label(if (onClick != null && arrow) "$value →" else value, 14.sp, Modifier.widthIn(max = valueWidth), color = p.muted, align = TextAlign.End)
        }
    }
}

/** A labelled on/off row (Sound, Dark mode, ...): the state is a switch, never a button that says "ON". */
@Composable
fun ToggleRow(label: String, checked: Boolean, modifier: Modifier = Modifier, onChange: (Boolean) -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).clip(shape).background(p.paper).border(if (checked) 3.dp else 2.dp, p.line, shape)
            .toggleable(checked, role = Role.Switch) { on ->
                // The off cue plays before the change, so turning Sound off is still heard.
                if (!on) feedback(Cue.TOGGLE_OFF); onChange(on); if (on) feedback(Cue.TOGGLE_ON)
            }.padding(start = 16.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Label(label, 14.sp, Modifier.weight(1f), weight = FontWeight.SemiBold, spacing = .03.em)
        Switch(checked, null, colors = SwitchDefaults.colors(
            checkedThumbColor = p.accentInk, checkedTrackColor = p.accent, checkedBorderColor = p.accent,
            uncheckedThumbColor = p.muted, uncheckedTrackColor = Color.Transparent, uncheckedBorderColor = p.muted,
        ))
    }
}

/** Round icon button (Back, corner Menu/Restart). */
@Composable
fun RoundButton(description: String, modifier: Modifier = Modifier, onClick: () -> Unit, icon: DrawScope.(Color) -> Unit) {
    val p = LocalPalette.current
    Box(modifier.size(48.dp).clip(CircleShape).background(p.paper2).border(2.dp, p.line, CircleShape)
        .clickable(role = Role.Button, onClickLabel = description, onClick = onClick).semantics { contentDescription = description }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(20.dp)) { icon(p.ink) }
    }
}

fun DrawScope.polyline(color: Color, vararg points: Float) {
    val u = size.width / 24f
    for (i in 0 until points.size - 2 step 2) drawLine(color, Offset(points[i] * u, points[i + 1] * u), Offset(points[i + 2] * u, points[i + 3] * u), 2 * u, StrokeCap.Round)
}
val menuIcon: DrawScope.(Color) -> Unit = { polyline(it, 4f, 7f, 20f, 7f); polyline(it, 4f, 12f, 20f, 12f); polyline(it, 4f, 17f, 20f, 17f) }
val restartIcon: DrawScope.(Color) -> Unit = {
    val u = size.width / 24f
    drawArc(it, 0f, 324f, false, Offset(4 * u, 4 * u), androidx.compose.ui.geometry.Size(16 * u, 16 * u), style = Stroke(2 * u, cap = StrokeCap.Round))
    polyline(it, 20f, 4f, 20f, 8.5f, 15.5f, 8.5f)
}

/** Full-screen page. There is no on-screen title or Back button (system Back leaves); [title] is only announced to TalkBack. */
@Composable
fun Page(title: String, maxWidth: Dp = 640.dp, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).semantics { paneTitle = title }, contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = maxWidth).fillMaxSize().padding(16.dp), content = content)
    }
}

/** Segmented tabs (Options, Achievements). */
@Composable
fun Tabs(options: List<Pair<String, String>>, selected: String, cue: Cue? = Cue.FOCUS, onSelect: (String) -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((id, label) in options) {
            val on = id == selected
            Box(Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(if (on) p.accent else p.paper).border(if (on) 3.dp else 2.dp, p.line, RoundedCornerShape(14.dp))
                .clickable(role = Role.Tab) { feedback(cue); onSelect(id) }.semantics { this.selected = on }, contentAlignment = Alignment.Center) {
                Label(label, 12.sp, color = if (on) p.accentInk else p.ink, weight = FontWeight.SemiBold)
            }
        }
    }
}

/** Dimmed layer with a centred card (pause menu). The scrim is hidden from TalkBack (Back closes it); the card announces [title]. */
@Composable
fun Overlay(title: String, onDismiss: () -> Unit, padding: Dp = 24.dp, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    // Back closes the overlay and stays on the screen underneath it.
    androidx.activity.compose.BackHandler { feedback(Cue.BACK); onDismiss() }
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(interactionSource = null, indication = null) { feedback(null); onDismiss() }.clearAndSetSemantics { })
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
            Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(p.paper2).border(1.dp, p.line, RoundedCornerShape(28.dp))
                .pointerInput(Unit) { detectTapGestures { } }.semantics { paneTitle = title }.padding(padding), horizontalAlignment = Alignment.CenterHorizontally, content = content)
        }
    }
}

/**
 * Pull down to refresh: the content drops a little, a small spinner shows while [refreshing], then it all springs back.
 * Replaces Retry / Refresh buttons on online screens. The content must scroll (a LazyColumn or verticalScroll).
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun Refreshable(refreshing: Boolean, onRefresh: () -> Unit, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val p = LocalPalette.current
    val state = androidx.compose.material3.pulltorefresh.rememberPullToRefreshState()
    androidx.compose.material3.pulltorefresh.PullToRefreshBox(refreshing, onRefresh, modifier.semantics {
        customActions = if (refreshing) emptyList() else listOf(CustomAccessibilityAction("Refresh") { onRefresh(); true })
    }, state = state, indicator = {
        // A plain ring, no arrow head: it fills while pulling and spins while refreshing.
        androidx.compose.material3.pulltorefresh.PullToRefreshDefaults.IndicatorBox(state = state, isRefreshing = refreshing, modifier = Modifier.align(Alignment.TopCenter), containerColor = p.paper2) {
            if (refreshing) androidx.compose.material3.CircularProgressIndicator(Modifier.size(20.dp), color = p.accent, strokeWidth = 2.dp)
            else androidx.compose.material3.CircularProgressIndicator(progress = { state.distanceFraction.coerceIn(0f, 1f) }, modifier = Modifier.size(20.dp), color = p.accent, strokeWidth = 2.dp, trackColor = Color.Transparent)
        }
    }) {
        Box(Modifier.fillMaxSize().graphicsLayer { translationY = state.distanceFraction.coerceIn(0f, 1f) * 28.dp.toPx() }, content = content)
    }
}
