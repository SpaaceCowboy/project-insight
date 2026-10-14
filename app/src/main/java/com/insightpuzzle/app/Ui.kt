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
import androidx.compose.ui.draw.clip
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
private val Sans = FontFamily(Font(R.font.source_sans_3_regular, FontWeight.Normal), Font(R.font.source_sans_3_semibold, FontWeight.SemiBold), Font(R.font.source_sans_3_bold, FontWeight.Bold))
private val Serif = FontFamily(Font(R.font.source_serif_4_regular, FontWeight.Normal))

@Composable fun Label(text: String, size: TextUnit, modifier: Modifier = Modifier, color: Color = LocalPalette.current.ink, weight: FontWeight = FontWeight.Normal, spacing: TextUnit = 0.sp, serif: Boolean = false, align: TextAlign? = null, lines: Int = Int.MAX_VALUE) =
    Text(text, modifier, color = color, fontSize = size, fontWeight = weight, letterSpacing = spacing, fontFamily = if (serif) Serif else Sans, textAlign = align, maxLines = lines, overflow = TextOverflow.Ellipsis, lineHeight = size * 1.2f)

@Composable fun Eyebrow(text: String, modifier: Modifier = Modifier) = Label(text.uppercase(), 11.sp, modifier, LocalPalette.current.muted, FontWeight.Bold, .16.em)

/** App background: base gradient, two glows, and two slow ambient lights tinted by the last moved tile (src/styles.css). */
@Composable
fun Backdrop(background: String, light: Color, animated: Boolean = true, content: @Composable BoxScope.() -> Unit) {
    val p = LocalPalette.current
    val b = backdrop(background, p.dark)
    val tint by animateColorAsState(light, tween(1600), label = "light")
    val reduce = LocalReduceMotion.current || !animated
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

/**
 * A crystal glow for the one button that leads somewhere special (Online): a slow pulsing halo, a prismatic edge
 * (coral → violet → ice, the tile hues) and a glint that crosses the face every few seconds. It stays still,
 * at its mid brightness, when reduce motion is on.
 */
@Composable
fun Modifier.crystalGlow(cornerRadius: Dp = 14.dp): Modifier {
    val reduce = LocalReduceMotion.current
    val transition = rememberInfiniteTransition(label = "crystal")
    val pulse by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(3600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "pulse")
    val glint by transition.animateFloat(0f, 1f, infiniteRepeatable(keyframes { durationMillis = 5400; 0f at 0 using LinearEasing; 1f at 1400; 1f at 5400 }), label = "glint")
    val level = if (reduce) .5f else pulse
    val prism = listOf(Art.LIGHT.getValue('R'), Art.LIGHT.getValue('P'), Art.LIGHT.getValue('B'))
    return this
        .drawBehind {
            val r = cornerRadius.toPx(); val brush = Brush.horizontalGradient(prism)
            for ((grow, alpha) in listOf(8.dp to .07f, 5.dp to .12f, 2.5.dp to .2f)) {
                val g = grow.toPx()
                drawRoundRect(brush, Offset(-g, -g), Size(size.width + 2 * g, size.height + 2 * g), CornerRadius(r + g), alpha = alpha * (.55f + .9f * level))
            }
        }
        .drawWithContent {
            drawContent()
            val r = cornerRadius.toPx(); val w = size.width; val h = size.height
            drawRoundRect(Brush.horizontalGradient(prism), Offset.Zero, size, CornerRadius(r), style = Stroke(1.6.dp.toPx()), alpha = .55f + .4f * level)
            if (!reduce && glint in 0.001f..0.999f) {
                val x = -w * .3f + w * 1.6f * glint
                clipPath(androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, w, h, CornerRadius(r))) }) {
                    drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = .38f), Color.Transparent), Offset(x, 0f), Offset(x + w * .22f, h)))
                }
            }
        }
}

/** Rounded button with the web game's .menu-main-btn look. A null [onClick] means "not built yet": it is dimmed and labelled "Coming soon". */
@Composable
fun MenuButton(text: String, modifier: Modifier = Modifier, height: Dp = 48.dp, primary: Boolean = false, enabled: Boolean = true, fontSize: TextUnit = 14.sp, description: String? = null, subtitle: String? = null, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val soon = onClick == null
    val shape = RoundedCornerShape(14.dp)
    Box(
        modifier.alpha(if (!enabled) .4f else if (soon) .6f else 1f).fillMaxWidth().heightIn(min = height).clip(shape)
            .background(if (primary) p.accent else p.paper).border(1.dp, if (primary) p.accent else p.line, shape)
            .then(if (onClick != null && enabled) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier.semantics { role = Role.Button; disabled(); if (soon) stateDescription = "Coming soon" })
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
            .padding(10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Label(text, fontSize, color = if (primary) p.accentInk else p.ink, weight = FontWeight.SemiBold, spacing = .05.em, align = TextAlign.Center)
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
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).clip(shape).background(p.paper).border(1.dp, p.line, shape)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Label(label, 14.sp, Modifier.weight(1f), weight = FontWeight.SemiBold, spacing = .03.em)
        Label(if (onClick != null) "$value →" else value, 14.sp, color = p.muted, align = TextAlign.End)
    }
}

/** A labelled on/off row (Sound, Dark mode, ...): the state is a switch, never a button that says "ON". */
@Composable
fun ToggleRow(label: String, checked: Boolean, modifier: Modifier = Modifier, onChange: (Boolean) -> Unit) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).clip(shape).background(p.paper).border(1.dp, p.line, shape)
            .toggleable(checked, role = Role.Switch, onValueChange = onChange).padding(start = 16.dp, end = 12.dp),
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
    Box(modifier.size(48.dp).clip(CircleShape).background(p.paper2).border(1.dp, p.line, CircleShape)
        .clickable(role = Role.Button, onClickLabel = description, onClick = onClick).semantics { contentDescription = description }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(20.dp)) { icon(p.ink) }
    }
}

fun DrawScope.polyline(color: Color, vararg points: Float) {
    val u = size.width / 24f
    for (i in 0 until points.size - 2 step 2) drawLine(color, Offset(points[i] * u, points[i + 1] * u), Offset(points[i + 2] * u, points[i + 3] * u), 2 * u, StrokeCap.Round)
}
val backIcon: DrawScope.(Color) -> Unit = { polyline(it, 15f, 5f, 8f, 12f, 15f, 19f) }
val menuIcon: DrawScope.(Color) -> Unit = { polyline(it, 4f, 7f, 20f, 7f); polyline(it, 4f, 12f, 20f, 12f); polyline(it, 4f, 17f, 20f, 17f) }
val restartIcon: DrawScope.(Color) -> Unit = {
    val u = size.width / 24f
    drawArc(it, -40f, 300f, false, Offset(4 * u, 4 * u), androidx.compose.ui.geometry.Size(16 * u, 16 * u), style = Stroke(2 * u, cap = StrokeCap.Round))
    polyline(it, 20f, 4f, 20f, 8.5f, 15.5f, 8.5f)
}

/** Full-screen page with the round Back button and a title (the web game's .screen pages). */
@Composable
fun Page(title: String, subtitle: String?, onBack: () -> Unit, maxWidth: Dp = 640.dp, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = maxWidth).fillMaxSize().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 16.dp)) {
                RoundButton("Back", onClick = onBack, icon = backIcon)
                Spacer(Modifier.width(14.dp))
                Column {
                    Label(title, 24.sp, Modifier.semantics { heading() }, serif = true)
                    if (subtitle != null) Label(subtitle, 12.sp, color = LocalPalette.current.muted)
                }
            }
            content()
        }
    }
}

/** Segmented tabs (Options, Achievements). */
@Composable
fun Tabs(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((id, label) in options) {
            val on = id == selected
            Box(Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(if (on) p.accent else p.paper).border(1.dp, p.line, RoundedCornerShape(14.dp))
                .clickable(role = Role.Tab) { onSelect(id) }.semantics { this.selected = on }, contentAlignment = Alignment.Center) {
                Label(label, 12.sp, color = if (on) p.accentInk else p.ink, weight = FontWeight.SemiBold)
            }
        }
    }
}

/** Dimmed layer with a centred card (pause menu). The scrim is hidden from TalkBack (Back closes it); the card announces [title]. */
@Composable
fun Overlay(title: String, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Color(0x99031319)).clickable(interactionSource = null, indication = null, onClick = onDismiss).clearAndSetSemantics { })
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
            Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(p.paper2).border(1.dp, p.line, RoundedCornerShape(28.dp))
                .pointerInput(Unit) { detectTapGestures { } }.semantics { paneTitle = title }.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, content = content)
        }
    }
}
