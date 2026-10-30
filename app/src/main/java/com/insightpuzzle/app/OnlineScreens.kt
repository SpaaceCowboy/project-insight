package com.insightpuzzle.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.net.URLEncoder
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
private fun OnlinePage(m: GameModel, title: String, messages: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Page(title, 560.dp) {
        ChevronBar(m)
        Column(Modifier.weight(1f).fillMaxWidth().imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (messages) OnlineMessages(m)
            content()
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
internal fun OnlineMessages(m: GameModel, errors: Boolean = true) {
    if (BuildConfig.ONLINE_DEMO) Eyebrow("Local preview · On this device")
    if (errors) m.online.error?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.accent) }
    m.online.notice?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.muted) }
}

@Composable
internal fun OnlineField(label: String, value: String, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, enabled: Boolean = true, onChange: (String) -> Unit) {
    val p = LocalPalette.current
    var passwordVisible by remember { mutableStateOf(false) }
    val feedback = LocalFeedback.current
    // Text that arrives in one go (the saved-credentials shortcut) tints the inside of the box a sleek grey; the system's own yellow, square highlight is switched off
    // because it ignored the rounded corners. Typing, or an emptied box, puts the usual look back.
    var filled by remember { mutableStateOf(false) }
    val tint = if (p.dark) androidx.compose.ui.graphics.lerp(p.paper2, p.ink, .1f) else androidx.compose.ui.graphics.lerp(p.paper2, p.ink, .07f)
    val inside = if (filled && value.isNotEmpty()) tint else Color.Transparent
    CompositionLocalProvider(androidx.compose.foundation.text.LocalAutofillHighlightColor provides Color.Transparent) {
    OutlinedTextField(value, { next -> filled = next.length - value.length > 1; onChange(next) }, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = enabled, singleLine = true,
        label = { Label(label, 12.sp) }, visualTransformation = if (password && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (password) ({ IconButton(onClick = { feedback(Cue.PRESS); passwordVisible = !passwordVisible }, enabled = enabled,
            modifier = Modifier.size(48.dp).semantics { contentDescription = if (passwordVisible) tr("Hide password") else tr("Show password") }) {
            // An open eye while the password is readable, a crossed-out one while it is hidden.
            androidx.compose.foundation.Canvas(Modifier.size(22.dp)) { eyeIcon(p.muted, passwordVisible) }
        } }) else null,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, autoCorrectEnabled = false),
        shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink,
            focusedContainerColor = inside, unfocusedContainerColor = inside,
            focusedBorderColor = p.accent, unfocusedBorderColor = p.line, cursorColor = p.accent, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted))
    }
}

/**
 * A small, quiet eye for the password field: a slim almond and a dot for a pupil while the text is readable; while it is hidden, the lid closed to a
 * gentle curve with three short lashes. No slash, no heavy outline.
 */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.eyeIcon(c: Color, visible: Boolean) {
    val u = size.width / 24f
    val width = 1.4f * u
    val line = androidx.compose.ui.graphics.drawscope.Stroke(width, cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round)
    fun at(x: Float, y: Float) = androidx.compose.ui.geometry.Offset(x * u, y * u)
    if (visible) {
        val lid = androidx.compose.ui.graphics.Path().apply {
            moveTo(4 * u, 12 * u); quadraticBezierTo(12 * u, 5.5f * u, 20 * u, 12 * u); quadraticBezierTo(12 * u, 18.5f * u, 4 * u, 12 * u); close()
        }
        drawPath(lid, c, style = line)
        drawCircle(c, 1.9f * u, at(12f, 12f))
    } else {
        val lid = androidx.compose.ui.graphics.Path().apply { moveTo(4 * u, 11 * u); quadraticBezierTo(12 * u, 17 * u, 20 * u, 11 * u) }
        drawPath(lid, c, style = line)
        for ((a, b) in listOf(at(8f, 13.6f) to at(7f, 16f), at(12f, 14.5f) to at(12f, 17f), at(16f, 13.6f) to at(17f, 16f)))
            drawLine(c, a, b, width, androidx.compose.ui.graphics.StrokeCap.Round)
    }
}

@Composable
internal fun OnlineCard(modifier: Modifier = Modifier, pushable: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    // Not a button, but it sits on the same pedestal as the buttons below it. A [pushable] card sinks under a finger like a key and does nothing else.
    val p = LocalPalette.current; val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val feedback = LocalFeedback.current
    Column(modifier.fillMaxWidth().plush(shape, if (pushable) pressProgress(source) else 0f, p.paper2)
        .then(if (pushable) Modifier.pressOnTouch(source).clickable(source, null) { feedback(null) } else Modifier).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
fun AuthScreen(m: GameModel, destination: Route?) {
    val o = m.online
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    val usernames = UsernameFilter.get(LocalContext.current)
    if (BuildConfig.ONLINE_DEMO) {
        var previewName by rememberSaveable { mutableStateOf("Quiet Cove") }
        OnlinePage(m, "Your Worlds preview") {
            Label("Explore a world of your own", 24.sp)
            Label("These players and puzzles are examples. Publishing, play, and XP are saved only on this device. Real accounts use the separate service build.", 14.sp, color = LocalPalette.current.muted)
            OnlineField("Username", previewName, enabled = !o.busy) { previewName = Nicknames.clip(it) }
            Label("${Nicknames.MIN_LENGTH}–${Nicknames.MAX_LENGTH} characters: English letters, numbers, spaces, _ and -", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Enter local preview", primary = true, enabled = !o.busy) { o.login("preview@insight.local", previewName, destination) }
        }
        return
    }
    var mode by rememberSaveable { mutableStateOf("login") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    OnlinePage(m, if (mode == "register") "Make yourself at home" else "Login", messages = false) {
        Tabs(listOf("login" to "Login", "register" to "Register"), mode) {
            if (!o.busy) { mode = it; password = ""; repeat = ""; o.clearMessages() }
        }
        OnlineField("Email", email, keyboard = KeyboardType.Email, enabled = !o.busy) { email = it.take(254) }
        OnlineField("Password", password, password = true, enabled = !o.busy) { password = it.take(128) }
        if (mode == "register") {
            // Typed twice, so a slip of the finger can't lock the player out of a new account.
            OnlineField("Repeat password", repeat, password = true, enabled = !o.busy) { repeat = it.take(128) }
            // A name already in use is refused by the server (NAME_TAKEN) and shown in the message line below. The rules show only once the name breaks one.
            OnlineField("Username", name, enabled = !o.busy) { name = Nicknames.clip(it) }
            val problem = if (name.isBlank()) null else usernames.problem(name)
            if (problem != null) Label(Nicknames.message(problem), 12.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = if (problem != NameProblem.LENGTH) LocalPalette.current.accent else LocalPalette.current.muted)
        }
        OnlineMessages(m)
        MenuButton(if (mode == "register") "Create account" else "Login", primary = true, enabled = !o.busy) {
            val validation = when {
                !android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches() -> tr("Enter a valid email address.")
                password.isBlank() -> tr("Enter your password.")
                mode == "register" && password.length < 12 -> tr("Choose a password with at least 12 characters.")
                mode == "register" && repeat != password -> tr("The passwords don't match.")
                mode == "register" && usernames.problem(name) != null -> Nicknames.message(usernames.problem(name)!!)
                else -> null
            }
            if (validation != null) o.report(OnlineException(400, "INVALID_INPUT", validation))
            else {
                focus.clearFocus(); keyboard?.hide()
                if (mode == "register") o.register(email, password, Nicknames.normalize(name), destination) { password = ""; repeat = "" }
                else o.login(email, password, destination) { password = "" }
            }
        }
    }
}

private fun number(value: Int) = NumberFormat.getIntegerInstance().format(value)

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Label(value, 20.sp, weight = FontWeight.SemiBold)
        Label(label, 12.sp, color = LocalPalette.current.muted, align = TextAlign.Center)
    }
}

@Composable
fun ProfileScreen(m: GameModel, requestedId: String?) {
    val account = m.online.user?.id ?: return
    val id = requestedId ?: account
    val own = id == account
    val p = LocalPalette.current
    val scope = rememberCoroutineScope()
    var revision by remember { mutableIntStateOf(0) }
    var pulling by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<DetailAnchor?>(null) }
    var confirmLogout by remember { mutableStateOf(false) }
    var outcomes by remember(account) { mutableStateOf(emptyList<OnlineDatabase.Pending>()) }
    // The viewer's local date tells the server whether a daily streak is still alive.
    val path = "/v1/profiles/$id?today=${java.time.LocalDate.now()}"
    var profile by remember(id, account) { mutableStateOf<JSONObject?>(null) }
    val puzzles = m.playDiscovery.collection(id)
    LaunchedEffect(account, revision) { outcomes = m.online.repository.outcomes(account) }
    // Opening your own profile syncs quietly, then reloads so new XP shows without any button.
    LaunchedEffect(account, own) { if (own) { m.online.refreshProgress(); revision++ } }
    LaunchedEffect(path, account, revision) {
        try {
            if (profile == null) profile = m.online.repository.cached(account, path)
            profile = m.online.repository.fetch(path, account); m.online.offline = false
        } catch (error: Exception) { if (error is kotlinx.coroutines.CancellationException) throw error; m.online.quiet(error) }
        finally { pulling = false }
    }
    LoadDiscovery(m, puzzles, "/v1/grids?owner=$id&sort=number&query=", resetScroll = false)
    // Everything appears together: the card, the rows and the puzzles, never the card first and the rest a moment later.
    fun loaded(state: DiscoveryListState) = state.items.isNotEmpty() || (!state.loading && state.settled)
    val ready = profile != null && loaded(puzzles)
    fun pull() {
        pulling = true; m.online.clearMessages(); puzzles.refresh()
        scope.launch { if (own) m.online.refreshProgress(); revision++ }
    }
    fun toggleFollow(current: JSONObject) {
        val on = !current.optBoolean("following")
        profile = JSONObject(current.toString()).put("following", on).put("followerCount", current.optInt("followerCount") + if (on) 1 else -1)
        scope.launch {
            try {
                val result = m.online.repository.command("follow:$id", "POST", "/v1/users/$id/follow", JSONObject().put("on", on))
                profile = JSONObject((profile ?: current).toString()).put("following", result.getBoolean("following")).put("followerCount", result.getInt("followerCount"))
            } catch (error: Exception) { if (error is kotlinx.coroutines.CancellationException) throw error; profile = current; m.online.quiet(error) }
        }
    }
    // Logout takes two taps on its icon: the first shows "Confirm / Logout", the second logs out. A tap anywhere else, or a few seconds, cancels.
    var screenBox by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }
    var logoutBox by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }
    LaunchedEffect(confirmLogout) { if (confirmLogout) { kotlinx.coroutines.delay(4000); confirmLogout = false } }
    Box(Modifier.fillMaxSize().onGloballyPositioned { screenBox = it }.pointerInput(Unit) {
        // Seen first and never consumed, so whatever was tapped still works.
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial)
            val icon = logoutBox?.takeIf { it.isAttached }?.let { screenBox?.takeIf { s -> s.isAttached }?.localBoundingBoxOf(it) }
            if (icon?.contains(down.position) != true) confirmLogout = false
        }
    }) {
    Page(if (own) "Your profile" else "Player profile", 560.dp) {
        // Left: a crossed-out signal while the server can't be reached. Centre: Back. Right: Logout, on your own profile only.
        Box(Modifier.fillMaxWidth().height(48.dp)) {
            if (m.online.offline) androidx.compose.foundation.Canvas(Modifier.align(Alignment.CenterStart).padding(start = 14.dp).size(20.dp).semantics { contentDescription = tr("Offline. Pull down to retry.") }) { offlineIcon(p.muted) }
            BackChevron(m, Modifier.align(Alignment.Center))
            if (own) Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
                if (confirmLogout) {
                    // Two short lines keep the bubble narrow, so it never reaches the chevron.
                    val shape = RoundedCornerShape(12.dp)
                    Column(Modifier.padding(end = 6.dp).clip(shape).background(p.paper2).semantics { liveRegion = LiveRegionMode.Polite }.padding(horizontal = 10.dp, vertical = 5.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Label("Confirm", 12.sp, weight = FontWeight.SemiBold, lines = 1)
                        Label("Logout", 12.sp, weight = FontWeight.SemiBold, lines = 1)
                    }
                }
                HomeIconButton(if (confirmLogout) "Confirm logout" else "Logout", Modifier.onGloballyPositioned { logoutBox = it }, {
                    if (confirmLogout) { confirmLogout = false; m.feedback(Cue.DELETE); m.online.logout() } else confirmLogout = true
                }, logoutIcon, Cue.PRESS, enabled = !m.online.busy)
            }
        }
        Spacer(Modifier.height(ScreenGap))
        Refreshable(pulling, ::pull, Modifier.weight(1f).fillMaxWidth().bleed()) {
            // The buttons grow downwards to take the height the card and the three rows of puzzles leave, so the rows end exactly at the bottom of the screen.
            // Your profile and another player's share this geometry: Follow plus Achievements fill the same space as the three buttons.
            // The side inset leaves room for the raised shadows, which the scroll area would otherwise clip; the area bleeds out by the same amount,
            // so the card, the buttons and the puzzles line up with the keys above.
            FillColumn(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = ShadowRoom), gap = 12.dp) {
                OnlineMessages(m, errors = false)
                // Only a fade: nothing here grows or slides into place.
                val shown by androidx.compose.animation.core.animateFloatAsState(if (ready) 1f else 0f, androidx.compose.animation.core.tween(180), label = "profile")
                val fade = Modifier.graphicsLayer { alpha = shown }
                val data = profile
                if (ready && data != null) {
                    ProfileCard(data, fade)
                    val badges = data.getJSONArray("badges").strings()
                    val badgeCount = "${m.achievements.earnedCount(badges)} / ${m.achievements.catalog.size}"
                    // Achievements, and on your own profile your bookmarks and whom you follow, side by side; each opens its own screen.
                    if (own) Row(Modifier.fillMaxWidth().fillRest().then(fade), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileButton("Following", number(data.optInt("followingCount")), Modifier.weight(1f).fillMaxHeight()) { m.push(Route.Players("following")) }
                        ProfileButton("Achievements", badgeCount, Modifier.weight(1f).fillMaxHeight()) { m.push(Route.Achievements) }
                        ProfileButton("Bookmarked", number(data.optInt("bookmarkCount")), Modifier.weight(1f).fillMaxHeight()) { m.push(Route.Bookmarks) }
                    } else Column(Modifier.fillMaxWidth().fillRest().then(fade), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        MenuButton(if (data.optBoolean("following")) "Following" else "Follow", primary = !data.optBoolean("following"), cue = Cue.CHECK) { toggleFollow(data) }
                        // Another player's achievements open read-only: which badges they have, without their progress.
                        ProfileButton("Achievements", badgeCount, Modifier.fillMaxWidth().weight(1f)) { m.push(Route.PlayerAchievements(data.getString("username"), badges)) }
                    }
                    // The player's own puzzles, in the same four-column cards as Levels and Worlds.
                    Box(fade) { PuzzleCardList(m, puzzles, "No puzzles yet.") { detail = it } }
                    if (own && outcomes.isNotEmpty()) Column(fade, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Label(tr("{0} pending submissions", outcomes.count { it.state == "pending" }), 12.sp, color = p.muted, translate = false)
                        outcomes.filter { it.state == "failed" }.forEach { Label(tr("Submission needs attention: {0}", it.error), 12.sp, color = p.accent, translate = false) }
                    }
                }
            }
        }
    }
    }
    detail?.let { anchor -> PuzzleDetails(m, anchor) { detail = null } }
}

/** One of the profile's three side-by-side buttons: a name over its count. Without [onClick] it only shows the count. */
@Composable
private fun ProfileButton(label: String, value: String, modifier: Modifier = Modifier, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    // Without an action it rests on its pedestal and ignores touches.
    Column(modifier.heightIn(min = 64.dp).plush(shape, if (onClick != null) pressProgress(source) else 0f, p.paper2)
        .then(if (onClick != null) Modifier.pressOnTouch(source).clickable(source, null, role = Role.Button) { feedback(Cue.FORWARD); onClick() } else Modifier)
        .padding(horizontal = 6.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Label(value, 16.sp, weight = FontWeight.SemiBold, lines = 1)
        Label(label, 11.sp, color = p.muted, align = TextAlign.Center, lines = 1)
    }
}

/** Username and level, the level bar, then created / solved and followers / daily streak. */
@Composable
private fun ProfileCard(profile: JSONObject, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    OnlineCard(modifier, pushable = true) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Label(profile.getString("username"), 24.sp, Modifier.semantics { heading() }, align = TextAlign.Center, translate = false)
            Label(tr("Level {0}", number(profile.getInt("level"))), 16.sp, color = p.accent, translate = false)
        }
        val xp = profile.getString("xpMilli").toBigInteger(); val start = profile.getString("levelStartMilli").toBigInteger()
        if (!profile.isNull("nextLevelMilli")) {
            val next = profile.getString("nextLevelMilli").toBigInteger()
            val ratio = ((xp - start).toDouble() / (next - start).toDouble()).toFloat().coerceIn(0f, 1f)
            ProgressBar(ratio, Modifier.padding(top = 6.dp))
            Label(tr("{0} XP · {1} for next level", NumberFormat.getIntegerInstance().format(xp / java.math.BigInteger.valueOf(1000)), NumberFormat.getIntegerInstance().format(next / java.math.BigInteger.valueOf(1000))), 12.sp, Modifier.fillMaxWidth(), color = p.muted, align = TextAlign.Center, translate = false)
        } else Label("Level 100 · Yours to keep", 14.sp, Modifier.fillMaxWidth(), align = TextAlign.Center)
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat("Puzzles created", number(profile.getInt("gridCount")), Modifier.weight(1f))
            Stat("Puzzles solved", number(profile.getInt("beatenCount")), Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat("Followers", number(profile.optInt("followerCount")), Modifier.weight(1f))
            Stat("Daily streak", number(profile.optInt("streak")), Modifier.weight(1f))
        }
    }
}

/** No connection: signal arcs with a line through them. */
internal fun androidx.compose.ui.graphics.drawscope.DrawScope.offlineIcon(c: Color) {
    val u = size.width / 24f
    val line = androidx.compose.ui.graphics.drawscope.Stroke(1.8f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round)
    for (r in listOf(9f, 6f, 3f)) drawArc(c, 225f, 90f, false, androidx.compose.ui.geometry.Offset((12 - r) * u, (17 - r) * u), androidx.compose.ui.geometry.Size(2 * r * u, 2 * r * u), style = line)
    drawCircle(c, 1.4f * u, androidx.compose.ui.geometry.Offset(12 * u, 17 * u))
    drawLine(c, androidx.compose.ui.geometry.Offset(4 * u, 4 * u), androidx.compose.ui.geometry.Offset(20 * u, 20 * u), 1.8f * u, androidx.compose.ui.graphics.StrokeCap.Round)
}

/** Level progress: one rounded track, filled from the left to exactly [ratio]. No gap and no end marker. */
@Composable
private fun ProgressBar(ratio: Float, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(6.dp)
    Box(modifier.fillMaxWidth().height(12.dp).clip(shape).background(p.line).semantics {
        contentDescription = tr("Progress to next level"); stateDescription = tr("{0} percent", (ratio * 100).roundToInt())
    }) {
        if (ratio > 0f) Box(Modifier.fillMaxWidth(ratio).fillMaxHeight().clip(shape).background(p.accent))
    }
}
