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
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = enabled, singleLine = true,
        label = { Label(label, 12.sp) }, visualTransformation = if (password && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (password) ({ IconButton(onClick = { feedback(Cue.PRESS); passwordVisible = !passwordVisible }, enabled = enabled,
            modifier = Modifier.size(48.dp).semantics { contentDescription = if (passwordVisible) "Hide password" else "Show password" }) {
            Label(if (passwordVisible) "Hide" else "Show", 12.sp)
        } }) else null,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, autoCorrectEnabled = false),
        shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink,
            focusedBorderColor = p.accent, unfocusedBorderColor = p.line, cursorColor = p.accent, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted))
}

@Composable
internal fun OnlineCard(content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current; val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(p.paper).border(1.dp, p.line, shape).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
fun AuthScreen(m: GameModel, destination: Route?) {
    val o = m.online
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    if (BuildConfig.ONLINE_DEMO) {
        var previewName by rememberSaveable { mutableStateOf("Quiet Cove") }
        OnlinePage(m, "Your Worlds preview") {
            Label("Explore a world of your own", 24.sp, serif = true)
            Label("These players and puzzles are examples. Publishing, play, and XP are saved only on this device. Real accounts use the separate service build.", 14.sp, color = LocalPalette.current.muted)
            OnlineField("Username", previewName, enabled = !o.busy) { previewName = it.take(128) }
            Label("Choose your own username. Names are unique, ignoring letter case.", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Enter local preview", primary = true, enabled = !o.busy) { o.login("preview@insight.local", previewName, destination) }
        }
        return
    }
    var mode by rememberSaveable { mutableStateOf("login") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    OnlinePage(m, if (mode == "register") "Make yourself at home" else "Log in", messages = false) {
        Tabs(listOf("login" to "Log in", "register" to "Register"), mode) {
            if (!o.busy) { mode = it; password = ""; o.clearMessages() }
        }
        OnlineField("Email", email, keyboard = KeyboardType.Email, enabled = !o.busy) { email = it.take(254) }
        OnlineField(if (mode == "register") "Password (12–128 characters)" else "Password", password, password = true, enabled = !o.busy) { password = it.take(128) }
        if (mode == "register") {
            OnlineField("Username", name, enabled = !o.busy) { name = it.take(128) }
            Label("1–32 characters · Unique, ignoring letter case", 12.sp, color = LocalPalette.current.muted)
        }
        OnlineMessages(m)
        MenuButton(if (mode == "register") "Create account" else "Log in", primary = true, enabled = !o.busy) {
            val validation = when {
                !android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches() -> "Enter a valid email address."
                password.isBlank() -> "Enter your password."
                mode == "register" && password.length < 12 -> "Choose a password with at least 12 characters."
                mode == "register" && !Nicknames.valid(name) -> Nicknames.REQUIREMENT
                else -> null
            }
            if (validation != null) o.report(OnlineException(400, "INVALID_INPUT", validation))
            else {
                focus.clearFocus(); keyboard?.hide()
                if (mode == "register") o.register(email, password, Nicknames.normalize(name), destination) { password = "" }
                else o.login(email, password, destination) { password = "" }
            }
        }
        if (o.user != null) MenuButton("Log out", enabled = !o.busy) { o.logout() }
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
    var detail by remember { mutableStateOf<JSONObject?>(null) }
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
    Page(if (own) "Your profile" else "Player profile", 560.dp) {
        // Top-left: a crossed-out signal while the server can't be reached. Top-right: Log out, on your own profile only, confirmed in a tiny popup.
        Box(Modifier.fillMaxWidth().height(48.dp)) {
            if (m.online.offline) androidx.compose.foundation.Canvas(Modifier.align(Alignment.CenterStart).padding(start = 14.dp).size(20.dp).semantics { contentDescription = "Offline. Pull down to retry." }) { offlineIcon(p.muted) }
            if (own) Box(Modifier.align(Alignment.CenterEnd)) {
                HomeIconButton("Log out", Modifier, { confirmLogout = true }, logoutIcon, Cue.PRESS, enabled = !m.online.busy)
                if (confirmLogout) {
                    val shift = with(androidx.compose.ui.platform.LocalDensity.current) { 52.dp.roundToPx() }
                    androidx.compose.ui.window.Popup(Alignment.CenterEnd, androidx.compose.ui.unit.IntOffset(-shift, 0), { confirmLogout = false }, androidx.compose.ui.window.PopupProperties(focusable = true)) {
                        val shape = RoundedCornerShape(12.dp)
                        Box(Modifier.clip(shape).background(p.paper2).border(1.dp, p.line, shape)
                            .clickable(role = Role.Button) { m.feedback(Cue.DELETE); confirmLogout = false; m.online.logout() }.padding(horizontal = 14.dp, vertical = 10.dp)) {
                            Label("Log out", 13.sp, weight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
        Refreshable(pulling, ::pull, Modifier.weight(1f).fillMaxWidth()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OnlineMessages(m, errors = false)
                androidx.compose.animation.AnimatedVisibility(ready, enter = androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(180))) {
                    val data = profile ?: return@AnimatedVisibility
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ProfileCard(data)
                        if (!own) MenuButton(if (data.optBoolean("following")) "Following" else "Follow", primary = !data.optBoolean("following"), cue = Cue.CHECK) { toggleFollow(data) }
                        val badges = data.getJSONArray("badges").strings().toSet()
                        InfoRow("Achievements", "${m.achievements.catalog.count { it.id in badges }} / ${m.achievements.catalog.size}", arrow = false,
                            onClick = if (own) ({ m.push(Route.Achievements) }) else null)
                        // Your own lists each open their own screen, like Achievements.
                        if (own) {
                            InfoRow("Bookmarked", number(data.optInt("bookmarkCount")), arrow = false, onClick = { m.push(Route.Bookmarks) })
                            InfoRow("Following", number(data.optInt("followingCount")), arrow = false, onClick = { m.push(Route.Players("following")) })
                            InfoRow("Followers", number(data.optInt("followerCount")), arrow = false, onClick = { m.push(Route.Players("followers")) })
                        }
                        // The player's own puzzles, in the same four-column cards as Levels and Worlds.
                        PuzzleCardList(m, puzzles, "No puzzles yet.") { detail = it }
                        if (own && outcomes.isNotEmpty()) {
                            Label("${outcomes.count { it.state == "pending" }} pending submissions", 12.sp, color = p.muted)
                            outcomes.filter { it.state == "failed" }.forEach { Label("Submission needs attention: ${it.error}", 12.sp, color = p.accent) }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
    detail?.let { grid -> PuzzleDetails(m, grid) { detail = null } }
}

/** Username and level, the level bar, then created / solved and followers / daily streak. */
@Composable
private fun ProfileCard(profile: JSONObject) {
    val p = LocalPalette.current
    OnlineCard {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Label(profile.getString("username"), 24.sp, Modifier.semantics { heading() }, serif = true, align = TextAlign.Center)
            Label("Level ${number(profile.getInt("level"))}", 16.sp, color = p.accent)
        }
        val xp = profile.getString("xpMilli").toBigInteger(); val start = profile.getString("levelStartMilli").toBigInteger()
        if (!profile.isNull("nextLevelMilli")) {
            val next = profile.getString("nextLevelMilli").toBigInteger()
            val ratio = ((xp - start).toDouble() / (next - start).toDouble()).toFloat().coerceIn(0f, 1f)
            ProgressBar(ratio, Modifier.padding(top = 6.dp))
            Label("${NumberFormat.getIntegerInstance().format(xp / java.math.BigInteger.valueOf(1000))} XP · ${NumberFormat.getIntegerInstance().format(next / java.math.BigInteger.valueOf(1000))} for next level", 12.sp, Modifier.fillMaxWidth(), color = p.muted, align = TextAlign.Center)
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
        contentDescription = "Progress to next level"; stateDescription = "${(ratio * 100).roundToInt()} percent"
    }) {
        if (ratio > 0f) Box(Modifier.fillMaxWidth(ratio).fillMaxHeight().clip(shape).background(p.accent))
    }
}
