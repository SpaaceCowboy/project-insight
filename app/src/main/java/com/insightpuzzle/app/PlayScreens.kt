package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.net.URLEncoder
import java.text.NumberFormat
import java.util.Locale

/** Account-scoped navigation state, retained while visiting a profile or playing a puzzle. */
class DiscoveryListState(defaultSort: String) {
    var query by mutableStateOf("")
    var sort by mutableStateOf(defaultSort)
    var period by mutableStateOf("all")
    var requestedPage by mutableIntStateOf(0)
    var revision by mutableIntStateOf(0)
    var items by mutableStateOf(emptyList<JSONObject>())
    var nextPage by mutableStateOf<Int?>(null)
    var loading by mutableStateOf(false)
    /** A pull-to-refresh is waiting for its load to finish. */
    var pulling by mutableStateOf(false)
    var failed by mutableStateOf(false)
    var loadedKey: String? = null
    var loadedPage = -1
    var loadedRevision = -1
    var requestToken: Any? = null
    val scroll = LazyListState()
    /** The current list has finished loading at least once (or failed), so an empty list really is empty. */
    val settled get() = failed || loadedPage >= 0
    fun refresh() { requestedPage = 0; revision++ }
    fun pull() { pulling = true; refresh() }
}
class PlayDiscoveryState {
    var tab by mutableStateOf("puzzles")
    var puzzles by mutableStateOf(DiscoveryListState("popular")); private set
    var creators by mutableStateOf(DiscoveryListState("level")); private set
    private val collections = mutableMapOf<String, DiscoveryListState>()
    fun collection(owner: String) = collections.getOrPut(owner) { DiscoveryListState("number") }
    /** Your own bookmarked puzzles, shown on your profile. */
    var bookmarks by mutableStateOf(DiscoveryListState("bookmarked")); private set
    /** Whom you follow, and who follows you. */
    var following by mutableStateOf(DiscoveryListState("level")); private set
    var followers by mutableStateOf(DiscoveryListState("level")); private set
    fun refresh() { puzzles.refresh(); creators.refresh(); bookmarks.refresh(); following.refresh(); followers.refresh(); collections.values.forEach { it.refresh() } }
    fun clear() {
        tab = "puzzles"; puzzles = DiscoveryListState("popular"); creators = DiscoveryListState("level"); bookmarks = DiscoveryListState("bookmarked")
        following = DiscoveryListState("level"); followers = DiscoveryListState("level"); collections.clear()
    }
}

internal fun formatted(value: Int) = NumberFormat.getIntegerInstance().format(value)
private val puzzleSorts = listOf("popular" to "Most played", "newest" to "Newest", "liked" to "Most popular")
private val creatorSorts = listOf("level" to "Highest level", "designed" to "Most puzzles designed", "played" to "Most puzzles played", "liked" to "Most popular puzzles")
private val periods = listOf("all" to "All time", "today" to "Today", "week" to "This week", "month" to "This month", "year" to "This year")

@Composable
internal fun PlaySearch(value: String, placeholder: String, modifier: Modifier = Modifier, submit: () -> Unit = {}, change: (String) -> Unit) {
    val p = LocalPalette.current
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val feedback = LocalFeedback.current
    OutlinedTextField(value, { change(it.take(80)) }, modifier.heightIn(min = 56.dp), singleLine = true,
        label = { Label(placeholder, 12.sp) },
        trailingIcon = if (value.isNotEmpty()) ({ IconButton(onClick = { feedback(Cue.PRESS); change("") }, modifier = Modifier.size(48.dp).semantics { contentDescription = "Clear search" }) { Label("×", 22.sp) } }) else null,
        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); keyboard?.hide(); submit() }),
        shape = RoundedCornerShape(18.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink,
            focusedBorderColor = p.accent, unfocusedBorderColor = p.line, cursorColor = p.accent, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted))
}

@Composable
internal fun LoadDiscovery(m: GameModel, state: DiscoveryListState, key: String, resetScroll: Boolean = true) {
    val account = m.online.user?.id ?: return
    LaunchedEffect(account, key, state.requestedPage, state.revision) {
        delay(300)
        val page = state.requestedPage
        if (state.loadedKey == key && state.loadedPage >= page && state.loadedRevision == state.revision) return@LaunchedEffect
        val changed = state.loadedKey != key || state.loadedRevision != state.revision
        val requested = if (changed) 0 else page
        if (changed) {
            if (resetScroll) state.scroll.scrollToItem(0)
            if (state.loadedKey != key) { state.items = emptyList(); state.nextPage = null }
            state.loadedPage = -1
        }
        val token = Any(); state.requestToken = token; state.loading = true; state.failed = false
        val url = key + (if ('?' in key) "&" else "?") + "page=$requested"
        try {
            val cached = m.online.repository.cached(account, url)
            if (cached != null && requested == 0) state.items = cached.getJSONArray("items").objects()
            val response = m.online.repository.fetch(url, account)
            state.items = ((if (requested == 0) emptyList() else state.items) + response.getJSONArray("items").objects()).distinctBy { it.getString("id") }
            state.nextPage = if (response.isNull("nextPage")) null else response.getInt("nextPage")
            state.loadedKey = key; state.loadedPage = requested; state.loadedRevision = state.revision
            m.online.offline = false
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            if (state.requestToken === token) { state.failed = true; m.online.quiet(error) }
        } finally { if (state.requestToken === token) { state.loading = false; state.pulling = false } }
    }
}

internal fun playPuzzle(m: GameModel, grid: JSONObject, source: DiscoveryListState? = null) = m.online.task {
    val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
    m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"), source = source)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverySort(state: DiscoveryListState, puzzles: Boolean, openCode: () -> Unit, dismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = LocalPalette.current.paper2, contentColor = LocalPalette.current.ink) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlaySearch(state.query, if (puzzles) "Search creator or code" else "Search creators", Modifier.fillMaxWidth(), submit = openCode) { state.query = it; state.requestedPage = 0 }
            if (puzzles && Regex("^[A-Fa-f0-9]{16}$").matches(state.query.trim())) MenuButton("Open code") { dismiss(); openCode() }
            (if (puzzles) puzzleSorts else creatorSorts).forEach { (id, name) ->
                MenuButton(if (state.sort == id) "✓ $name" else name, Modifier.semantics { selected = state.sort == id }, height = 52.dp) { state.sort = id; state.requestedPage = 0 }
            }
            // Date filters: puzzle publication dates, or for creators the likes their puzzles received.
            if (puzzles || state.sort == "liked") {
                HorizontalDivider(Modifier.padding(vertical = 8.dp), color = LocalPalette.current.line)
                periods.forEach { (id, name) ->
                    MenuButton(if (state.period == id) "✓ $name" else name, Modifier.semantics { selected = state.period == id }, height = 48.dp) { state.period = id; state.requestedPage = 0 }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** Worlds: every community puzzle in a 4-column grid, or the players list. Options / Profile in the corners, split toggle-sort pill on top, Random and Create below. */
@Composable
fun WorldsScreen(m: GameModel) {
    val account = m.online.user?.id ?: return
    val discovery = m.playDiscovery
    val puzzles = discovery.tab == "puzzles"
    val state = if (puzzles) discovery.puzzles else discovery.creators
    var sorting by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<JSONObject?>(null) }
    val query = URLEncoder.encode(state.query.trim(), "UTF-8")
    val key = if (puzzles) "/v1/grids?query=$query&sort=${state.sort}&period=${state.period}" else "/v1/creators?query=$query&sort=${state.sort}" + if (state.sort == "liked") "&period=${state.period}" else ""
    LoadDiscovery(m, state, key)
    fun openCode() {
        if (puzzles && Regex("^[A-Fa-f0-9]{16}$").matches(state.query.trim())) m.online.task {
            val grid = m.online.repository.fetch("/v1/grids/code/${state.query.trim().uppercase(Locale.ROOT)}", account).getJSONObject("grid")
            val response = m.online.repository.command("play:${grid.getString("id")}", "POST", "/v1/grids/${grid.getString("id")}/sessions")
            m.startCommunity(response.getJSONObject("grid"), response.getString("sessionId"))
        }
    }
    Page("Worlds", 560.dp) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                HomeIconButton("Options", Modifier.align(Alignment.CenterStart).semantics { traversalIndex = -3f }, { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                SplitPill(puzzles, { discovery.tab = if (puzzles) "creators" else "puzzles" }, { sorting = true }, Modifier.align(Alignment.Center))
                HomeIconButton("Profile", Modifier.align(Alignment.CenterEnd).semantics { traversalIndex = -2f }, { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
                // No connection: a small red dot over the Profile icon; pulling the list down retries.
                if (m.online.offline) Box(Modifier.align(Alignment.TopEnd).padding(top = 4.dp, end = 10.dp).size(8.dp).clip(CircleShape).background(Color(0xFFE5484D))
                    .semantics { contentDescription = "Offline. Pull down to retry." })
            }
        }
        Spacer(Modifier.height(8.dp))
        OnlineMessages(m, errors = false)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (puzzles) PuzzleGrid(m, state, Modifier.fillMaxSize()) { detail = it }
            else Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.fillMaxSize()) { LazyColumn(Modifier.fillMaxSize(), state = state.scroll, verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(vertical = 8.dp)) {
                itemsIndexed(state.items, key = { _, row -> row.getString("id") }) { _, row -> PlayerRow(m, row) }
                item { DiscoveryFooter(m, state) }
            } }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MenuButton("Random", Modifier.weight(1f), height = 56.dp, enabled = !m.online.busy) { m.startRandom() }
            MenuButton("Create", Modifier.weight(1f), height = 56.dp) { m.push(Route.Create) }
        }
    }
    if (sorting) DiscoverySort(state, puzzles, ::openCode) { sorting = false }
    detail?.let { grid -> PuzzleDetails(m, grid) { detail = null } }
}

/** One line per player: name, then level, puzzles designed and puzzles solved. */
@Composable
internal fun PlayerRow(m: GameModel, row: JSONObject) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).clip(shape).background(p.paper).border(1.dp, p.line, shape)
        .clickable(role = Role.Button) { m.feedback(Cue.CHECK); m.push(Route.Profile(row.getString("id"))) }.padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Label(row.getString("username"), 17.sp, Modifier.weight(1f), serif = true, lines = 1)
        Label("Level ${formatted(row.getInt("level"))}", 12.sp, color = p.muted, lines = 1)
        Label("Designed ${formatted(row.getInt("gridCount"))}", 12.sp, color = p.muted, lines = 1)
        Label("Solved ${formatted(row.getInt("beatenCount"))}", 12.sp, color = p.muted, lines = 1)
    }
}

/** Two halves in one capsule: left switches between puzzles and players, right opens the sort sheet. */
@Composable
private fun SplitPill(puzzles: Boolean, toggle: () -> Unit, sort: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(24.dp)
    Row(modifier.height(48.dp).clip(shape).background(p.paper).border(2.dp, p.line, shape), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(64.dp).fillMaxHeight().clickable(role = Role.Button) { feedback(Cue.PRESS); toggle() }
            .semantics { contentDescription = if (puzzles) "Show players" else "Show puzzles" }, contentAlignment = Alignment.Center) {
            Canvas(Modifier.size(20.dp)) { if (puzzles) peopleIcon(this, p.ink) else gridIcon(this, p.ink) }
        }
        Box(Modifier.width(1.dp).height(24.dp).background(p.line))
        Box(Modifier.width(64.dp).fillMaxHeight().clickable(role = Role.Button) { feedback(Cue.PRESS); sort() }
            .semantics { contentDescription = if (puzzles) "Sort puzzles and filter creation dates" else "Sort creators" }, contentAlignment = Alignment.Center) { Label("↕", 24.sp) }
    }
}

/** End of a discovery list: empty and failed states once a load has finished, and Load more. Loading itself shows nothing. Refreshing is a pull down, not a button. */
@Composable
internal fun DiscoveryFooter(m: GameModel, state: DiscoveryListState, empty: String = "No results for these settings.") {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!state.loading) {
            // A failed load shows no text; the offline mark says so and pulling down retries.
            if (state.items.isEmpty() && state.settled && !state.failed) Label(empty, 14.sp)
            if (!state.failed) state.nextPage?.let { page -> MenuButton("Load more", enabled = !m.online.busy) { state.requestedPage = page } }
        }
    }
}
