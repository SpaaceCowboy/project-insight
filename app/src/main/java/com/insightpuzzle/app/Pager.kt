package com.insightpuzzle.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import org.json.JSONObject

/** Rows of four cards per page: Journey levels, Worlds puzzles, Bookmarked ([BOOKMARK_ROWS]), profile puzzles. Players are listed [PLAYER_ROWS] to a page. */
internal const val JOURNEY_ROWS = 8
internal const val WORLD_ROWS = 6
internal const val BOOKMARK_ROWS = 7
internal const val PROFILE_ROWS = 3
internal const val PLAYER_ROWS = 8
internal const val CARD_COLUMNS = 4

/** Pages on either side of the open one that stay composed, so a swipe never meets an empty page. */
internal const val PAGES_KEPT = 2
/** Server pages are fetched until this many pages of items are loaded past the open one. */
internal const val PAGES_AHEAD = 3

/** How many pages [items] items fill; an empty list still has one (empty) page. */
internal fun pageCount(items: Int, pageSize: Int) = maxOf(1, (items + pageSize - 1) / pageSize)

/** The items on [page]. */
internal fun <T> pageItems(items: List<T>, page: Int, pageSize: Int): List<T> = items.drop(page * pageSize).take(pageSize)

/** True when the open [page] is close enough to the end of the [loaded] items that the next server page should be fetched. */
internal fun needsMore(loaded: Int, page: Int, pageSize: Int, hasMore: Boolean) = hasMore && loaded < (page + PAGES_AHEAD) * pageSize

/**
 * Swipeable pages of [pageSize] items: right to left for the next page, left to right for the previous one. Only the open page and
 * [PAGES_KEPT] on each side are composed, however long [items] gets. [page] is kept by the caller (so it survives leaving the screen);
 * [onMore] is asked for more items while the open page is near the end of what is loaded and [hasMore].
 */
@Composable
internal fun <T> Paged(
    items: List<T>, pageSize: Int, page: Int, onPage: (Int) -> Unit, modifier: Modifier = Modifier,
    hasMore: Boolean = false, onMore: () -> Unit = {}, lookahead: Boolean = false, content: @Composable (List<T>, Int) -> Unit,
) {
    // With [lookahead] a page past the loaded ones exists while more is on its way ([content] gets an empty list for it), so swiping on never meets a hard stop.
    val count = pageCount(items.size, pageSize) + if (lookahead && hasMore && items.isNotEmpty()) 1 else 0
    val pager = rememberPagerState(initialPage = page.coerceIn(0, count - 1)) { count }
    val feedback = LocalFeedback.current
    val current by rememberUpdatedState(page)
    val change by rememberUpdatedState(onPage)
    val more by rememberUpdatedState(onMore)
    LaunchedEffect(pager) { snapshotFlow { pager.settledPage }.collect { if (it != current) { feedback(null); change(it) } } }
    LaunchedEffect(page, count) { if (page in 0 until count && pager.currentPage != page) pager.scrollToPage(page) }
    LaunchedEffect(pager, items.size, hasMore) { snapshotFlow { pager.currentPage }.collect { if (needsMore(items.size, it, pageSize, hasMore)) more() } }
    HorizontalPager(pager, modifier, beyondViewportPageCount = PAGES_KEPT, key = { it }) { index ->
        Box(Modifier.fillMaxSize()) { content(pageItems(items, index, pageSize), index * pageSize) }
    }
}

/** [Paged] over a discovery list: the open page is remembered in the list's state, and more of it is fetched ahead of the reader. */
@Composable
internal fun PagedItems(state: DiscoveryListState, pageSize: Int, modifier: Modifier = Modifier, lookahead: Boolean = false, content: @Composable (List<JSONObject>, Int) -> Unit) =
    Paged(state.items, pageSize, state.page, { state.page = it }, modifier, hasMore = state.nextPage != null && !state.failed,
        onMore = { state.nextPage?.let { if (state.requestedPage != it) state.requestedPage = it } }, lookahead = lookahead, content = content)
