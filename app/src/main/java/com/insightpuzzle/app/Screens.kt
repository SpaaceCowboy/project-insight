package com.insightpuzzle.app

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
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
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

@Composable
fun HomeScreen(m: GameModel) {
    val p = LocalPalette.current
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
        // Short phones (about 640dp tall) get a smaller hero and buttons so nothing touches.
        val compact = maxHeight < 640.dp
        val buttonHeight = if (compact) 56.dp else 64.dp
        Column(Modifier.widthIn(max = 360.dp).fillMaxHeight().heightIn(max = 760.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Label("INSIGHT", if (compact) 26.sp else 29.sp, color = p.accent, weight = FontWeight.SemiBold, spacing = .3.em)
            Label("A little order. A little wonder.", 16.sp, Modifier.padding(top = 8.dp), color = p.muted, serif = true)
            Hero(m.finish, Modifier.padding(top = if (compact) 12.dp else 20.dp, bottom = if (compact) 10.dp else 0.dp), if (compact) 96.dp else 125.dp)
            Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 14.dp, Alignment.CenterVertically)) {
                m.continueLevel?.let { next ->
                    MenuButton("Continue", height = buttonHeight, primary = true, fontSize = 17.sp, subtitle = "Level %03d · %s".format(next + 1, m.levels[next].name)) { m.start(next); m.audio.play("select") }
                }
                MenuButton("Single player", height = buttonHeight, fontSize = 17.sp) { m.push(Route.Worlds) }
                MenuButton("Online", height = buttonHeight, fontSize = 17.sp) { m.push(Route.Online) }
                MenuButton("Options", height = buttonHeight, fontSize = 17.sp) { m.push(Route.Options) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Cube("Achievements", trophyIcon, Modifier.weight(1f)) { m.push(Route.Achievements()) }
                Cube("Log In", personIcon, Modifier.weight(1f), null)
                Cube("What's Next", sparkIcon, Modifier.weight(1f), null)
            }
        }
    }
}

/** The tilted 3x3 of floating tiles on the home screen. */
@Composable
fun Hero(finish: String, modifier: Modifier = Modifier, size: Dp = 125.dp) {
    val reduce = LocalReduceMotion.current
    val float = rememberInfiniteTransition(label = "hero")
    val lift by float.animateFloat(0f, 1f, infiniteRepeatable(tween(7000), RepeatMode.Reverse), label = "lift")
    Canvas(modifier.size(size).rotate(-9f)) {
        val gap = size.toPx() * .056f; val cell = (this.size.width - 2 * gap) / 3
        "RBGPWYBGR".forEachIndexed { i, t ->
            val dy = if (reduce) 0f else -4.dp.toPx() * (if (i % 3 == 2) 1 - lift else lift)
            tile(t, Offset((i % 3) * (cell + gap), (i / 3) * (cell + gap) + dy), cell, finish)
        }
    }
}

/** Home shortcut tile. A null [onClick] is a feature that isn't built yet: dimmed, labelled "Soon", announced as coming soon. */
@Composable
private fun Cube(label: String, icon: DrawScope.(Color) -> Unit, modifier: Modifier, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    Column(
        modifier.alpha(if (onClick == null) .6f else 1f).aspectRatio(1f).clip(RoundedCornerShape(14.dp)).background(p.paper).border(1.dp, p.line, RoundedCornerShape(14.dp))
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier.semantics { role = Role.Button; disabled(); stateDescription = "Coming soon" }).padding(6.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Canvas(Modifier.size(26.dp)) { icon(p.ink) }
        Spacer(Modifier.height(7.dp))
        Label(label, 11.sp, weight = FontWeight.SemiBold, align = TextAlign.Center)
        if (onClick == null) Label("Soon", 11.sp, color = p.muted, align = TextAlign.Center)
    }
}

private fun DrawScope.stroke(color: Color, path: androidx.compose.ui.graphics.Path) =
    drawPath(path, color, style = Stroke(1.7f * size.width / 24f, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
private fun DrawScope.path(build: androidx.compose.ui.graphics.Path.(Float) -> Unit) = androidx.compose.ui.graphics.Path().apply { build(size.width / 24f) }
private val trophyIcon: DrawScope.(Color) -> Unit = { c ->
    stroke(c, path { u -> moveTo(8 * u, 4 * u); lineTo(16 * u, 4 * u); lineTo(16 * u, 9 * u); quadraticTo(16 * u, 13 * u, 12 * u, 13 * u); quadraticTo(8 * u, 13 * u, 8 * u, 9 * u); close()
        moveTo(8 * u, 6 * u); lineTo(4.5f * u, 6 * u); lineTo(4.5f * u, 7.5f * u); quadraticTo(4.5f * u, 10.5f * u, 8 * u, 10.5f * u)
        moveTo(16 * u, 6 * u); lineTo(19.5f * u, 6 * u); lineTo(19.5f * u, 7.5f * u); quadraticTo(19.5f * u, 10.5f * u, 16 * u, 10.5f * u)
        moveTo(12 * u, 13 * u); lineTo(12 * u, 17 * u); moveTo(8.5f * u, 20 * u); lineTo(15.5f * u, 20 * u); moveTo(10 * u, 17 * u); lineTo(14 * u, 17 * u) })
}
private val personIcon: DrawScope.(Color) -> Unit = { c ->
    val u = size.width / 24f
    drawCircle(c, 3.5f * u, Offset(12 * u, 8.5f * u), style = Stroke(1.7f * u))
    drawArc(c, 180f, 180f, false, Offset(5 * u, 13 * u), Size(14 * u, 14 * u), style = Stroke(1.7f * u, cap = StrokeCap.Round))
}
private val sparkIcon: DrawScope.(Color) -> Unit = { c ->
    stroke(c, path { u -> moveTo(12 * u, 3.5f * u); lineTo(13.9f * u, 9 * u); lineTo(19.5f * u, 10.9f * u); lineTo(13.9f * u, 12.8f * u); lineTo(12 * u, 18.3f * u); lineTo(10.1f * u, 12.8f * u); lineTo(4.5f * u, 10.9f * u); lineTo(10.1f * u, 9 * u); close()
        moveTo(19 * u, 16.5f * u); lineTo(19 * u, 19.5f * u); moveTo(17.5f * u, 18 * u); lineTo(20.5f * u, 18 * u) })
}

@Composable
fun WorldsScreen(m: GameModel) {
    val worlds = m.worlds()
    Page("Choose a world", if (m.dev) "Developer Mode · All worlds unlocked." else "${worlds.count { it.complete }} / ${worlds.size} worlds complete.", { m.back() }, 460.dp) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for (w in worlds) WorldCard(w) { m.push(Route.Levels(w.world)) }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun WorldCard(w: WorldStat, onClick: () -> Unit) {
    val p = LocalPalette.current
    val (light, deep) = Art.WORLD[(w.world - 1) % Art.WORLD.size]
    val reduce = LocalReduceMotion.current
    val pulse = rememberInfiniteTransition(label = "glow")
    val glow by pulse.animateFloat(0f, 1f, infiniteRepeatable(tween(3200), RepeatMode.Reverse), label = "glow")
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp)
            .drawBehind { if (w.complete) { val g = if (reduce) .5f else glow; drawRoundRect(light.copy(alpha = .25f + .2f * g), Offset(-8.dp.toPx() * (1 + g), -8.dp.toPx() * (1 + g)), Size(size.width + 16.dp.toPx() * (1 + g), size.height + 16.dp.toPx() * (1 + g)), CornerRadius(24.dp.toPx())) } }
            .clip(shape).background(Brush.horizontalGradient(listOf(lerp(p.paper2, light, .24f), p.paper2), 0f, 900f))
            .border(1.dp, if (w.complete) light else lerp(p.line, light, .55f), shape)
            .then(if (w.locked) Modifier.alpha(.5f).semantics { disabled() } else Modifier.clickable(role = Role.Button, onClick = onClick))
            .semantics { contentDescription = "World ${w.world}, ${w.solved} of ${w.total} solved" + if (w.locked) ", locked" else if (w.complete) ", complete" else "" }
            .drawBehind { drawRoundRect(Brush.verticalGradient(listOf(light, deep)), Offset(0f, 10.dp.toPx()), Size(6.dp.toPx(), size.height - 20.dp.toPx()), CornerRadius(6.dp.toPx())) }
            .padding(start = 22.dp, end = 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Label("World ${w.world}", 16.sp, weight = FontWeight.SemiBold, spacing = .04.em)
        Label(if (w.locked) "Locked" else if (w.complete) "Complete" else "${w.solved} / ${w.total}", 12.sp, color = if (w.complete) light else p.muted, weight = FontWeight.SemiBold)
    }
}

@Composable
fun LevelsScreen(m: GameModel, world: Int) {
    val p = LocalPalette.current
    val entries = m.levels.withIndex().filter { it.value.world == world }
    Page("World $world", "${entries.count { (it.index + 1) in m.done }} / ${entries.size} solved", { m.backToWorlds() }) {
        val rows = (entries.size + 4) / 5
        // Cells keep one shape in every world (a 6-level world must not stretch) and the list scrolls if large text needs the room.
        Column(Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            for (r in 0 until rows) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                for (c in 0 until 5) {
                    val item = entries.getOrNull(r * 5 + c)
                    if (item == null) { Spacer(Modifier.weight(1f).aspectRatio(.5f)); continue }
                    val i = item.index; val level = item.value
                    val done = (i + 1) in m.done; val locked = !m.canAccess(i); val current = i == m.level
                    val shape = RoundedCornerShape(12.dp)
                    Column(
                        Modifier.weight(1f).aspectRatio(.5f).clip(shape).background(if (done) lerp(p.paper2, p.accent, .14f) else p.paper)
                            .border(if (current) 2.dp else 1.dp, if (current) p.accent else p.line, shape)
                            .then(if (locked) Modifier.alpha(.4f).semantics { disabled() } else Modifier.clickable(role = Role.Button) { m.start(i); m.audio.play("select") })
                            .semantics { contentDescription = "Level ${i + 1}, ${level.name}" + if (locked) ", locked" else if (done) ", solved" else "" }
                            .padding(6.dp),
                    ) {
                        Label("%03d".format(i + 1), 11.sp, color = p.muted, weight = FontWeight.SemiBold)
                        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                            val target = Rules.crop(level.target); val n = maxOf(target.size, target[0].length)
                            val cell = minOf(18.dp, (maxWidth - 8.dp - 2.dp * (n - 1)) / n, (maxHeight - 2.dp * (n - 1)) / n)
                            if (cell > 3.dp) TargetMini(target, cell, 2.dp)
                        }
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, minOf(density.fontScale, 1.15f))) { Label(level.name, 11.sp, lines = 2) }
                        Label(if (locked) "Locked" else if (done) "Solved" else "", 11.sp, Modifier.align(Alignment.End), color = p.muted)
                    }
                }
            }
        }
    }
}

@Composable
fun OptionsScreen(m: GameModel) {
    // "Play" only exists in debug builds (Developer mode); a release build has nothing to put on it, so it has no tab.
    val tabs = buildList { if (BuildConfig.DEBUG) add("play" to "Play"); add("sound" to "Sound"); add("appearance" to "Appearance") }
    var tab by remember { mutableStateOf(tabs.first().first) }
    val p = LocalPalette.current
    Page("Options", "Make yourself at home.", { m.back() }, 520.dp) {
        Tabs(tabs, tab) { tab = it }
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (tab) {
                "play" -> {
                    ToggleRow("Developer mode", m.dev) { m.toggleDev() }
                    Label("Developer Mode opens every campaign level. Achievements pause while it is on. (Debug builds only.)", 12.sp, color = p.muted)
                }
                "sound" -> {
                    ToggleRow("Sound", m.sound) { m.toggleSound() }
                    VolumeSlider("Ambience", m.ambience) { m.changeAmbience(it) }
                    VolumeSlider("Effects", m.effects) { m.changeEffects(it) }
                    ToggleRow("Spoken celebration", m.voice) { m.toggleVoice() }
                }
                else -> {
                    ToggleRow("Dark mode", m.dark) { m.toggleDark() }
                    MenuButton("Themes & tile finishes →") { m.push(Route.Achievements("appearance")) }
                    Label("Equip your cosmetic rewards from the Appearance collection.", 12.sp, color = p.muted)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VolumeSlider(label: String, value: Float, onChange: (Float) -> Unit) {
    val p = LocalPalette.current
    val source = remember { MutableInteractionSource() }
    val colors = SliderDefaults.colors(thumbColor = p.accent, activeTrackColor = p.accent, inactiveTrackColor = p.muted.copy(alpha = .35f))
    Column {
        Row { Label(label, 13.sp, weight = FontWeight.SemiBold); Spacer(Modifier.weight(1f)); Label("${(value * 100).toInt()}%", 13.sp, color = p.muted) }
        // A round thumb and a plain track: no stock-Material bar thumb or end-stop dot.
        Slider(value, onChange, interactionSource = source, colors = colors,
            thumb = { SliderDefaults.Thumb(source, colors = colors, thumbSize = DpSize(24.dp, 24.dp)) },
            track = { state -> SliderDefaults.Track(state, colors = colors, drawStopIndicator = null, thumbTrackGapSize = 0.dp) },
            modifier = Modifier.semantics { contentDescription = "$label volume" })
    }
}

@Composable
fun AchievementsScreen(m: GameModel, initialTab: String) {
    var tab by remember(initialTab) { mutableStateOf(initialTab) }
    val p = LocalPalette.current
    val badges = m.achievements.catalog
    Page("Achievements", "${m.earned.size} / ${badges.size} earned · Yours to keep", { m.back() }) {
        Tabs(listOf("collection" to "Collection", "appearance" to "Appearance"), tab) { tab = it }
        if (tab == "collection") {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (badge in badges) {
                    val earned = badge.id in m.earned; val progress = m.achievements.progress(badge, m.done)
                    val shape = RoundedCornerShape(16.dp)
                    Row(Modifier.fillMaxWidth().clip(shape).background(if (earned) lerp(p.paper2, p.accent, .14f) else p.paper).border(1.dp, if (earned) p.accent else p.line, shape).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        BadgeMark(badge, earned)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Eyebrow(if (earned) "Earned" else "Locked")
                            Label(badge.name, 15.sp, weight = FontWeight.SemiBold)
                            Label(badge.requirement, 12.sp, color = p.muted)
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                                Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(p.line)) {
                                    Box(Modifier.fillMaxWidth(progress / badge.goal.toFloat()).height(6.dp).background(p.accent))
                                }
                                Spacer(Modifier.width(8.dp)); Label("$progress / ${badge.goal}", 11.sp, color = p.muted)
                            }
                            m.achievements.reward(badge)?.let { Label("Unlocks $it", 12.sp, Modifier.padding(top = 4.dp), color = p.accent) }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
        } else {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (kind in listOf("background", "finish")) {
                    Label(if (kind == "background") "Background" else "Tile finish", 15.sp, weight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (c in COSMETICS.filter { it.kind == kind }) {
                            val owned = m.achievements.owns(c, m.earned); val on = (if (kind == "background") m.background else m.finish) == c.id
                            val shape = RoundedCornerShape(14.dp)
                            Column(Modifier.weight(1f).clip(shape).background(p.paper).border(if (on) 2.dp else 1.dp, if (on) p.accent else p.line, shape)
                                .then(if (owned) Modifier.clickable(role = Role.Button) { m.equip(c) } else Modifier.alpha(.45f).semantics { disabled() }).padding(10.dp)) {
                                Box(Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(10.dp)).drawBehind { cosmeticPreview(c.id, m.finish) })
                                Label(c.name, 13.sp, Modifier.padding(top = 6.dp), weight = FontWeight.SemiBold)
                                val requirement = m.achievements.catalog.find { it.id == c.badge }?.requirement ?: ""
                                Label(if (!owned) requirement else if (on) "Equipped" else c.description, 12.sp, color = p.muted)
                            }
                        }
                    }
                }
                Label("Keep your light or dark setting. Rewards change the look; your puzzle stays the same.", 12.sp, color = p.muted)
            }
        }
    }
}

/** Badge mark drawn as line art (the old Unicode glyphs depended on whatever fallback font the phone had). World badges show their number. */
@Composable
private fun BadgeMark(badge: Badge, earned: Boolean) {
    val p = LocalPalette.current
    val ink = if (earned) p.accentInk else p.muted
    Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(if (earned) p.accent else p.line), contentAlignment = Alignment.Center) {
        if (badge.world > 0) Label("${badge.world}", 20.sp, color = ink, weight = FontWeight.SemiBold)
        else Canvas(Modifier.size(22.dp)) { badgeIcon(badge.id, ink) }
    }
}

private fun DrawScope.badgeIcon(id: String, c: Color) {
    val u = size.width / 24f
    val line = Stroke(1.8f * u, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)
    val mid = Offset(12 * u, 12 * u)
    when (id) {
        "first" -> { drawCircle(c, 9 * u, mid, style = line); drawCircle(c, 3 * u, mid) }
        "flow" -> stroke(c, path { k -> moveTo(3 * k, 9 * k); quadraticTo(7.5f * k, 4 * k, 12 * k, 9 * k); quadraticTo(16.5f * k, 14 * k, 21 * k, 9 * k); moveTo(3 * k, 16 * k); quadraticTo(7.5f * k, 11 * k, 12 * k, 16 * k); quadraticTo(16.5f * k, 21 * k, 21 * k, 16 * k) })
        "halfway" -> { drawCircle(c, 9 * u, mid, style = line); drawArc(c, 90f, 180f, true, Offset(3 * u, 3 * u), Size(18 * u, 18 * u)) }
        "complete" -> sparkIcon(c)
        "steady" -> polyline(c, 7f, 3f, 15f, 3f, 9f, 12f, 17f, 12f, 10f, 21f)
        "first-clean" -> drawPath(androidx.compose.ui.graphics.Path().apply {
            for (k in 0 until 10) { val r = if (k % 2 == 0) 10f else 4.3f; val a = Math.toRadians(-90.0 + k * 36.0); val x = 12f + r * kotlin.math.cos(a).toFloat(); val y = 12.5f + r * kotlin.math.sin(a).toFloat(); if (k == 0) moveTo(x * u, y * u) else lineTo(x * u, y * u) }
            close() }, c)
        "unbroken" -> { drawCircle(c, 6 * u, Offset(8.5f * u, 12 * u), style = line); drawCircle(c, 6 * u, Offset(15.5f * u, 12 * u), style = line) }
        "flawless" -> stroke(c, path { k -> moveTo(12 * k, 3 * k); lineTo(20 * k, 12 * k); lineTo(12 * k, 21 * k); lineTo(4 * k, 12 * k); close() })
        "clean-sweep" -> stroke(c, path { k -> moveTo(4 * k, 6 * k); lineTo(12 * k, 12 * k); lineTo(4 * k, 18 * k); close(); moveTo(20 * k, 6 * k); lineTo(12 * k, 12 * k); lineTo(20 * k, 18 * k); close() })
        "pristine" -> for (cx in listOf(4f, 13.5f)) for (cy in listOf(4f, 13.5f)) drawRoundRect(c, Offset(cx * u, cy * u), Size(6.5f * u, 6.5f * u), CornerRadius(1.5f * u), style = line)
        else -> drawCircle(c, 4 * u, mid)
    }
}

private fun DrawScope.cosmeticPreview(id: String, finish: String) {
    when (id) {
        "forest" -> drawRect(Brush.linearGradient(listOf(Color(0xFF234958), Color(0xFF1E4843))))
        "mist" -> drawRect(Brush.linearGradient(listOf(Color(0xFF477D9C), Color(0xFF297D77))))
        "aurora" -> drawRect(Brush.linearGradient(listOf(Color(0xFF455C9E), Color(0xFF8B5EAA))))
        else -> { drawRect(Color(0xFF102A34)); val s = size.height * .8f; tile('B', Offset((size.width - s) / 2, size.height * .1f), s, id) }
    }
}

@Composable
fun OnlineScreen(m: GameModel) {
    Page("Online", null, { m.back() }, 420.dp) {
        Column(Modifier.weight(1f).fillMaxWidth().padding(bottom = 64.dp), verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
            MenuButton("Create", height = 64.dp, fontSize = 17.sp) { m.push(Route.Create) }
            MenuButton("Play", height = 64.dp, fontSize = 17.sp, onClick = null)
        }
    }
}

@Composable
fun PauseOverlay(m: GameModel) {
    Overlay("Menu", { m.resume() }) {
        Label("Menu", 24.sp, Modifier.semantics { heading() }, serif = true)
        Label("World %d · Level %03d · %s".format(m.spec.world, m.level + 1, m.spec.name), 12.sp, Modifier.padding(top = 4.dp, bottom = 16.dp), color = LocalPalette.current.muted, align = TextAlign.Center)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MenuButton(if (m.solved) "View result" else "Resume", primary = true) { m.resume() }
            MenuButton("Levels") { m.showLevels() }
            MenuButton("Options") { m.push(Route.Options) }
            MenuButton("Achievements") { m.push(Route.Achievements()) }
            MenuButton("Main Menu") { m.mainMenu() }
        }
    }
}

/** The result, docked under the board instead of dimming it: the solved arrangement stays lit while you read it. */
@Composable
fun WinStrip(m: GameModel) {
    val p = LocalPalette.current
    val final = m.level == m.levels.size - 1
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier.padding(top = 10.dp).widthIn(max = 420.dp).fillMaxWidth().clip(shape).background(p.paper2).border(1.dp, p.line, shape)
            .semantics { paneTitle = "Grid solved"; liveRegion = LiveRegionMode.Polite }.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Eyebrow("Grid solved")
        Label("Beautifully solved.", 26.sp, Modifier.padding(top = 4.dp, bottom = 12.dp).semantics { heading() }, serif = true, align = TextAlign.Center)
        val badges = m.winBadges
        if (badges.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(14.dp)).background(p.paper).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Label(if (badges.size == 1) "${badges[0].name} earned" else "${badges.size} achievements earned", 14.sp, weight = FontWeight.SemiBold)
                Label(badges.mapNotNull { m.achievements.reward(it) }.joinToString(" · ").ifEmpty { "A new badge for your collection." }, 12.sp, color = p.muted, align = TextAlign.Center)
                MenuButton("View collection →", Modifier.padding(top = 8.dp), height = 48.dp, fontSize = 12.sp) { m.push(Route.Achievements()) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MenuButton("Replay", Modifier.weight(1f)) { m.restart() }
            if (final) MenuButton("Choose level", Modifier.weight(1f), primary = true) { m.showLevels() }
            else MenuButton("Next →", Modifier.weight(1f), primary = true, enabled = m.canAccess(m.level + 1)) { m.next() }
        }
    }
}
