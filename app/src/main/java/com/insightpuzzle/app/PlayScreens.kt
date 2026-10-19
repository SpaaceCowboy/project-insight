package com.insightpuzzle.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.net.URLEncoder
import java.text.NumberFormat
import java.util.Locale

/** Lives with GameModel so navigation and configuration changes do not reset discovery. */
class DiscoveryListState(defaultSort: String) {
    var query by mutableStateOf("")
    var sort by mutableStateOf(defaultSort)
    var period by mutableStateOf("all")
    var requestedPage by mutableIntStateOf(0)
    var revision by mutableIntStateOf(0)
    var items by mutableStateOf(emptyList<JSONObject>())
    var nextPage by mutableStateOf<Int?>(null)
    var loading by mutableStateOf(false)
    var failed by mutableStateOf(false)
    var loadedKey: String? = null
    var loadedPage = -1
    var loadedRevision = -1
    var requestToken: Any? = null
    val scroll = LazyListState()
    fun refresh() { requestedPage = 0; revision++ }
}
class PlayWorldState {
    var query by mutableStateOf("")
    var data by mutableStateOf<JSONObject?>(null)
    var revision by mutableIntStateOf(0)
    var scroll = androidx.compose.foundation.ScrollState(0)
}
class PlayDiscoveryState {
    var tab by mutableStateOf("worlds")
    var worlds by mutableStateOf(DiscoveryListState("popular")); private set
    var creators by mutableStateOf(DiscoveryListState("level")); private set
    private val worldStates = mutableMapOf<String, PlayWorldState>()
    fun world(id: String) = worldStates.getOrPut(id) { PlayWorldState() }
    fun refreshWorld(id: String) { world(id).revision++ }
    fun clear() { tab = "worlds"; worlds = DiscoveryListState("popular"); creators = DiscoveryListState("level"); worldStates.clear() }
}

private fun formatted(value: Int) = NumberFormat.getIntegerInstance().format(value)
private val worldSorts = listOf("popular" to "Most played", "newest" to "Newest")
private val creatorSorts = listOf("level" to "Highest level", "designed" to "Most levels designed", "played" to "Most levels played")
private val periods = listOf("all" to "All time", "today" to "Today", "week" to "This week", "month" to "This month", "year" to "This year")

@Composable
private fun PlaySearch(value: String, placeholder: String, modifier: Modifier = Modifier, submit: () -> Unit = {}, change: (String) -> Unit) {
    val p = LocalPalette.current
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    OutlinedTextField(value, { change(it.take(80)) }, modifier.heightIn(min = 56.dp), singleLine = true,
        label = { Label(placeholder, 12.sp) },
        trailingIcon = if (value.isNotEmpty()) ({ IconButton(onClick = { change("") }, modifier = Modifier.size(48.dp).semantics { contentDescription = "Clear search" }) { Label("×", 22.sp) } }) else null,
        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); keyboard?.hide(); submit() }),
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink, focusedBorderColor = p.accent,
            unfocusedBorderColor = p.line, cursorColor = p.accent, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverySort(state: DiscoveryListState, worlds: Boolean, dismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = LocalPalette.current.paper2, contentColor = LocalPalette.current.ink) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Label(if (worlds) "Sort worlds" else "Sort creators", 24.sp, Modifier.semantics { heading() }, serif = true)
            (if (worlds) worldSorts else creatorSorts).forEach { (id, name) ->
                MenuButton(if (state.sort == id) "✓ $name" else name, Modifier.semantics { selected = state.sort == id }, height = 52.dp) {
                    state.sort = id; state.requestedPage = 0
                }
            }
            if (worlds) {
                Label("Created", 18.sp, Modifier.padding(top = 8.dp).semantics { heading() }, serif = true)
                periods.forEach { (id, name) ->
                    MenuButton(if (state.period == id) "✓ $name" else name, Modifier.semantics { selected = state.period == id }, height = 48.dp) {
                        state.period = id; state.requestedPage = 0
                    }
                }
                Label("Calendar dates in UTC · Weeks start Monday", 12.sp, color = LocalPalette.current.muted)
            }
            MenuButton("Done", primary = true, onClick = dismiss)
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
fun BrowseScreen(m: GameModel) {
    val account = m.online.user?.id ?: return
    val discovery = m.playDiscovery
    val worlds = discovery.tab == "worlds"
    val state = if (worlds) discovery.worlds else discovery.creators
    var sorting by remember { mutableStateOf(false) }
    val key = if (worlds) "/v1/worlds?query=${URLEncoder.encode(state.query.trim(), "UTF-8")}&sort=${state.sort}&period=${state.period}" else
        "/v1/creators?query=${URLEncoder.encode(state.query.trim(), "UTF-8")}&sort=${state.sort}"
    LaunchedEffect(account, key, state.requestedPage, state.revision) {
        delay(300)
        val page = state.requestedPage
        if (state.loadedKey == key && state.loadedPage >= page && state.loadedRevision == state.revision) return@LaunchedEffect
        val changed = state.loadedKey != key || state.loadedRevision != state.revision
        val requested = if (changed) 0 else page
        if (changed) {
            state.scroll.scrollToItem(0)
            if (state.loadedKey != key) { state.items = emptyList(); state.nextPage = null }
            state.loadedPage = -1
        }
        val token = Any(); state.requestToken = token
        state.loading = true; state.failed = false
        val url = "$key&page=$requested"
        try {
            val cached = m.online.repository.cached(account, url)
            if (cached != null && requested == 0) state.items = cached.getJSONArray("items").objects()
            val response = m.online.repository.fetch(url, account)
            state.items = ((if (requested == 0) emptyList() else state.items) + response.getJSONArray("items").objects()).distinctBy { it.getString("id") }
            state.nextPage = if (response.isNull("nextPage")) null else response.getInt("nextPage")
            state.loadedKey = key; state.loadedPage = requested; state.loadedRevision = state.revision
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            if (state.requestToken === token) { state.failed = true; m.online.report(error) }
        }
        finally { if (state.requestToken === token) state.loading = false }
    }
    Page("Find", 560.dp) {
        Column(Modifier.fillMaxSize().imePadding(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PlaySearch(state.query, if (worlds) "Search worlds or enter a grid code" else "Search creators", Modifier.weight(1f), submit = {
                    if (worlds && Regex("^[A-Fa-f0-9]{16}$").matches(state.query.trim())) m.online.task {
                        val grid = m.online.repository.fetch("/v1/grids/code/${state.query.trim().uppercase(Locale.ROOT)}", account).getJSONObject("grid")
                        val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
                        m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"))
                    }
                }) { state.query = it; state.requestedPage = 0 }
                IconButton(onClick = { sorting = true }, modifier = Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(LocalPalette.current.paper)
                    .border(2.dp, LocalPalette.current.line, RoundedCornerShape(14.dp)).semantics { contentDescription = if (worlds) "Sort worlds and filter creation dates" else "Sort creators" }) { Label("↕", 24.sp) }
            }
            Tabs(listOf("worlds" to "Worlds", "creators" to "Creators"), discovery.tab) { discovery.tab = it }
            Label((if (worlds) worldSorts else creatorSorts).first { it.first == state.sort }.second +
                if (worlds) " · ${periods.first { it.first == state.period }.second}" else "", 12.sp, color = LocalPalette.current.muted)
            OnlineMessages(m)
            LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = state.scroll, verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                itemsIndexed(state.items, key = { _, row -> row.getString("id") }) { index, row ->
                    DiscoveryRow(m, index + 1, row, worlds)
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (state.loading) Label("Loading…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                        else {
                            if (state.items.isEmpty()) Label(if (state.failed) "The list could not be loaded. Please retry." else if (state.query.isNotBlank()) "No ${if (worlds) "worlds" else "creators"} match your search." else "No ${if (worlds) "worlds" else "creators"} found for these settings.", 14.sp)
                            if (!state.failed) state.nextPage?.let { page -> MenuButton("Load more", enabled = !m.online.busy) { state.requestedPage = page } }
                            MenuButton(if (state.failed) "Retry" else "Refresh", enabled = !m.online.busy) { m.online.clearMessages(); state.refresh() }
                        }
                    }
                }
            }
        }
    }
    if (sorting) DiscoverySort(state, worlds) { sorting = false }
}

@Composable
private fun DiscoveryRow(m: GameModel, rank: Int, row: JSONObject, world: Boolean) {
    OnlineCard {
        Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).clickable(role = Role.Button) {
            m.push(if (world) Route.CommunityWorld(row.getString("id")) else Route.Profile(row.getString("id")))
        }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Label(formatted(rank), 14.sp, color = LocalPalette.current.muted)
            if (world) TileIcon(row.getString("icon")[0], 36.dp, m.finish)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Label(row.getString(if (world) "name" else "username"), 19.sp, serif = true)
                Label(if (world) "${formatted(row.getInt("gridCount"))} levels · ${formatted(row.getInt("popularity"))} plays" else
                    "Level ${formatted(row.getInt("level"))} · ${formatted(row.getInt("gridCount"))} designed · ${formatted(row.getInt("beatenCount"))} solved", 12.sp, color = LocalPalette.current.muted)
            }
        }
        if (world) MenuButton("By ${row.getString("username")}", fontSize = 12.sp) { m.push(Route.Profile(row.getString("ownerId"))) }
    }
}

@Composable
fun CommunityWorldScreen(m: GameModel, id: String) {
    val account = m.online.user?.id ?: return
    val state = m.playDiscovery.world(id)
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var filter by remember { mutableStateOf(state.query.trim()) }
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(state.query) { delay(300); filter = state.query.trim() }
    LaunchedEffect(account, id, state.revision) {
        loading = true; failed = false
        try {
            m.online.repository.cached(account, "/v1/worlds/$id/grids")?.let { state.data = it }
            state.data = m.online.repository.fetch("/v1/worlds/$id/grids", account)
        } catch (error: Exception) { if (error is kotlinx.coroutines.CancellationException) throw error; failed = true; m.online.report(error) }
        finally { loading = false }
    }
    val worldName = state.data?.getJSONObject("world")?.getString("name") ?: "World"
    Page(worldName, 560.dp) {
        Column(Modifier.fillMaxSize().imePadding(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label(worldName, 24.sp, Modifier.semantics { heading() }, serif = true)
            PlaySearch(state.query, "Search levels in this world", Modifier.fillMaxWidth()) { state.query = it }
            OnlineMessages(m)
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(state.scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.data?.let { json ->
                    val w = json.getJSONObject("world")
                    MenuButton("By ${w.getString("username")}") { m.push(Route.Profile(w.getString("ownerId"))) }
                    if (w.optBoolean("hidden")) Label("This world is hidden from other players.", 14.sp)
                    val grids = json.getJSONArray("items").objects().withIndex().filter { it.value.getString("name").contains(filter, ignoreCase = true) }
                    if (grids.isEmpty()) Label(if (filter.isNotBlank()) "No levels match your search." else "This world has no published levels yet.", 14.sp)
                    grids.forEach { (index, grid) ->
                        val completed = grid.optBoolean("completed") || grid.getString("id") in m.communityDone
                        OnlineCard {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Label("${formatted(grid.optInt("levelNumber", index + 1))} · ${grid.getString("name")}", 18.sp, Modifier.weight(1f), serif = true)
                                if (completed) Label("✓ Solved", 12.sp, color = LocalPalette.current.accent)
                            }
                            TargetMini(Rules.crop(grid.board("target")), 16.dp, 3.dp, Modifier.semantics { contentDescription = "Level target arrangement" })
                            Label("Beaten by ${formatted(grid.optInt("beatenCount"))} players · ${formatted(grid.optInt("failedAttemptCount"))} failed attempts", 12.sp, color = LocalPalette.current.muted)
                            val unavailable = grid.optBoolean("hidden") || grid.optBoolean("moderated") || w.optBoolean("hidden") || w.optBoolean("moderated")
                            if (unavailable) Label("Hidden or unavailable", 12.sp)
                            MenuButton(if (completed) "Play again" else "Play", enabled = !m.online.busy && !unavailable) { m.online.task {
                                val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
                                m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"))
                            } }
                            if (grid.getString("ownerId") == account && !grid.optBoolean("moderated")) MenuButton("Manage grid", enabled = !m.online.busy) { editing = grid }
                        }
                    }
                }
                if (loading) Label("Loading levels…", 14.sp, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                else {
                    if (failed && state.data == null) Label("Levels could not be loaded. Please retry.", 14.sp)
                    MenuButton(if (failed) "Retry" else "Refresh", enabled = !m.online.busy) { m.online.clearMessages(); state.revision++ }
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
    editing?.let { grid -> GridSheet(m, grid, { editing = null }) { editing = null; state.revision++ } }
}

@Composable
fun CasualScreen(m: GameModel) {
    LaunchedEffect(m.online.user?.id) {
        // Authentication activation may still be synchronizing when this screen opens.
        while (m.online.busy) delay(50)
        if (!m.casualRequested) m.nextCasual()
    }
    Page("Play", 560.dp) {
        OnlineMessages(m)
        Label(if (m.online.busy) "Loading a level…" else if (m.casualEmpty) "No community levels are available yet." else "Ready to find another level?", 16.sp)
        MenuButton("Retry", enabled = !m.online.busy) { m.nextCasual() }
    }
}
