package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
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
    /** The open page of the paged list; it survives leaving the screen. */
    var page by mutableIntStateOf(0)
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
    /** Whom you follow. */
    var following by mutableStateOf(DiscoveryListState("level")); private set
    fun refresh() { puzzles.refresh(); creators.refresh(); bookmarks.refresh(); following.refresh(); collections.values.forEach { it.refresh() } }
    fun clear() {
        tab = "puzzles"; puzzles = DiscoveryListState("popular"); creators = DiscoveryListState("level"); bookmarks = DiscoveryListState("bookmarked")
        following = DiscoveryListState("level"); collections.clear()
    }
}

internal fun formatted(value: Int) = NumberFormat.getIntegerInstance().format(value)
private val puzzleSorts = listOf("popular" to "Most played", "newest" to "Newest", "liked" to "Most popular")
private val creatorSorts = listOf("level" to "Highest level", "liked" to "Most popular puzzles")
private val periods = listOf("all" to "All time", "today" to "Today", "week" to "This week", "month" to "This month", "year" to "This year")

@Composable
internal fun PlaySearch(value: String, placeholder: String, modifier: Modifier = Modifier, submit: () -> Unit = {}, close: () -> Unit, change: (String) -> Unit) {
    val p = LocalPalette.current
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val feedback = LocalFeedback.current
    OutlinedTextField(value, { change(it.take(80)) }, modifier.heightIn(min = 56.dp), singleLine = true,
        label = { Label(placeholder, 12.sp) },
        // The cross closes the search bar (the keyboard clears the text).
        trailingIcon = { IconButton(onClick = { feedback(null); close() }, modifier = Modifier.size(48.dp).semantics { contentDescription = tr("Close search") }) { Label("×", 22.sp) } },
        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); keyboard?.hide(); submit() }),
        shape = RoundedCornerShape(18.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink,
            focusedBorderColor = p.accent, unfocusedBorderColor = p.line, cursorColor = p.accent, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted))
}

/** The request Worlds loads for the puzzles or players list as it is set now (the page is added by [LoadDiscovery]); the splash screen fetches the same one ahead of time. */
internal fun discoveryKey(puzzles: Boolean, state: DiscoveryListState): String {
    val query = URLEncoder.encode(state.query.trim(), "UTF-8")
    return if (puzzles) "/v1/grids?query=$query&sort=${state.sort}&period=${state.period}" else "/v1/creators?query=$query&sort=${state.sort}" + if (state.sort == "liked") "&period=${state.period}" else ""
}

@Composable
internal fun LoadDiscovery(m: GameModel, state: DiscoveryListState, key: String, resetScroll: Boolean = true) {
    val account = m.online.user?.id ?: return
    LaunchedEffect(account, key, state.requestedPage, state.revision) {
        // Only a changed query or sort waits (typing); entering the screen, pulling to refresh and the pages after the first load at once.
        if (state.loadedKey != null && state.loadedKey != key) delay(300)
        val page = state.requestedPage
        if (state.loadedKey == key && state.loadedPage >= page && state.loadedRevision == state.revision) return@LaunchedEffect
        val changed = state.loadedKey != key || state.loadedRevision != state.revision
        val requested = if (changed) 0 else page
        if (changed) {
            if (resetScroll) state.page = 0
            if (state.loadedKey != key) { state.items = emptyList(); state.nextPage = null }
            state.loadedPage = -1
        }
        val token = Any(); state.requestToken = token; state.loading = true; state.failed = false
        val url = key + (if ('?' in key) "&" else "?") + "page=$requested"
        try {
            val cached = m.online.repository.cached(account, url)
            // The saved first page fills an empty list at once; a refresh keeps the rows already shown until the fresh ones arrive.
            if (cached != null && requested == 0 && state.items.isEmpty()) state.items = cached.getJSONArray("items").objects()
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
private fun DiscoverySort(state: DiscoveryListState, puzzles: Boolean, dismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = LocalPalette.current.paper2, contentColor = LocalPalette.current.ink) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            (if (puzzles) puzzleSorts else creatorSorts).forEach { (id, name) ->
                MenuButton(if (state.sort == id) "✓ " + tr(name) else name, Modifier.semantics { selected = state.sort == id }, height = 52.dp) { state.sort = id; state.requestedPage = 0 }
            }
            // Date filters: puzzle publication dates, or for creators the likes their puzzles received. They rise out of the bottom of the sheet
            // when "Most popular puzzles" is chosen and sink back when "Highest level" is, instead of appearing at once.
            val motion = !LocalReduceMotion.current
            AnimatedVisibility(puzzles || state.sort == "liked",
                enter = if (motion) expandVertically(tween(320, easing = FastOutSlowInEasing), Alignment.Top) + fadeIn(tween(320)) else EnterTransition.None,
                exit = if (motion) shrinkVertically(tween(320, easing = FastOutSlowInEasing), Alignment.Top) + fadeOut(tween(200)) else ExitTransition.None) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HorizontalDivider(Modifier.padding(vertical = 8.dp), color = LocalPalette.current.line)
                    periods.forEach { (id, name) ->
                        MenuButton(if (state.period == id) "✓ " + tr(name) else name, Modifier.semantics { selected = state.period == id }, height = 48.dp) { state.period = id; state.requestedPage = 0 }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/**
 * Worlds' hidden search bar. Pulling down at the top of the list shows it first, so it wins over pull-to-refresh
 * (refresh starts once it is fully out); scrolling the list up hides it before the list moves. [pinned] keeps it out.
 */
class SearchReveal(val max: Float) {
    var height by mutableFloatStateOf(0f)
    var pinned = false
    val connection = object : androidx.compose.ui.input.nestedscroll.NestedScrollConnection {
        override fun onPreScroll(available: androidx.compose.ui.geometry.Offset, source: androidx.compose.ui.input.nestedscroll.NestedScrollSource): androidx.compose.ui.geometry.Offset {
            if (available.y >= 0f || height <= 0f || pinned) return androidx.compose.ui.geometry.Offset.Zero
            val used = maxOf(available.y, -height); height += used
            return androidx.compose.ui.geometry.Offset(0f, used)
        }
        override fun onPostScroll(consumed: androidx.compose.ui.geometry.Offset, available: androidx.compose.ui.geometry.Offset, source: androidx.compose.ui.input.nestedscroll.NestedScrollSource): androidx.compose.ui.geometry.Offset {
            if (available.y <= 0f || height >= max || source != androidx.compose.ui.input.nestedscroll.NestedScrollSource.UserInput) return androidx.compose.ui.geometry.Offset.Zero
            val used = minOf(available.y, max - height); height += used
            return androidx.compose.ui.geometry.Offset(0f, used)
        }
        // On release a half-shown bar settles open or shut.
        override suspend fun onPreFling(available: androidx.compose.ui.unit.Velocity): androidx.compose.ui.unit.Velocity {
            if (height > 0f && height < max) androidx.compose.animation.core.animate(height, if (height > max / 2) max else 0f) { v, _ -> height = v }
            return androidx.compose.ui.unit.Velocity.Zero
        }
    }
}

/** Worlds: every community puzzle in a 4-column grid, or the players list. Options / Back / Profile on top, the puzzles-players capsule and Sort under them, search hidden above the list, Random and Create below. */
@Composable
fun WorldsScreen(m: GameModel) {
    val account = m.online.user?.id ?: return
    val discovery = m.playDiscovery
    val puzzles = discovery.tab == "puzzles"
    val state = if (puzzles) discovery.puzzles else discovery.creators
    var sorting by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<DetailAnchor?>(null) }
    val density = androidx.compose.ui.platform.LocalDensity.current
    val reveal = remember(density) { SearchReveal(with(density) { 64.dp.toPx() }) }
    var searching by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    reveal.pinned = searching || state.query.isNotEmpty()
    /** Closes the search bar: the text goes, the keyboard goes, the bar slides back up. */
    fun closeSearch() {
        focus.clearFocus(); keyboard?.hide()
        if (state.query.isNotEmpty()) { state.query = ""; state.requestedPage = 0 }
        reveal.pinned = false
        scope.launch { androidx.compose.animation.core.animate(reveal.height, 0f) { v, _ -> reveal.height = v } }
    }
    // System Back first closes an open search bar; only then does it leave the screen.
    BackHandler(enabled = reveal.height > 0f || searching) { closeSearch() }
    LaunchedEffect(reveal) { if (state.query.isNotEmpty()) reveal.height = reveal.max }
    val key = discoveryKey(puzzles, state)
    LoadDiscovery(m, state, key)
    // A full level code is matched by the list itself (the server finds the level by its code), so Search only puts the keyboard away: the level shows up in the list and is opened from there.
    val search: @Composable () -> Unit = {
        Box(Modifier.fillMaxWidth().height(with(density) { reveal.height.toDp() }).clipToBounds(), contentAlignment = Alignment.BottomCenter) {
            if (reveal.height > 0f) PlaySearch(state.query, if (puzzles) "Search creator or code" else "Search creators", Modifier.fillMaxWidth().onFocusChanged { searching = it.isFocused },
                close = ::closeSearch) { state.query = it; state.requestedPage = 0 }
        }
    }
    Page("Worlds", 560.dp) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                HomeIconButton("Options", Modifier.align(Alignment.CenterStart).semantics { traversalIndex = -4f }, { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                BackChevron(m, Modifier.align(Alignment.Center).semantics { traversalIndex = -3f })
                Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
                    // No connection: the same crossed-out signal as Profile, left of the Profile icon; pulling the list down retries.
                    val muted = LocalPalette.current.muted
                    if (m.online.offline) Canvas(Modifier.padding(end = 10.dp).size(20.dp).semantics { contentDescription = tr("Offline. Pull down to retry.") }) { offlineIcon(muted) }
                    HomeIconButton("Profile", Modifier.semantics { traversalIndex = -2f }, { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
                }
            }
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                SplitPill(puzzles, { discovery.tab = if (it) "puzzles" else "creators" }, Modifier.align(Alignment.Center))
                HomeIconButton(if (puzzles) "Sort puzzles and filter creation dates" else "Sort creators", Modifier.align(Alignment.CenterEnd), { sorting = true }, sortIcon, Cue.PRESS)
            }
        }
        Spacer(Modifier.height(8.dp))
        OnlineMessages(m, errors = false)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (puzzles) PuzzleGrid(m, state, Modifier.fillMaxSize(), header = search, scroll = reveal.connection, minTop = if (reveal.height > 0f) 8.dp else 0.dp) { detail = it }
            else Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.fillMaxSize()) { Column(Modifier.fillMaxSize()) {
                search()
                PlayerPages(m, state, Modifier.weight(1f).fillMaxWidth().nestedScroll(reveal.connection), reserved = with(density) { reveal.height.toDp() })
            } }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // Never dimmed while a puzzle is opening; online.task ignores a second start while busy.
            MenuButton("Random", Modifier.weight(1f), height = 56.dp, raised = true) { m.startRandom() }
            MenuButton("Create", Modifier.weight(1f), height = 56.dp, raised = true) { m.push(Route.Create) }
        }
    }
    if (sorting) DiscoverySort(state, puzzles) { sorting = false }
    detail?.let { anchor -> PuzzleDetails(m, anchor) { detail = null } }
}

/** One row per player: the name (20 characters at most) on the left; level, puzzles designed and puzzles solved stacked on the right. The row keeps its height. */
@Composable
internal fun PlayerRow(m: GameModel, row: JSONObject, height: Dp = 52.dp) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    Row(Modifier.fillMaxWidth().heightIn(min = height).plush(shape, pressProgress(source), p.paper2, rest = 4.dp)
        .pressOnTouch(source).clickable(source, null, role = Role.Button) { m.feedback(Cue.CHECK); m.push(Route.Profile(row.getString("id"))) }.padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Label(row.getString("username"), 16.sp, Modifier.weight(1f), lines = 1, translate = false)
        Column(horizontalAlignment = Alignment.End) {
            Label(tr("Level {0}", formatted(row.getInt("level"))), 10.5.sp, color = p.muted, lines = 1, translate = false)
            Label(tr("Designed {0}", formatted(row.getInt("gridCount"))), 10.5.sp, color = p.muted, lines = 1, translate = false)
            Label(tr("Solved {0}", formatted(row.getInt("beatenCount"))), 10.5.sp, color = p.muted, lines = 1, translate = false)
        }
    }
}

/** Two halves in one capsule: puzzles (left) and players (right); the open one is filled. */
@Composable
private fun SplitPill(puzzles: Boolean, select: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val feedback = LocalFeedback.current
    val shape = RoundedCornerShape(24.dp)
    // A capsule on its own pedestal; the open half is filled.
    Row(modifier.height(48.dp).plush(shape, 0f, p.paper2, rest = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        for ((forPuzzles, icon) in listOf(true to gridIcon, false to peopleIcon)) {
            val on = forPuzzles == puzzles
            val source = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
            // The line art moves with the press, like the other icon buttons.
            val press = pressProgress(source)
            Box(Modifier.width(64.dp).fillMaxHeight().background(if (on) p.accent else Color.Transparent)
                .pressOnTouch(source)
                .clickable(source, null, role = Role.Tab) { feedback(Cue.PRESS); if (!on) select(forPuzzles) }
                .semantics { contentDescription = if (forPuzzles) tr("Puzzles") else tr("Players"); selected = on }, contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(20.dp)) { icon.draw(this, if (on) p.accentInk else p.ink, press) }
            }
        }
    }
}

/**
 * Eight players to a page, one line each; swipe sideways for the next page, up and down inside a page that is taller than the screen.
 * [reserved] is height lent to something above the list for now (Worlds' search bar coming down): the rows keep their size and move down instead of shrinking.
 */
@Composable
internal fun PlayerPages(m: GameModel, state: DiscoveryListState, modifier: Modifier = Modifier, empty: String = "No results for these settings.", reserved: Dp = 0.dp) {
    // The rows reach the page edge; the page pads them by the shadow room it adds.
    PagedItems(state, PLAYER_ROWS, modifier.bleed()) { rows, _ ->
        // Eight rows share the page's height, so the last row ends at the bottom; a screen too short for that keeps the minimum height and scrolls.
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val slot = ((maxHeight + reserved - 16.dp - 8.dp * (PLAYER_ROWS - 1)) / PLAYER_ROWS).coerceAtLeast(52.dp)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = ShadowRoom, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                rows.forEach { PlayerRow(m, it, slot) }
                if (rows.isEmpty()) DiscoveryFooter(m, state, empty)
            }
        }
    }
}

/** What an empty discovery list says once a load has finished. Loading itself shows nothing, a failed load shows the offline mark, and more items arrive by swiping on, never by a button. */
@Composable
internal fun DiscoveryFooter(m: GameModel, state: DiscoveryListState, empty: String = "No results for these settings.") {
    if (!state.loading && state.items.isEmpty() && state.settled && !state.failed) Label(empty, 14.sp)
}
