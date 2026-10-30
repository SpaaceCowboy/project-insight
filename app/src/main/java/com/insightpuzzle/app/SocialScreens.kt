package com.insightpuzzle.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.util.UUID

/** A list screen's top: Back centred (the offline mark on the left while the server can't be reached), then the title. */
@Composable
private fun ListHeader(m: GameModel, title: String) {
    val muted = LocalPalette.current.muted
    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) {
        if (m.online.offline) Canvas(Modifier.align(Alignment.CenterStart).padding(start = 14.dp).size(20.dp).semantics { contentDescription = tr("Offline. Pull down to retry.") }) { offlineIcon(muted) }
        BackChevron(m)
    }
    Spacer(Modifier.height(ScreenGap))
    Label(title, 22.sp, Modifier.fillMaxWidth().semantics { heading() }, align = TextAlign.Center)
}

/** The Bookmarked request. The server pages by the size asked for, so the first fetch fills all seven rows (28 items) instead of six, the seventh arriving with the next fetch. */
internal const val BOOKMARKS_KEY = "/v1/grids?bookmarked=true&query=&limit=28"

/** Your bookmarked puzzles, in the same cards as Worlds. Playing one keeps this list, so swiping walks through it. */
@Composable
fun BookmarksScreen(m: GameModel) {
    m.online.user?.id ?: return
    val state = m.playDiscovery.bookmarks
    var detail by remember { mutableStateOf<DetailAnchor?>(null) }
    LoadDiscovery(m, state, BOOKMARKS_KEY, resetScroll = false)
    Page("Bookmarked", 560.dp) {
        ListHeader(m, "Bookmarked")
        PuzzleGrid(m, state, Modifier.weight(1f).fillMaxWidth(), rows = BOOKMARK_ROWS, empty = "No bookmarked puzzles yet.") { detail = it }
    }
    detail?.let { anchor -> PuzzleDetails(m, anchor) { detail = null } }
}

/** Whom you follow ([kind] "following"), one line per player. */
@Composable
fun PlayersScreen(m: GameModel, kind: String) {
    m.online.user?.id ?: return
    val state = m.playDiscovery.following
    LoadDiscovery(m, state, "/v1/$kind")
    Page("Following", 560.dp) {
        ListHeader(m, "Following")
        Refreshable(state.pulling, { m.online.clearMessages(); state.pull() }, Modifier.weight(1f).fillMaxWidth()) {
            PlayerPages(m, state, Modifier.fillMaxSize(), "You don't follow anyone yet.")
        }
    }
}

/** Share feedback ([kind] "feedback") or Report a bug ("bug"): a place to write and Send. The server mails it to the team; no account needed. */
@Composable
fun FeedbackScreen(m: GameModel, kind: String) {
    val p = LocalPalette.current
    val context = LocalContext.current
    val title = tr(if (kind == "bug") "Report a bug" else "Share feedback")
    var text by rememberSaveable(kind) { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    // Thank the player briefly, then go back to Options.
    LaunchedEffect(sent) { if (sent) { delay(1200); if (m.top == Route.Feedback(kind)) m.back() } }
    Page(title, 560.dp) {
        ChevronBar(m)
        Label(title, 22.sp, Modifier.fillMaxWidth().semantics { heading() }, align = TextAlign.Center, translate = false)
        OutlinedTextField(text, { text = it.take(4000) }, Modifier.weight(1f).fillMaxWidth().padding(vertical = 8.dp).semantics { contentDescription = title },
            enabled = !sent, placeholder = { Label(if (kind == "bug") "What happened, and what did you expect?" else "Tell us what you think.", 14.sp, color = p.muted) },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink,
                focusedBorderColor = p.accent, unfocusedBorderColor = p.line, cursorColor = p.accent))
        if (sent) Label("Sent. Thank you.", 14.sp, Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }, color = p.muted, align = TextAlign.Center)
        else OnlineMessages(m)
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            MenuButton("Send", Modifier.widthIn(max = 240.dp), height = 56.dp, primary = true, enabled = text.isNotBlank() && !sent && !m.online.busy, cue = Cue.FORWARD) {
                val version = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull().orEmpty()
                val body = JSONObject().put("operationId", UUID.randomUUID().toString()).put("kind", kind).put("text", text.trim()).put("appVersion", version.take(40))
                m.online.task {
                    m.online.repository.client.request("POST", "/v1/feedback", body)
                    text = ""; sent = true
                }
            }
        }
    }
}
