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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.net.URLEncoder
import java.text.NumberFormat
import java.util.Locale

@Composable
private fun OnlinePage(m: GameModel, title: String, subtitle: String? = null, messages: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Page(title, subtitle, { m.back() }, 560.dp) {
        Column(Modifier.weight(1f).fillMaxWidth().imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (messages) OnlineMessages(m)
            content()
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun OnlineMessages(m: GameModel) {
    if (BuildConfig.ONLINE_DEMO) Eyebrow("Local preview · On this device")
    if (m.online.busy) Label("Working…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    m.online.error?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.accent) }
    m.online.notice?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.muted) }
}

@Composable
private fun OnlineField(label: String, value: String, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, enabled: Boolean = true, onChange: (String) -> Unit) {
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
private fun OnlineCard(content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current; val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(p.paper).border(1.dp, p.line, shape).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
private fun WordChoice(label: String, selected: String, options: List<String>, enabled: Boolean, modifier: Modifier, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        MenuButton(selected, subtitle = label, enabled = enabled) { expanded = true }
        DropdownMenu(expanded, { expanded = false }, Modifier.background(LocalPalette.current.paper2)) {
            options.forEach { word -> DropdownMenuItem(text = { Label(word, 14.sp) }, modifier = Modifier.heightIn(min = 48.dp), onClick = { onSelect(word); expanded = false }) }
        }
    }
}

@Composable
private fun NamePicker(m: GameModel, name: String, onChange: (String) -> Unit) {
    val parts = name.split(' ', limit = 2)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        WordChoice("First word", parts[0], m.online.firstWords, !m.online.busy, Modifier.weight(1f)) { onChange("$it ${parts.getOrElse(1) { "Cove" }}") }
        WordChoice("Second word", parts.getOrElse(1) { "Cove" }, m.online.secondWords, !m.online.busy, Modifier.weight(1f)) { onChange("${parts[0]} $it") }
    }
}

@Composable
fun AuthScreen(m: GameModel, destination: Route?) {
    val o = m.online
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    if (BuildConfig.ONLINE_DEMO) {
        var previewName by rememberSaveable { mutableStateOf("Quiet Cove") }
        OnlinePage(m, "Your Online preview", "No backend or internet connection needed") {
            Label("Explore a world of your own", 24.sp, serif = true)
            Label("These players and worlds are examples. Publishing, play, and XP are saved only on this device. Real accounts use the separate service build.", 14.sp, color = LocalPalette.current.muted)
            OnlineField("Nickname", previewName, enabled = !o.busy) { previewName = it.take(128) }
            Label("Choose your own nickname. Names are unique, ignoring letter case.", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Enter local preview", primary = true, enabled = !o.busy) { o.login("preview@insight.local", previewName, destination) }
        }
        return
    }
    var mode by rememberSaveable { mutableStateOf(if (o.user?.verified == false) "verify" else "login") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var registrationError by remember(email, password, name, mode) { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { try { o.vocabulary() } catch (error: Exception) { o.report(error) } }
    LaunchedEffect(o.user?.verified) { if (o.user?.verified == false) mode = "verify" }
    OnlinePage(m, when (mode) { "register" -> "Make yourself at home"; "verify" -> "Verify email"; "recover" -> "Recover account"; else -> "Log in" }, "INSIGHT Online · Private test", messages = false) {
        if (!o.repository.client.configured) Label("This build needs an Online service address before you can log in.", 14.sp)
        if (o.emailDeliveryMode == "test-inbox") Label("Private test: email codes go to the operator's private inbox. Use your supplied verified test account, or ask the operator for your code.", 14.sp, color = LocalPalette.current.muted)
        if (mode == "login" || mode == "register") Tabs(listOf("login" to "Log in", "register" to "Register"), mode) { if (!o.busy) { mode = it; password = ""; o.clearMessages() } }
        OnlineField("Email", email, keyboard = KeyboardType.Email, enabled = !o.busy) { email = it.take(254) }
        if (mode in listOf("login", "register", "recover")) {
            OnlineField(when (mode) { "recover" -> "New password (12–128 characters)"; "register" -> "Password (12–128 characters)"; else -> "Password" }, password, password = true, enabled = !o.busy) { password = it.take(128) }
        }
        if (mode == "register") {
            OnlineField("Nickname", name, enabled = !o.busy) { name = it.take(128) }
            Label("Choose your own nickname (1–32 characters). Names are unique, ignoring letter case.", 12.sp, color = LocalPalette.current.muted)
            registrationError?.let { Label(it, 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = LocalPalette.current.accent) }
            OnlineMessages(m)
            MenuButton("Create account", primary = true, enabled = !o.busy) {
                registrationError = when {
                    email.isBlank() -> "Enter your email address."
                    password.length < 12 -> "Choose a password with at least 12 characters."
                    !Nicknames.valid(name) -> Nicknames.REQUIREMENT
                    else -> null
                }
                if (registrationError == null) {
                    focus.clearFocus(); keyboard?.hide()
                    o.register(email, password, Nicknames.normalize(name)) { mode = "verify"; password = "" }
                }
            }
        } else if (mode == "login") {
            OnlineMessages(m)
            MenuButton("Log in", primary = true, enabled = !o.busy && email.isNotBlank() && password.isNotBlank()) {
                focus.clearFocus(); keyboard?.hide()
                o.login(email, password, destination) { password = "" }
            }
            MenuButton("Forgot password?", enabled = !o.busy) { mode = "recover"; password = ""; code = ""; o.clearMessages() }
            MenuButton("I have a verification code", enabled = !o.busy) { mode = "verify"; password = ""; o.clearMessages() }
        } else {
            OnlineField("Eight-digit email code", code, keyboard = KeyboardType.Number, enabled = !o.busy) { code = it.filter(Char::isDigit).take(8) }
            OnlineMessages(m)
            MenuButton(if (mode == "recover") "Change password" else "Verify email", primary = true,
                enabled = !o.busy && code.length == 8 && email.isNotBlank() && (mode != "recover" || password.length >= 12)) {
                focus.clearFocus(); keyboard?.hide()
                val secret = if (mode == "recover") password else null
                o.confirm(email, code, secret, destination) { mode = "login"; code = ""; password = "" }
            }
            MenuButton("Request email code", enabled = !o.busy && email.isNotBlank()) { o.requestCode(email, mode == "recover") }
            MenuButton("Back to login", enabled = !o.busy) { mode = "login"; code = ""; password = ""; o.clearMessages() }
        }
        if (o.user != null) MenuButton("Log out", enabled = !o.busy) { o.logout() }
    }
}

/** Cached data remains visible when refreshing fails; retry always stays explicit. */
@Composable
private fun Remote(m: GameModel, path: String, refresh: Int = 0, content: @Composable (JSONObject, () -> Unit) -> Unit) {
    val account = m.online.user?.id ?: return
    var data by remember(path, account) { mutableStateOf<JSONObject?>(null) }
    var loading by remember(path, account) { mutableStateOf(true) }
    var revision by remember(path, account) { mutableIntStateOf(0) }
    LaunchedEffect(path, account, refresh, revision) {
        loading = true
        try {
            data = m.online.repository.cached(account, path)
            data = m.online.repository.fetch(path, account)
        } catch (error: Exception) { m.online.report(error) }
        finally { loading = false }
    }
    if (loading) Label("Loading…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    data?.let { content(it) { revision++ } }
    if (!loading) MenuButton("Refresh", enabled = !m.online.busy) { m.online.clearMessages(); revision++ }
}

private fun number(value: Int) = NumberFormat.getIntegerInstance().format(value)

@Composable
fun ProfileScreen(m: GameModel, requestedId: String?) {
    val account = m.online.user?.id ?: return
    val id = requestedId ?: account
    val own = id == account
    var revision by remember { mutableIntStateOf(0) }
    var editingWorld by remember { mutableStateOf<JSONObject?>(null) }
    var outcomes by remember(account) { mutableStateOf(emptyList<OnlineDatabase.Pending>()) }
    LaunchedEffect(account, revision) { outcomes = m.online.repository.outcomes(account) }
    OnlinePage(m, if (own) "Your profile" else "Player profile") {
        Remote(m, "/v1/profiles/$id", revision) { profile, _ ->
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
            }
            InfoRow("Worlds created", number(profile.getInt("worldCount")))
            InfoRow("Grids designed", number(profile.getInt("gridCount")))
            InfoRow("Grids beaten", number(profile.getInt("beatenCount")))
            Label("${number(profile.getInt("campaignCount"))} campaign · ${number(profile.getInt("communityCount"))} community", 12.sp, color = LocalPalette.current.muted)
            SectionTitle("Achievements unlocked")
            val badges = profile.getJSONArray("badges").strings().toSet()
            if (badges.isEmpty()) Label("Your collection begins with your first campaign solve.", 14.sp)
            m.achievements.catalog.filter { it.id in badges }.forEach { badge -> InfoRow(badge.name, "Earned") }
        }
        if (own) {
            var nickname by rememberSaveable(account) { mutableStateOf(m.online.user?.username.orEmpty()) }
            OnlineField("Nickname", nickname, enabled = !m.online.busy) { nickname = it.take(128) }
            Label("1–32 characters · Unique, ignoring letter case", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Save nickname", enabled = !m.online.busy) { m.online.rename(nickname) { revision++ } }
            MenuButton("Sync progress", enabled = !m.online.busy) { m.online.task {
                m.online.flushProofs()
                if (!m.online.repository.sync()) throw java.io.IOException("Sync unavailable")
                m.mergeAccountProgress(m.online.repository.fetch("/v1/progress", account)); revision++
            } }
            if (outcomes.isNotEmpty()) {
                Label("${outcomes.count { it.state == "pending" }} pending submissions", 12.sp, color = LocalPalette.current.muted)
                outcomes.filter { it.state == "failed" }.forEach { Label("Submission needs attention: ${it.error}", 12.sp, color = LocalPalette.current.accent) }
            }
            SectionTitle("Unpublished drafts")
            Remote(m, "/v1/grids/drafts", revision) { json, _ ->
                val drafts = json.getJSONArray("items").objects()
                if (drafts.isEmpty()) Label("No unpublished grids.", 14.sp)
                drafts.forEach { draft -> MenuButton("Finish ${draft.getString("name")}", subtitle = "Private draft · ${draft.getString("code")}") {
                    m.online.task { m.online.repository.save(account, "publish-draft", draft); m.push(Route.Publish) }
                } }
            }
        }
        SectionTitle(if (own) "Your worlds" else "Published worlds")
        WorldListing(m, owner = if (own) null else id, mine = own, revision = revision, onManage = if (own) ({ editingWorld = it }) else null)
        if (own) {
            MenuButton("Create world", enabled = !m.online.busy) { editingWorld = JSONObject() }
            MenuButton("Log out", enabled = !m.online.busy) { m.online.logout() }
        }
    }
    editingWorld?.let { world -> WorldSheet(m, world.takeIf { it.has("id") }, { editingWorld = null }) { editingWorld = null; revision++ } }
}

@Composable
private fun WorldListing(m: GameModel, owner: String? = null, mine: Boolean = false, query: String = "", revision: Int = 0, onManage: ((JSONObject) -> Unit)? = null, onChoose: ((JSONObject) -> Unit)? = null) {
    val account = m.online.user?.id ?: return
    var page by remember(owner, mine, query, revision) { mutableIntStateOf(0) }
    var items by remember(owner, mine, query, revision) { mutableStateOf(emptyList<JSONObject>()) }
    var next by remember(owner, mine, query, revision) { mutableStateOf<Int?>(null) }
    var loading by remember { mutableStateOf(true) }
    var retry by remember { mutableIntStateOf(0) }
    LaunchedEffect(account, owner, mine, query, page, revision, retry) {
        loading = true
        val path = "/v1/worlds?page=$page&mine=$mine&query=${URLEncoder.encode(query, "UTF-8")}" + (owner?.let { "&owner=$it" } ?: "")
        try {
            val cached = m.online.repository.cached(account, path)
            if (cached != null) items = (if (page == 0) emptyList() else items) + cached.getJSONArray("items").objects()
            val json = m.online.repository.fetch(path, account)
            items = ((if (page == 0) emptyList() else items) + json.getJSONArray("items").objects()).distinctBy { it.getString("id") }
            next = if (json.isNull("nextPage")) null else json.getInt("nextPage")
        } catch (error: Exception) { m.online.report(error) }
        finally { loading = false }
    }
    if (!loading && items.isEmpty()) Label(if (mine) "Your first world starts here." else "No worlds found yet.", 14.sp)
    items.forEach { world ->
        val isFull = world.getInt("usedSlots") >= 20
        OnlineCard {
            Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clickable(role = Role.Button, enabled = onChoose == null || !isFull) {
                if (onChoose != null) onChoose(world) else m.push(Route.CommunityWorld(world.getString("id")))
            }, horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                TileIcon(world.getString("icon")[0], 40.dp, m.finish, Modifier.semantics { contentDescription = "${Art.NAME[world.getString("icon")[0]]} world icon" })
                Column(Modifier.weight(1f)) {
                    Label(world.getString("name"), 18.sp, serif = true)
                    Label(if (onChoose != null) "${world.getInt("usedSlots")} / 20 grids${if (isFull) " · Full" else " · Select world"}" else "${number(world.getInt("gridCount"))} grids · ${number(world.getInt("popularity"))} plays", 12.sp, color = LocalPalette.current.muted)
                    if (world.optBoolean("hidden")) Label("Hidden", 12.sp, color = LocalPalette.current.muted)
                    if (world.optBoolean("moderated")) Label("Unavailable · Contact the test operator", 12.sp, color = LocalPalette.current.muted)
                }
            }
            if (onChoose == null) MenuButton("By ${world.getString("username")}", fontSize = 12.sp) { m.push(Route.Profile(world.getString("ownerId"))) }
            if (onManage != null && !world.optBoolean("moderated")) MenuButton("Manage world", enabled = !m.online.busy) { onManage(world) }
        }
    }
    if (loading) Label("Loading worlds…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    if (!loading) {
        next?.let { following -> MenuButton("More worlds") { page = following } }
        MenuButton("Refresh worlds", enabled = !m.online.busy) { m.online.clearMessages(); retry++ }
    }
}

@Composable
fun BrowseScreen(m: GameModel) {
    var search by rememberSaveable { mutableStateOf("") }
    var query by rememberSaveable { mutableStateOf("") }
    OnlinePage(m, "Play", "Worlds from the INSIGHT community") {
        OnlineField("Search worlds or enter a grid code", search) { search = it.take(80) }
        MenuButton("Search", enabled = !m.online.busy) {
            if (Regex("^[A-Fa-f0-9]{16}$").matches(search.trim())) m.online.task {
                val account = m.online.user!!.id
                val grid = m.online.repository.fetch("/v1/grids/code/${search.trim().uppercase(Locale.ROOT)}", account).getJSONObject("grid")
                val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
                m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"))
            } else query = search.trim()
        }
        WorldListing(m, query = query)
    }
}

@Composable
fun CommunityWorldScreen(m: GameModel, id: String) {
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    var revision by remember { mutableIntStateOf(0) }
    OnlinePage(m, "World") {
        Remote(m, "/v1/worlds/$id/grids", revision) { json, _ ->
            val world = json.getJSONObject("world")
            Label(world.getString("name"), 24.sp, serif = true)
            MenuButton("By ${world.getString("username")}") { m.push(Route.Profile(world.getString("ownerId"))) }
            if (world.optBoolean("hidden")) Label("This world is hidden from other players.", 14.sp)
            val grids = json.getJSONArray("items").objects()
            if (grids.isEmpty()) Label("This world has no published grids yet.", 14.sp)
            grids.forEachIndexed { index, grid ->
                val completed = grid.optBoolean("completed") || grid.getString("id") in m.communityDone
                OnlineCard {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Label("${number(index + 1)} · ${grid.getString("name")}", 18.sp, Modifier.weight(1f), serif = true)
                        if (completed) Label("✓ Solved", 12.sp, Modifier.clip(RoundedCornerShape(12.dp)).background(LocalPalette.current.accent.copy(alpha = .12f)).padding(horizontal = 10.dp, vertical = 5.dp), color = LocalPalette.current.accent)
                    }
                    TargetMini(Rules.crop(grid.board("target")), 16.dp, 3.dp, Modifier.semantics { contentDescription = "Grid target arrangement" })
                    val unavailable = grid.optBoolean("hidden") || grid.optBoolean("moderated") || world.optBoolean("hidden") || world.optBoolean("moderated")
                    if (unavailable) Label("Hidden or unavailable", 12.sp, color = LocalPalette.current.muted)
                    MenuButton(if (completed) "Play again" else "Play grid", enabled = !m.online.busy && !unavailable) { m.online.task {
                        val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
                        m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"))
                    } }
                    if (grid.getString("ownerId") == m.online.user?.id && !grid.optBoolean("moderated")) MenuButton("Manage grid", enabled = !m.online.busy) { editing = grid }
                }
            }
        }
    }
    editing?.let { grid -> GridSheet(m, grid, { editing = null }) { editing = null; revision++ } }
}

@Composable
private fun IconPicker(m: GameModel, icon: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Rules.TYPES.chunked(3).forEach { group ->
       Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        group.forEach { type ->
            Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).border(if (icon == type.toString()) 2.dp else 1.dp,
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
private fun WorldSheet(m: GameModel, existing: JSONObject?, dismiss: () -> Unit, saved: (JSONObject) -> Unit) {
    var name by remember { mutableStateOf(existing?.getString("name") ?: "Quiet Cove") }
    var icon by remember { mutableStateOf(existing?.getString("icon") ?: "B") }
    var hidden by remember { mutableStateOf(existing?.optBoolean("hidden") ?: false) }
    Overlay(if (existing == null) "Create world" else "Manage world", { if (!m.online.busy) dismiss() }) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label(if (existing == null) "A world of your own" else "Manage world", 24.sp, serif = true)
            OnlineMessages(m)
            NamePicker(m, name) { name = it }
            IconPicker(m, icon) { icon = it }
            if (existing != null) ToggleRow("Hide world", hidden) { if (!m.online.busy) hidden = it }
            MenuButton("Save world", primary = true, enabled = !m.online.busy) { m.online.task {
                val body = JSONObject().put("name", name).put("icon", icon)
                val response = if (existing == null) m.online.repository.command("new-world", "POST", "/v1/worlds", body) else
                    m.online.repository.command("world:${existing.getString("id")}", "PATCH", "/v1/worlds/${existing.getString("id")}", body.put("hidden", hidden))
                saved(if (existing == null) response else existing)
            } }
            MenuButton("Cancel", enabled = !m.online.busy, onClick = dismiss)
        }
    }
}

@Composable
private fun GridSheet(m: GameModel, grid: JSONObject, dismiss: () -> Unit, saved: () -> Unit) {
    var name by remember { mutableStateOf(grid.getString("name")) }
    var hidden by remember { mutableStateOf(grid.optBoolean("hidden")) }
    Overlay("Manage grid", { if (!m.online.busy) dismiss() }) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label("Manage grid", 24.sp, serif = true)
            OnlineMessages(m)
            NamePicker(m, name) { name = it }
            ToggleRow("Hide grid", hidden) { if (!m.online.busy) hidden = it }
            Label("Published arrangements stay fixed. Hiding keeps the grid's place in its world.", 12.sp, color = LocalPalette.current.muted)
            MenuButton("Save", primary = true, enabled = !m.online.busy) { m.online.task {
                m.online.repository.command("grid:${grid.getString("id")}", "PATCH", "/v1/grids/${grid.getString("id")}", JSONObject().put("name", name).put("hidden", hidden)); saved()
            } }
            MenuButton("Cancel", enabled = !m.online.busy, onClick = dismiss)
        }
    }
}

@Composable
fun PublishScreen(m: GameModel) {
    val account = m.online.user?.id ?: return
    val context = LocalContext.current
    var name by rememberSaveable { mutableStateOf("Quiet Cove") }
    var draft by remember { mutableStateOf<JSONObject?>(null) }
    var published by rememberSaveable { mutableStateOf(false) }
    var creatingWorld by remember { mutableStateOf(false) }
    var worldRevision by remember { mutableIntStateOf(0) }
    LaunchedEffect(account) { draft = m.online.repository.cached(account, "publish-draft") }
    OnlinePage(m, if (published) "Yours to share" else "Publish grid") {
        if (m.dev) { Label("Turn off Dev Mode in Options before publishing grids or earning XP.", 14.sp); return@OnlinePage }
        val current = draft
        if (current == null) {
            Label("Give your grid a name", 24.sp, serif = true)
            NamePicker(m, name) { name = it }
            if (m.creator.solved) MenuButton("Continue", primary = true, enabled = !m.online.busy) { m.online.task {
                val body = JSONObject().put("name", name).put("start", org.json.JSONArray(m.creator.start!!)).put("target", org.json.JSONArray(m.creator.target!!)).put("path", m.creator.proof.jsonMoves())
                val response = m.online.repository.command("new-draft", "POST", "/v1/grids/drafts", body)
                m.online.repository.save(account, "publish-draft", response); draft = response
            } } else Label("Return to Create and solve your check grid before publishing.", 14.sp)
        } else {
            Label(current.getString("name"), 24.sp, serif = true)
            InfoRow("Grid code", current.getString("code"))
            if (!published) {
                Label("Private draft · Your code becomes playable after publication.", 12.sp, color = LocalPalette.current.muted)
                SectionTitle("Choose a world")
                WorldListing(m, mine = true, revision = worldRevision, onChoose = { world -> m.online.task {
                    m.online.repository.command("publish:${current.getString("id")}", "POST", "/v1/grids/${current.getString("id")}/publish", JSONObject().put("worldId", world.getString("id")))
                    published = true; m.online.repository.remove(account, "publish-draft")
                } })
                MenuButton("Create a new world", enabled = !m.online.busy) { creatingWorld = true }
                MenuButton("Save draft for later", enabled = !m.online.busy) { m.back() }
            } else {
                Label("Your grid is published. When its world is visible, other players can find it or use its code.", 14.sp)
                MenuButton("Copy code", primary = true) {
                    (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("INSIGHT grid code", current.getString("code")))
                }
                MenuButton("Share code") { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "Play ${current.getString("name")} in INSIGHT: ${current.getString("code")}"), "Share grid")) }
                MenuButton("View profile") { m.back(); m.push(Route.Profile()) }
            }
        }
    }
    if (creatingWorld) WorldSheet(m, null, { creatingWorld = false }) { creatingWorld = false; worldRevision++ }
}
