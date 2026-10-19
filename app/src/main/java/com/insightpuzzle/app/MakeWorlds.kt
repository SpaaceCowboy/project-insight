package com.insightpuzzle.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

private const val WORLD_CAP = 20

/** What happens after Make: a panel of the player's worlds, a "Create a new world" button, and tap-a-world to add the level. */
@Composable
fun PublishScreen(m: GameModel) {
    if (m.online.user == null) return
    val p = LocalPalette.current
    val filter = NameFilter.get(LocalContext.current)
    var creating by rememberSaveable { mutableStateOf(false) }
    var worldName by rememberSaveable { mutableStateOf("") }
    var icon by rememberSaveable { mutableStateOf("B") }
    var revision by remember { mutableIntStateOf(0) }
    var added by remember { mutableStateOf<JSONObject?>(null) }
    BackHandler(enabled = creating && added == null) { creating = false }
    val canAdd = m.creator.solved
    val worldProblem = if (worldName.isBlank()) null else filter.problem(worldName)
    val shape = RoundedCornerShape(20.dp)

    Page(if (added != null) "Level added" else if (creating) "New world" else "Your worlds", 560.dp) {
        if (m.dev) { Label("Turn off Dev Mode in Options before publishing levels or earning XP.", 14.sp); return@Page }
        OnlineMessages(m)
        if (added == null && !creating) Label("Choose where your level goes", 14.sp, color = p.muted)
        Column(Modifier.weight(1f).fillMaxWidth().clip(shape).background(p.paper).border(1.dp, p.line, shape).padding(12.dp)) {
            val result = added
            when {
                result != null -> AddedPanel(m, result)
                creating -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Label("Name your world", 20.sp, serif = true)
                    OnlineField("World name", worldName, enabled = !m.online.busy) { worldName = it.take(64) }
                    Label(worldProblem ?: "1–32 characters. Respectful names only.", 12.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = if (worldProblem != null) p.accent else p.muted)
                    Label("Choose an icon", 14.sp, color = p.muted)
                    IconPicker(m, icon) { icon = it }
                }
                else -> {
                    if (!canAdd) Label("Return to Create and solve your check grid before adding a level.", 14.sp, Modifier.padding(bottom = 8.dp), color = p.accent)
                    MyWorlds(m, revision, canAdd) { world ->
                        m.online.task {
                            val response = m.online.repository.command("level-add:" + world.getString("id"), "POST", "/v1/worlds/" + world.getString("id") + "/levels", JSONObject()
                                .put("name", "").put("start", JSONArray(m.creator.start!!)).put("target", JSONArray(m.creator.target!!)).put("path", m.creator.proof.jsonMoves()))
                            added = JSONObject().put("code", response.getString("code")).put("levelNumber", response.getInt("levelNumber")).put("world", world.getString("name"))
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        when {
            added != null -> MenuButton("Done", primary = true) { m.back() }
            creating -> MenuButton("Create", primary = true, enabled = !m.online.busy && worldName.isNotBlank() && worldProblem == null) {
                m.online.task {
                    m.online.repository.command("new-world", "POST", "/v1/worlds", JSONObject().put("name", filter.normalize(worldName)).put("icon", icon))
                    worldName = ""; icon = "B"; creating = false; revision++
                }
            }
            else -> MenuButton("Create a new world", primary = true, enabled = !m.online.busy) { m.online.clearMessages(); creating = true }
        }
    }
}

@Composable
private fun MyWorlds(m: GameModel, revision: Int, enabled: Boolean, onChoose: (JSONObject) -> Unit) {
    val account = m.online.user?.id ?: return
    val p = LocalPalette.current
    var page by remember(revision) { mutableIntStateOf(0) }
    var items by remember(revision) { mutableStateOf(emptyList<JSONObject>()) }
    var next by remember(revision) { mutableStateOf<Int?>(null) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember(revision) { mutableStateOf(false) }
    var retry by remember { mutableIntStateOf(0) }
    LaunchedEffect(account, page, revision, retry) {
        loading = true; failed = false
        val path = "/v1/worlds?page=$page&mine=true&query="
        try {
            m.online.repository.cached(account, path)?.let { cached -> items = (if (page == 0) emptyList() else items) + cached.getJSONArray("items").objects() }
            val json = m.online.repository.fetch(path, account)
            items = ((if (page == 0) emptyList() else items) + json.getJSONArray("items").objects()).distinctBy { it.getString("id") }
            next = if (json.isNull("nextPage")) null else json.getInt("nextPage")
        } catch (error: Exception) { failed = true; m.online.report(error) }
        finally { loading = false }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!loading && items.isEmpty()) Label(if (failed) "Worlds could not be loaded. Please try again." else "Your worlds will appear here. Tap Create a new world to start.", 14.sp, color = p.muted)
        items.forEach { world ->
            val used = world.getInt("usedSlots"); val full = used >= WORLD_CAP; val unavailable = world.optBoolean("moderated")
            val usable = enabled && !full && !unavailable && !m.online.busy
            val rowShape = RoundedCornerShape(14.dp)
            Row(Modifier.fillMaxWidth().alpha(if (usable) 1f else .5f).heightIn(min = 64.dp).clip(rowShape).background(p.paper2).border(2.dp, p.line, rowShape)
                .clickable(role = Role.Button, enabled = usable) { onChoose(world) }.padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Label(world.getString("name"), 18.sp, serif = true)
                    val status = when { unavailable -> "Unavailable"; full -> "$used / $WORLD_CAP levels · Full"; else -> "$used / $WORLD_CAP levels" }
                    Label(if (world.optBoolean("hidden")) "$status · Hidden" else status, 12.sp, color = p.muted)
                }
                TileIcon(world.getString("icon")[0], 40.dp, m.finish, Modifier.semantics { contentDescription = "${Art.NAME[world.getString("icon")[0]]} world icon" })
            }
        }
        if (loading) Label("Loading worlds…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        next?.let { following -> if (!loading) MenuButton("More worlds") { page = following } }
        if (failed && !loading) MenuButton("Try again", enabled = !m.online.busy) { m.online.clearMessages(); retry++ }
    }
}

@Composable
private fun AddedPanel(m: GameModel, result: JSONObject) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Label("Level ${result.getInt("levelNumber")} added to ${result.getString("world")}", 22.sp, serif = true)
        InfoRow("Level code", result.getString("code"))
        Label("Other players can find it in the world, or use its code.", 14.sp, color = LocalPalette.current.muted)
        MenuButton("Copy code") {
            (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("INSIGHT level code", result.getString("code")))
        }
        MenuButton("Share code") {
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, "Play ${result.getString("world")} · Level ${result.getInt("levelNumber")} in INSIGHT: ${result.getString("code")}"), "Share level"))
        }
        MenuButton("View profile") { m.back(); m.push(Route.Profile()) }
    }
}
