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
import androidx.compose.ui.layout.layout
import kotlinx.coroutines.flow.first
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.foundation.lazy.items
import kotlin.math.roundToInt
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
    /** The next load replaces the whole list instead of only its first server page (a puzzle was just published: it may sort onto any page). */
    var replaceAll = false
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
    /** A quiet full reload: the list is fetched again from its first page, without the pull spinner or a jump to page 0. */
    fun reload() { replaceAll = true; refresh() }
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
private val creatorSorts = listOf("level" to "Highest level", "liked" to "Most popular puzzles", "followed" to "Most followed")
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
    LaunchedEffect(account, key, state.requestedPage, state.revision, m.online.retry) {
        // Only a changed query or sort waits (typing); entering the screen, pulling to refresh and the pages after the first load at once.
        if (state.loadedKey != null && state.loadedKey != key) delay(300)
        val page = state.requestedPage
        if (state.loadedKey == key && state.loadedPage >= page && state.loadedRevision == state.revision) return@LaunchedEffect
        val changed = state.loadedKey != key || state.loadedRevision != state.revision
        val requested = if (changed) 0 else page
        if (changed) {
            // A new search or sort, or a pull, starts again at the first page; a quiet refresh (after a like, say) leaves the reader where they are.
            if (resetScroll && (state.loadedKey != key || state.pulling)) state.page = 0
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
            val fresh = response.getJSONArray("items").objects()
            // A quiet refresh of a list that is already shown replaces its first server page and keeps every page after it, so the list neither shrinks under the reader nor jumps.
            val keepRest = requested == 0 && changed && state.loadedKey == key && !state.pulling && !state.replaceAll && state.items.size > fresh.size
            state.items = (if (keepRest) fresh + state.items.drop(fresh.size) else if (requested == 0) fresh else state.items + fresh).distinctBy { it.getString("id") }
            // Always the server's answer, kept rows or not: the pages after the first are fetched again as the reader nears them, and anything new on them
            // (a puzzle just published sorts last by number) is added. Keeping the old "no more pages" hid such a puzzle until the app was restarted.
            state.nextPage = if (response.isNull("nextPage")) null else response.getInt("nextPage")
            if (requested == 0) state.replaceAll = false
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun DiscoverySort(state: DiscoveryListState, puzzles: Boolean, dismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = LocalPalette.current.paper2, contentColor = LocalPalette.current.ink) {
        HideNavBarInDialog()
        Column(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBarsIgnoringVisibility).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
    /** The bar is at least partly out. Read this (not [height]) while composing: [height] changes every frame of the slide and would recompose the whole screen with it. */
    val open by androidx.compose.runtime.derivedStateOf { height > 0f }
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
    reveal.pinned = searching || state.query.isNotEmpty()
    val dismissKeyboard = rememberDismissKeyboard()
    /** Closes the search bar: the text goes, the keyboard goes, the bar slides back up. */
    fun closeSearch() {
        dismissKeyboard()
        if (state.query.isNotEmpty()) { state.query = ""; state.requestedPage = 0 }
        reveal.pinned = false
        scope.launch { androidx.compose.animation.core.animate(reveal.height, 0f) { v, _ -> reveal.height = v } }
    }
    // System Back first closes an open search bar; only then does it leave the screen.
    BackHandler(enabled = reveal.open || searching) { closeSearch() }
    LaunchedEffect(reveal) { if (state.query.isNotEmpty()) reveal.height = reveal.max }
    val key = discoveryKey(puzzles, state)
    LoadDiscovery(m, state, key)
    // A full level code is matched by the list itself (the server finds the level by its code), so Search only puts the keyboard away: the level shows up in the list and is opened from there.
    val search: @Composable () -> Unit = {
        // The slide only re-lays-out (the height is read while measuring); nothing is recomposed from one frame to the next.
        Box(Modifier.fillMaxWidth().clipToBounds().layout { measurable, constraints ->
            val placeable = measurable.measure(constraints.copy(minHeight = 0, maxHeight = androidx.compose.ui.unit.Constraints.Infinity))
            val shown = reveal.height.roundToInt().coerceAtLeast(0)
            layout(placeable.width, shown) { placeable.place(0, shown - placeable.height) }
        }) {
            if (reveal.open) PlaySearch(state.query, if (puzzles) "Search creator or code" else "Search creators", Modifier.fillMaxWidth().onFocusChanged { searching = it.isFocused },
                close = ::closeSearch) { state.query = it; state.requestedPage = 0 }
        }
    }
    // Where the Worlds tips' borders and plate go (layout positions, read only while the tips show).
    val spots = remember { mutableStateMapOf<String, LayoutCoordinates>() }
    fun spot(name: String) = Modifier.onGloballyPositioned { spots[name] = it }
    // The first time Worlds opens on this device its tips play by themselves, once it has settled and half a second has passed.
    val sheet = LocalSheet.current
    val cover = LocalCover.current
    LaunchedEffect(Unit) {
        if (!m.worldsGuideDue) return@LaunchedEffect
        snapshotFlow { m.top == Route.Online && (sheet?.progress?.value ?: 1f) >= 1f && cover() <= .02f }.first { it }
        delay(500)
        if (m.top == Route.Online) m.revealWorldsGuide()
    }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { m.endWorldsGuide() } }
    Page("Worlds", 560.dp, ime = false) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                HomeIconButton("Options", Modifier.align(Alignment.CenterStart).semantics { traversalIndex = -4f }, { m.push(Route.Options) }, optionsIcon, Cue.STOP)
                BackChevron(m, Modifier.align(Alignment.Center).then(spot("chevron")).semantics { traversalIndex = -3f })
                Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
                    // No connection: the same crossed-out signal as Profile, left of the Profile icon; pulling the list down retries.
                    val muted = LocalPalette.current.muted
                    if (m.online.offline) Canvas(Modifier.padding(end = 10.dp).size(20.dp).semantics { contentDescription = tr("Offline. Pull down to retry.") }) { offlineIcon(muted) }
                    HomeIconButton("Profile", Modifier.semantics { traversalIndex = -2f }, { m.openOnline(Route.Profile()) }, personIcon, Cue.START)
                }
            }
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth().height(48.dp)) {
                // The tips' key sits under Options as Sort sits under Profile, in the same colours as every key here and never lit.
                HomeIconButton("Gameplay tips", Modifier.align(Alignment.CenterStart).then(spot("lamp")), { m.tapWorldsGuide() }, lampIcon, Cue.TOGGLE_ON)
                SplitPill(puzzles, { discovery.tab = if (it) "puzzles" else "creators" }, Modifier.align(Alignment.Center).then(spot("split")))
                HomeIconButton(if (puzzles) "Sort puzzles and filter creation dates" else "Sort creators", Modifier.align(Alignment.CenterEnd).then(spot("sort")), { sorting = true }, sortIcon, Cue.PRESS)
            }
        }
        Spacer(Modifier.height(8.dp))
        OnlineMessages(m, errors = false)
        Box(Modifier.weight(1f).fillMaxWidth().then(spot("body"))) {
            if (puzzles) CompositionLocalProvider(LocalFirstCard provides { spots["card"] = it }) { PuzzleGrid(m, state, Modifier.fillMaxSize(), header = search, scroll = reveal.connection, minTop = if (reveal.open) 8.dp else 0.dp) { detail = it } }
            else Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.fillMaxSize()) { Column(Modifier.fillMaxSize()) {
                search()
                PlayerList(m, state, Modifier.weight(1f).fillMaxWidth().nestedScroll(reveal.connection))
            } }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // Never dimmed while a puzzle is opening; online.task ignores a second start while busy.
            MenuButton("Random", Modifier.weight(1f).then(spot("random")), height = 56.dp, raised = true) { m.startRandom() }
            MenuButton("Create", Modifier.weight(1f).then(spot("create")), height = 56.dp, raised = true) { m.push(Route.Create) }
        }
    }
    if (sorting) DiscoverySort(state, puzzles) { sorting = false }
    detail?.let { anchor -> PuzzleDetails(m, anchor) { detail = null } }
    if (m.worldsGuidePhase != 0) {
        var layer by remember { mutableStateOf<LayoutCoordinates?>(null) }
        Box(Modifier.fillMaxSize().onGloballyPositioned { layer = it }) {
            val base = layer?.takeIf { it.isAttached }
            fun rect(name: String) = spots[name]?.takeIf { it.isAttached && base != null }?.let { base!!.localBoundingBoxOf(it) }
            val chevron = rect("chevron")
            if (chevron != null) WorldsGuide(m, puzzles, rect("body"), rect("split"), rect("sort"), rect("create"), rect("random"), rect("card"), chevron, rect("lamp"))
        }
    }
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

/** The next server page of players is fetched while this many rows are still below the last one on screen. */
internal const val PLAYERS_AHEAD = 50

/**
 * Players, one line each, in one long list that scrolls up and down (no pages, no button). When the reader gets within [PLAYERS_AHEAD] rows of the end of what is
 * loaded the next server page is fetched, so the list keeps ahead of them without ever loading it all at once. Rows are created only as they scroll into view.
 */
@Composable
internal fun PlayerList(m: GameModel, state: DiscoveryListState, modifier: Modifier = Modifier, empty: String? = "No results for these settings.") {
    val list = androidx.compose.foundation.lazy.rememberLazyListState()
    ScrollTick(list) { m.fineTick() }
    val hasMore = state.nextPage != null && !state.failed
    LaunchedEffect(list, state.items.size, hasMore) {
        snapshotFlow { list.firstVisibleItemIndex + list.layoutInfo.visibleItemsInfo.size }.collect { lastShown ->
            if (hasMore && state.items.size - lastShown <= PLAYERS_AHEAD) state.nextPage?.let { if (state.requestedPage != it) state.requestedPage = it }
        }
    }
    // The rows reach the page edge; the list pads them by the shadow room it adds.
    androidx.compose.foundation.lazy.LazyColumn(modifier.bleed(), list, contentPadding = PaddingValues(horizontal = ShadowRoom, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(state.items, key = { it.getString("id") }) { PlayerRow(m, it) }
        if (state.items.isEmpty()) item { DiscoveryFooter(m, state, empty) }
    }
}

/** What an empty discovery list says once a load has finished ([empty] null: nothing, as on a new account's own lists). Loading itself shows nothing, a failed load shows the offline mark, and more items arrive by swiping on, never by a button. */
@Composable
internal fun DiscoveryFooter(m: GameModel, state: DiscoveryListState, empty: String? = "No results for these settings.") {
    if (empty != null && !state.loading && state.items.isEmpty() && state.settled && !state.failed) Label(empty, 14.sp)
}
