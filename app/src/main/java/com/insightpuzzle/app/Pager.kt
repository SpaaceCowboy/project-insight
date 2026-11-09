package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
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
internal const val PAGES_AHEAD = 5

/** How many pages [items] items fill; an empty list still has one (empty) page. */
internal fun pageCount(items: Int, pageSize: Int) = maxOf(1, (items + pageSize - 1) / pageSize)

/**
 * How many pages can be swiped to. While [hasMore] a half-filled last page is not counted, and no page past the loaded ones exists: a page is never shown before
 * its items are all here, so a slow connection means the swipe stops at the edge of what has loaded, never a blank or half-drawn page.
 */
internal fun loadedPages(items: Int, pageSize: Int, hasMore: Boolean) = if (hasMore) maxOf(1, items / pageSize) else pageCount(items, pageSize)

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
    hasMore: Boolean = false, onMore: () -> Unit = {}, loading: Boolean = false, failed: Boolean = false, onRetry: () -> Unit = {}, content: @Composable (List<T>, Int) -> Unit,
) {
    val count = loadedPages(items.size, pageSize, hasMore)
    val pager = rememberPagerState(initialPage = page.coerceIn(0, count - 1)) { count }
    val feedback = LocalFeedback.current
    val current by rememberUpdatedState(page)
    val change by rememberUpdatedState(onPage)
    val more by rememberUpdatedState(onMore)
    // A swipe to another page lets go of a search field's focus and keyboard, so nothing on the new page is left typing.
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    LaunchedEffect(pager) { snapshotFlow { pager.settledPage }.collect { if (it != current) { feedback(null); change(it); focus.clearFocus(); keyboard?.hide() } } }
    // The kept page only moves the pager when it was changed from outside (a new search or sort starts at page 0). It never fights a swipe in progress, and a longer
    // list (more pages arriving) is no reason to move: that used to snap a fast swipe back to the page it had left.
    LaunchedEffect(page) { if (page in 0 until count && pager.currentPage != page && !pager.isScrollInProgress) pager.scrollToPage(page) }
    LaunchedEffect(pager, items.size, hasMore) { snapshotFlow { pager.currentPage }.collect { if (needsMore(items.size, it, pageSize, hasMore)) more() } }
    Box(modifier) {
        HorizontalPager(pager, Modifier.fillMaxSize(), beyondViewportPageCount = PAGES_KEPT, key = { it }) { index ->
            Box(Modifier.fillMaxSize()) { content(pageItems(items, index, pageSize), index * pageSize) }
        }
        // On the last loaded page with more on its way: a small spinner while it loads, the offline mark (tap to retry) if it could not.
        if (hasMore && pager.currentPage == count - 1 && (loading || failed)) {
            val p = LocalPalette.current
            val edge = Modifier.align(Alignment.BottomCenter).padding(bottom = 2.dp).size(18.dp)
            if (failed) Canvas(edge.clickable(role = Role.Button, onClickLabel = tr("Offline. Pull down to retry.")) { onRetry() }
                .semantics { contentDescription = tr("Offline. Pull down to retry.") }) { offlineIcon(p.muted) }
            else CircularProgressIndicator(edge, color = p.accent, strokeWidth = 2.dp)
        }
    }
}

/** [Paged] over a discovery list: the open page is remembered in the list's state, and more of it is fetched ahead of the reader. */
@Composable
internal fun PagedItems(state: DiscoveryListState, pageSize: Int, modifier: Modifier = Modifier, onRetry: () -> Unit = {}, content: @Composable (List<JSONObject>, Int) -> Unit) =
    Paged(state.items, pageSize, state.page, { state.page = it }, modifier, hasMore = state.nextPage != null,
        onMore = { state.nextPage?.let { if (state.requestedPage != it) state.requestedPage = it } }, loading = state.loading, failed = state.failed, onRetry = onRetry, content = content)
