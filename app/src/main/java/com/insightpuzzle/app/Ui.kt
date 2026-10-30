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
import androidx.compose.ui.graphics.drawOutline
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
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
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

// Bundled in res/font (OFL, licence in assets/licenses). The one family for every text in the app.
internal val MonoFamily get() = Mono
private val Mono = FontFamily(Font(R.font.jetbrains_mono_regular, FontWeight.Normal), Font(R.font.jetbrains_mono_semibold, FontWeight.SemiBold),
    Font(R.font.jetbrains_mono_bold, FontWeight.Bold), Font(R.font.jetbrains_mono_extrabold, FontWeight.ExtraBold))

/** [translate] off for text that is not the app's own (a username, a licence): everything else goes through [tr]. */
@Composable fun Label(text: String, size: TextUnit, modifier: Modifier = Modifier, color: Color = LocalPalette.current.ink, weight: FontWeight = FontWeight.Normal, spacing: TextUnit = 0.sp, align: TextAlign? = null, lines: Int = Int.MAX_VALUE, translate: Boolean = true) =
    Text(if (translate) tr(text) else text, modifier, color = color, fontSize = size, fontWeight = weight, letterSpacing = spacing, fontFamily = Mono, textAlign = align, maxLines = lines, overflow = TextOverflow.Ellipsis, lineHeight = size * 1.2f)

/** [Label] for styled text, such as a word in a tile's colour. */
@Composable fun Label(text: androidx.compose.ui.text.AnnotatedString, size: TextUnit, modifier: Modifier = Modifier, color: Color = LocalPalette.current.ink, weight: FontWeight = FontWeight.Normal, lineHeight: Float = 1.2f) =
    Text(text, modifier, color = color, fontSize = size, fontWeight = weight, fontFamily = Mono, overflow = TextOverflow.Ellipsis, lineHeight = size * lineHeight)

/** Space between a screen's top icon row and what comes under it (Home: icons to Journey). */
val ScreenGap = 14.dp

@Composable fun Eyebrow(text: String, modifier: Modifier = Modifier) = Label(tr(text).uppercase(), 11.sp, modifier, LocalPalette.current.muted, FontWeight.Bold, .16.em, translate = false)

/** App background: one matte dark (or light) grey, a hair lighter towards the bottom right. No glows, no moving lights. */
@Composable
fun Backdrop(content: @Composable BoxScope.() -> Unit) {
    val p = LocalPalette.current
    val colors = backdrop(p.dark)
    Box(Modifier.fillMaxSize().drawWithCache {
        val brush = Brush.linearGradient(colors, Offset.Zero, Offset(size.width, size.height))
        onDrawBehind { drawRect(brush) }
    }, content = content)
}

private const val PRESS_IN_MS = 45
private const val PRESS_MIN_MS = 90L

/**
 * How far a raised button is pushed in: 0 at rest, 1 fully down. It goes down fast the moment it is touched and, even for a very quick tap,
 * stays down for a beat ([PRESS_MIN_MS]) before it springs back with a little give. [hold] keeps it down (for example while its screen opens).
 */
@Composable
fun pressProgress(source: androidx.compose.foundation.interaction.InteractionSource, hold: Boolean = false): Float {
    val pressed by source.collectIsPressedAsState()
    val reduce = LocalReduceMotion.current
    val on = pressed || hold
    val value = remember { androidx.compose.animation.core.Animatable(if (hold) 1f else 0f) }
    val since = remember { longArrayOf(0L) }
    androidx.compose.runtime.LaunchedEffect(on, reduce) {
        if (on) {
            since[0] = System.nanoTime()
            if (reduce) value.snapTo(1f) else value.animateTo(1f, tween(PRESS_IN_MS, easing = androidx.compose.animation.core.LinearOutSlowInEasing))
        } else if (reduce) value.snapTo(0f)
        else {
            val left = PRESS_MIN_MS - (System.nanoTime() - since[0]) / 1_000_000
            if (value.value > 0f && left > 0) kotlinx.coroutines.delay(left)
            value.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = .55f, stiffness = 700f))
        }
    }
    return value.value
}

/**
 * Reports a touch to [source] the moment the finger lands. [clickable] inside a scrolling list or pager waits ~100 ms before it calls
 * something a press (it might be a scroll), which made those buttons look slow; this does not consume anything and cancels when the touch scrolls away.
 */
fun Modifier.pressOnTouch(source: MutableInteractionSource): Modifier = pointerInput(source) {
    awaitEachGesture {
        // A touch the app refused (a second finger, or one too soon after a screen change; see singleTouch) never sinks the key.
        val down = awaitFirstDown(requireUnconsumed = true, pass = PointerEventPass.Initial)
        val press = PressInteraction.Press(down.position)
        source.tryEmit(press)
        var released = false
        try {
            while (true) {
                val change = awaitPointerEvent(PointerEventPass.Final).changes.firstOrNull { it.id == down.id } ?: break
                if (change.changedToUpIgnoreConsumed()) { source.tryEmit(PressInteraction.Release(press)); released = true; break }
                if ((change.previousPressed && change.isConsumed) || change.position.x !in 0f..size.width.toFloat() || change.position.y !in 0f..size.height.toFloat()) break
            }
        } finally {
            if (!released) source.tryEmit(PressInteraction.Cancel(press))
        }
    }
}

/**
 * A raised "plush" key: a soft shadow on the background, a slightly darker side showing under the face, no border. At [press] 1
 * the face sinks onto its side, the shadow nearly disappears and it shrinks a hair, like a soft key pushed down.
 */
@Composable
fun Modifier.plush(shape: androidx.compose.ui.graphics.Shape, press: Float, face: Color, rest: Dp = 6.dp, depth: Dp = 3.dp, side: Color = LocalPalette.current.side, sheen: Boolean = true,
                   travel: Float = 1f, sideLight: Float = 0f, sideLightColor: Color? = null): Modifier {
    val p = LocalPalette.current
    val shade = Color.Black.copy(alpha = if (p.dark) .6f else .26f)
    // [sideLight] lights the side wall (hold to restart, the current level) towards [sideLightColor] (the ink colour by default); [travel] is how much of the wall the face may sink onto.
    val wall = if (sideLight > 0f) lerp(side, sideLightColor ?: p.shellInk, sideLight.coerceIn(0f, 1f)) else side
    return this
        .graphicsLayer { val s = 1f - .03f * press; scaleX = s; scaleY = s }
        .shadow(rest - (rest - 1.dp) * press, shape, clip = false, ambientColor = shade, spotColor = shade)
        .drawBehind {
            // The side: the same shape fixed a little lower; the face covers more of it as it sinks onto it.
            val outline = shape.createOutline(size, layoutDirection, this)
            translate(0f, depth.toPx()) { drawOutline(outline, wall) }
        }
        .graphicsLayer { translationY = press * travel * depth.toPx() }
        .clip(shape)
        .background(face)
        .drawWithContent {
            // Light from above, kept very faint so the face stays matte. With [sheen] off it lies under the content (a platform with tiles on it).
            if (!sheen) drawRect(Brush.verticalGradient(0f to Color.White.copy(alpha = (if (p.dark) .035f else .35f) * (1f - press)), .5f to Color.Transparent))
            drawContent()
            if (sheen) drawRect(Brush.verticalGradient(0f to Color.White.copy(alpha = (if (p.dark) .035f else .35f) * (1f - press)), .5f to Color.Transparent))
        }
}

/** The side wall that goes with a tinted [face]: it keeps the same darkness relative to the face as an untinted key's wall has. */
@Composable
fun sideFor(face: Color): Color {
    val p = LocalPalette.current
    fun k(wall: Float, base: Float) = if (base > 0f) wall / base else 1f
    return Color((face.red * k(p.side.red, p.paper2.red)).coerceIn(0f, 1f), (face.green * k(p.side.green, p.paper2.green)).coerceIn(0f, 1f),
        (face.blue * k(p.side.blue, p.paper2.blue)).coerceIn(0f, 1f), face.alpha)
}

/** Rounded button with the web game's .menu-main-btn look. A null [onClick] means "not built yet": it is dimmed and labelled "Coming soon". */
@Composable
fun MenuButton(text: String, modifier: Modifier = Modifier, height: Dp = 48.dp, primary: Boolean = false, enabled: Boolean = true, fontSize: TextUnit = 14.sp, description: String? = null, subtitle: String? = null, cue: Cue? = Cue.PRESS,
               weight: FontWeight = FontWeight.SemiBold, raised: Boolean = true, depth: Dp = 3.dp, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val soon = onClick == null
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    // A raised button shows its press by sinking, not by a ripple.
    val face = if (raised) Modifier.plush(shape, pressProgress(source), if (primary) p.accent else p.paper2, depth = depth)
        else Modifier.clip(shape).background(if (primary) p.accent else p.paper).border(2.dp, if (primary) p.accent else p.line, shape)
    Box(
        modifier.alpha(if (!enabled) .4f else if (soon) .6f else 1f).fillMaxWidth().heightIn(min = height).then(face)
            .then(if (onClick != null && enabled) Modifier.then(if (raised) Modifier.pressOnTouch(source) else Modifier).clickable(source, if (raised) null else androidx.compose.foundation.LocalIndication.current, role = Role.Button) { feedback(cue); onClick() }
                else Modifier.semantics { role = Role.Button; disabled(); if (soon) stateDescription = tr("Coming soon") })
            .then(if (description != null) Modifier.semantics { contentDescription = tr(description) } else Modifier)
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

/** A read-only row (label left, value right); with [onClick] it becomes a button. An [icon] sits at the right end. */
@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier, cue: Cue? = Cue.CHECK, icon: (DrawScope.(Color) -> Unit)? = null, pressable: Boolean = false, onClick: (() -> Unit)? = null) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    // A row with no action only sinks when pressed (no sound, no button role); one with an action is a button.
    BoxWithConstraints(
        modifier.fillMaxWidth().heightIn(min = 56.dp).plush(shape, if (onClick != null || pressable) pressProgress(source) else 0f, p.paper2)
            .then(if (onClick != null) Modifier.pressOnTouch(source).clickable(source, null, role = Role.Button) { feedback(cue); onClick() }
                else if (pressable) Modifier.pressOnTouch(source).clickable(source, null) {} else Modifier)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        val valueWidth = maxWidth / 2
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Label(label, 14.sp, Modifier.weight(1f), weight = FontWeight.SemiBold, spacing = .03.em)
        if (value.isNotEmpty()) Label(value, 14.sp, Modifier.widthIn(max = valueWidth), color = p.muted, align = TextAlign.End)
        if (icon != null) Canvas(Modifier.size(20.dp)) { icon(p.muted) }
        }
    }
}

/** A labelled on/off row (Sound, Dark mode, ...): the state is a switch, never a button that says "ON". */
@Composable
fun ToggleRow(label: String, checked: Boolean, modifier: Modifier = Modifier, onChange: (Boolean) -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).plush(shape, pressProgress(source), p.paper2)
            .pressOnTouch(source)
            .toggleable(checked, source, null, role = Role.Switch) { on ->
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
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).semantics { paneTitle = tr(title) }, contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = maxWidth).fillMaxSize().padding(16.dp), content = content)
    }
}

private object FillRestTag
private object FillRestModifier : androidx.compose.ui.layout.ParentDataModifier {
    override fun androidx.compose.ui.unit.Density.modifyParentData(parentData: Any?): Any = FillRestTag
}

/** In a [FillColumn]: this child takes whatever height the others leave, but never less than its own natural height. */
fun Modifier.fillRest(): Modifier = this.then(FillRestModifier)

/**
 * A column that stretches to the height it is given (a scroll area's viewport) by growing its one [fillRest] child, so the content ends exactly at the bottom.
 * When the content is taller than the viewport nothing stretches and the column simply scrolls. Children are as wide as the column and [gap] apart.
 */
@Composable
fun FillColumn(modifier: Modifier = Modifier, gap: Dp = 12.dp, content: @Composable () -> Unit) {
    androidx.compose.ui.layout.Layout(content, modifier) { measurables, constraints ->
        val width = constraints.maxWidth
        val gapPx = gap.roundToPx()
        val loose = androidx.compose.ui.unit.Constraints(minWidth = width, maxWidth = width, minHeight = 0, maxHeight = constraints.maxHeight)
        val fill = measurables.indexOfFirst { it.parentData === FillRestTag }
        val placeables = arrayOfNulls<androidx.compose.ui.layout.Placeable>(measurables.size)
        var used = gapPx * (measurables.size - 1).coerceAtLeast(0)
        measurables.forEachIndexed { i, child -> if (i != fill) { val placeable = child.measure(loose); placeables[i] = placeable; used += placeable.height } }
        if (fill >= 0) {
            val child = measurables[fill]
            val height = max(child.minIntrinsicHeight(width), constraints.minHeight - used)
            placeables[fill] = child.measure(androidx.compose.ui.unit.Constraints(minWidth = width, maxWidth = width, minHeight = height, maxHeight = height))
            used += placeables[fill]!!.height
        }
        layout(width, max(used, constraints.minHeight)) {
            var y = 0
            placeables.forEach { placeable -> if (placeable != null) { placeable.placeRelative(0, y); y += placeable.height + gapPx } }
        }
    }
}

/** Segmented tabs (Options, Achievements). */
@Composable
fun Tabs(options: List<Pair<String, String>>, selected: String, cue: Cue? = Cue.FOCUS, modifier: Modifier = Modifier, labelSize: TextUnit = 12.sp, bottom: Dp = 14.dp, onSelect: (String) -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    Row(modifier.fillMaxWidth().padding(bottom = bottom), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((id, label) in options) {
            val on = id == selected
            val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
            // The chosen tab stays pushed in.
            Box(Modifier.weight(1f).heightIn(min = 48.dp).plush(RoundedCornerShape(14.dp), pressProgress(source, hold = on), if (on) p.accent else p.paper2, rest = 4.dp)
                .pressOnTouch(source).clickable(source, null, role = Role.Tab) { if (!on) { feedback(cue); onSelect(id) } }.semantics { this.selected = on }, contentAlignment = Alignment.Center) {
                Label(label, labelSize, color = if (on) p.accentInk else p.ink, weight = FontWeight.SemiBold, lines = 1)
            }
        }
    }
}

/** Dimmed layer with a centred card (pause menu). The scrim is hidden from TalkBack (Back closes it); the card announces [title]. */
@Composable
fun Overlay(title: String, onDismiss: () -> Unit, padding: Dp = 24.dp, maxWidth: Dp = 420.dp, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    // Back closes the overlay and stays on the screen underneath it.
    androidx.activity.compose.BackHandler { feedback(Cue.BACK); onDismiss() }
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(interactionSource = null, indication = null) { feedback(null); onDismiss() }.clearAndSetSemantics { })
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
            Column(Modifier.widthIn(max = maxWidth).fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(p.paper2).border(1.dp, p.line, RoundedCornerShape(28.dp))
                .pointerInput(Unit) { detectTapGestures { } }.semantics { paneTitle = tr(title) }.padding(padding), horizontalAlignment = Alignment.CenterHorizontally, content = content)
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
        customActions = if (refreshing) emptyList() else listOf(CustomAccessibilityAction(tr("Refresh")) { onRefresh(); true })
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
