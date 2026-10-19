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
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
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
internal fun OnlineMessages(m: GameModel) {
    if (BuildConfig.ONLINE_DEMO) Eyebrow("Local preview · On this device")
    if (m.online.busy) Label("Working…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    m.online.error?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.accent) }
    m.online.notice?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.muted) }
}

@Composable
internal fun OnlineField(label: String, value: String, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, enabled: Boolean = true, onChange: (String) -> Unit) {
    val p = LocalPalette.current
    var passwordVisible by remember { mutableStateOf(false) }
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = enabled, singleLine = true,
        label = { Label(label, 12.sp) }, visualTransformation = if (password && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (password) ({ IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = enabled,
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
            Label("These players and worlds are examples. Publishing, play, and XP are saved only on this device. Real accounts use the separate service build.", 14.sp, color = LocalPalette.current.muted)
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

/** Cached data remains visible when refreshing fails; a failed load offers a retry. */
@Composable
private fun Remote(m: GameModel, path: String, refresh: Int = 0, content: @Composable (JSONObject) -> Unit) {
    val account = m.online.user?.id ?: return
    var data by remember(path, account) { mutableStateOf<JSONObject?>(null) }
    var loading by remember(path, account) { mutableStateOf(true) }
    var failed by remember(path, account) { mutableStateOf(false) }
    var retry by remember(path, account) { mutableIntStateOf(0) }
    LaunchedEffect(path, account, refresh, retry) {
        loading = true; failed = false
        try {
            data = m.online.repository.cached(account, path)
            data = m.online.repository.fetch(path, account)
        } catch (error: Exception) { failed = true; m.online.report(error) }
        finally { loading = false }
    }
    if (loading) Label("Loading…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    data?.let { content(it) }
    if (failed && !loading) MenuButton("Try again", enabled = !m.online.busy) { m.online.clearMessages(); retry++ }
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
    var revision by remember { mutableIntStateOf(0) }
    var outcomes by remember(account) { mutableStateOf(emptyList<OnlineDatabase.Pending>()) }
    LaunchedEffect(account, revision) { outcomes = m.online.repository.outcomes(account) }
    // Opening your own profile syncs quietly, then reloads so new XP shows without any button.
    LaunchedEffect(account, own) { if (own) { m.online.refreshProgress(); revision++ } }
    OnlinePage(m, if (own) "Your profile" else "Player profile") {
        Remote(m, "/v1/profiles/$id", revision) { profile ->
            Label(profile.getString("username"), 24.sp, Modifier.semantics { heading() }, serif = true)
            OnlineCard {
                Label("Level ${number(profile.getInt("level"))}", 20.sp, color = LocalPalette.current.accent)
                val xp = profile.getString("xpMilli").toBigInteger(); val start = profile.getString("levelStartMilli").toBigInteger()
                if (!profile.isNull("nextLevelMilli")) {
                    val next = profile.getString("nextLevelMilli").toBigInteger()
                    val ratio = ((xp - start).toDouble() / (next - start).toDouble()).toFloat().coerceIn(0f, 1f)
                    LinearProgressIndicator(progress = { ratio }, modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Progress to next level" }, color = LocalPalette.current.accent, trackColor = LocalPalette.current.line)
                    Label("${NumberFormat.getIntegerInstance().format(xp / java.math.BigInteger.valueOf(1000))} XP · ${NumberFormat.getIntegerInstance().format(next / java.math.BigInteger.valueOf(1000))} for next level", 12.sp, color = LocalPalette.current.muted)
                } else Label("Level 100 · Yours to keep", 14.sp)
                Box(Modifier.fillMaxWidth().padding(top = 4.dp).height(1.dp).background(LocalPalette.current.line))
                Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Stat("Worlds created", number(profile.getInt("worldCount")), Modifier.weight(1f))
                    Stat("Grids designed", number(profile.getInt("gridCount")), Modifier.weight(1f))
                    Stat("Grids beaten", number(profile.getInt("beatenCount")), Modifier.weight(1f))
                }
            }
            Label("${number(profile.getInt("campaignCount"))} campaign · ${number(profile.getInt("communityCount"))} community", 12.sp, color = LocalPalette.current.muted)
            val badges = profile.getJSONArray("badges").strings().toSet()
            InfoRow("Achievements", "${m.achievements.catalog.count { it.id in badges }} / ${m.achievements.catalog.size}")
            InfoRow(if (own) "Your worlds" else "Worlds", number(profile.getInt("worldCount")), onClick = { m.push(Route.ProfileWorlds(id)) })
        }
        if (own) {
            if (outcomes.isNotEmpty()) {
                Label("${outcomes.count { it.state == "pending" }} pending submissions", 12.sp, color = LocalPalette.current.muted)
                outcomes.filter { it.state == "failed" }.forEach { Label("Submission needs attention: ${it.error}", 12.sp, color = LocalPalette.current.accent) }
            }
            MenuButton("Log out", enabled = !m.online.busy) { m.online.logout() }
        }
    }
}

/** The worlds behind the profile's "Worlds" row: yours (with Manage) or a player's published ones. */
@Composable
fun ProfileWorldsScreen(m: GameModel, id: String) {
    val account = m.online.user?.id ?: return
    val own = id == account
    var revision by remember { mutableIntStateOf(0) }
    var editingWorld by remember { mutableStateOf<JSONObject?>(null) }
    OnlinePage(m, if (own) "Your worlds" else "Published worlds") {
        WorldListing(m, owner = if (own) null else id, mine = own, revision = revision, onManage = if (own) ({ editingWorld = it }) else null)
    }
    editingWorld?.let { world -> WorldSheet(m, world, { editingWorld = null }) { editingWorld = null; revision++ } }
}

@Composable
private fun WorldListing(m: GameModel, owner: String? = null, mine: Boolean = false, query: String = "", revision: Int = 0, onManage: ((JSONObject) -> Unit)? = null) {
    val account = m.online.user?.id ?: return
    var page by remember(owner, mine, query, revision) { mutableIntStateOf(0) }
    var items by remember(owner, mine, query, revision) { mutableStateOf(emptyList<JSONObject>()) }
    var next by remember(owner, mine, query, revision) { mutableStateOf<Int?>(null) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember(owner, mine, query, revision) { mutableStateOf(false) }
    var retry by remember { mutableIntStateOf(0) }
    LaunchedEffect(account, owner, mine, query, page, revision, retry) {
        loading = true; failed = false
        val path = "/v1/worlds?page=$page&mine=$mine&query=${URLEncoder.encode(query, "UTF-8")}" + (owner?.let { "&owner=$it" } ?: "")
        try {
            val cached = m.online.repository.cached(account, path)
            if (cached != null) items = (if (page == 0) emptyList() else items) + cached.getJSONArray("items").objects()
            val json = m.online.repository.fetch(path, account)
            items = ((if (page == 0) emptyList() else items) + json.getJSONArray("items").objects()).distinctBy { it.getString("id") }
            next = if (json.isNull("nextPage")) null else json.getInt("nextPage")
        } catch (error: Exception) { failed = true; m.online.report(error) }
        finally { loading = false }
    }
    if (!loading && items.isEmpty()) Label(if (failed) "Worlds could not be loaded. Please try again." else if (mine) "Your first world starts here." else "No worlds found yet.", 14.sp)
    items.forEach { world ->
        OnlineCard {
            Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clickable(role = Role.Button) { m.push(Route.CommunityWorld(world.getString("id"))) },
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                TileIcon(world.getString("icon")[0], 40.dp, m.finish, Modifier.semantics { contentDescription = "${Art.NAME[world.getString("icon")[0]]} world icon" })
                Column(Modifier.weight(1f)) {
                    Label(world.getString("name"), 18.sp, serif = true)
                    Label("${number(world.getInt("gridCount"))} grids · ${number(world.getInt("popularity"))} plays", 12.sp, color = LocalPalette.current.muted)
                    if (world.optBoolean("hidden")) Label("Hidden", 12.sp, color = LocalPalette.current.muted)
                    if (world.optBoolean("moderated")) Label("Unavailable · Contact the test operator", 12.sp, color = LocalPalette.current.muted)
                }
            }
            if (onManage != null && !world.optBoolean("moderated")) MenuButton("Manage world", enabled = !m.online.busy) { onManage(world) }
        }
    }
    if (loading) Label("Loading worlds…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    if (!loading) {
        next?.let { following -> MenuButton("More worlds") { page = following } }
        if (failed) MenuButton("Try again", enabled = !m.online.busy) { m.online.clearMessages(); retry++ }
    }
}

@Composable
internal fun IconPicker(m: GameModel, icon: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Rules.TYPES.chunked(3).forEach { group ->
       Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        group.forEach { type ->
            Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).border(if (icon == type.toString()) 3.dp else 2.dp,
                if (icon == type.toString()) LocalPalette.current.accent else LocalPalette.current.line, RoundedCornerShape(12.dp))
                .clickable(role = Role.RadioButton, enabled = !m.online.busy) { onSelect(type.toString()) }
                .semantics { contentDescription = "${Art.NAME[type]} world icon${if (icon == type.toString()) ", selected" else ""}" }, contentAlignment = Alignment.Center) {
                TileIcon(type, 32.dp, m.finish)
            }
        }
       }
      }
    }
}

@Composable
private fun WorldSheet(m: GameModel, world: JSONObject, dismiss: () -> Unit, saved: () -> Unit) {
    val filter = NameFilter.get(LocalContext.current)
    var name by remember { mutableStateOf(world.getString("name")) }
    var icon by remember { mutableStateOf(world.getString("icon")) }
    val problem = if (name.isBlank()) null else filter.problem(name)
    var hidden by remember { mutableStateOf(world.optBoolean("hidden")) }
    Overlay("Manage world", { if (!m.online.busy) dismiss() }) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label("Manage world", 24.sp, serif = true)
            OnlineMessages(m)
            OnlineField("World name", name, enabled = !m.online.busy) { name = it.take(64) }
            Label(problem ?: "1–32 characters. Respectful names only.", 12.sp, color = if (problem != null) LocalPalette.current.accent else LocalPalette.current.muted)
            IconPicker(m, icon) { icon = it }
            ToggleRow("Hide world", hidden) { if (!m.online.busy) hidden = it }
            MenuButton("Save world", primary = true, enabled = !m.online.busy && name.isNotBlank() && problem == null) { m.online.task {
                val body = JSONObject().put("name", filter.normalize(name)).put("icon", icon)
                m.online.repository.command("world:${world.getString("id")}", "PATCH", "/v1/worlds/${world.getString("id")}", body.put("hidden", hidden))
                saved()
            } }
            MenuButton("Cancel", enabled = !m.online.busy, onClick = dismiss)
        }
    }
}

@Composable
internal fun GridSheet(m: GameModel, grid: JSONObject, dismiss: () -> Unit, saved: () -> Unit) {
    val filter = NameFilter.get(LocalContext.current)
    var name by remember { mutableStateOf(grid.getString("name")) }
    val problem = if (name.isBlank()) null else filter.problem(name)
    var hidden by remember { mutableStateOf(grid.optBoolean("hidden")) }
    Overlay("Manage grid", { if (!m.online.busy) dismiss() }) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label("Manage grid", 24.sp, serif = true)
            OnlineMessages(m)
            OnlineField("Level name", name, enabled = !m.online.busy) { name = it.take(64) }
            Label(problem ?: "1–32 characters. Respectful names only.", 12.sp, color = if (problem != null) LocalPalette.current.accent else LocalPalette.current.muted)
            ToggleRow("Hide grid", hidden) { if (!m.online.busy) hidden = it }
            Label("Published arrangements stay fixed. Hiding keeps the grid's place in its world.", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Save", primary = true, enabled = !m.online.busy && name.isNotBlank() && problem == null) { m.online.task {
                m.online.repository.command("grid:${grid.getString("id")}", "PATCH", "/v1/grids/${grid.getString("id")}", JSONObject().put("name", filter.normalize(name)).put("hidden", hidden)); saved()
            } }
            MenuButton("Cancel", enabled = !m.online.busy, onClick = dismiss)
        }
    }
}
