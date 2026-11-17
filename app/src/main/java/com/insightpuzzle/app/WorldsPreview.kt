package com.insightpuzzle.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Placeholders: the trailer and the real purchase come with the preview work. What matters now is the routing around them.

/** Where sign-in leads: the Worlds screen only for an account that owns Worlds, and no purchase for one that already does. */
internal fun afterSignIn(destination: Route, owns: Boolean): Route = when {
    destination == Route.Online && !owns -> Route.WorldsPreview
    destination == Route.Purchase && owns -> Route.Online
    else -> destination
}

/** What the Worlds button opens for anyone who has not bought Worlds, signed in or not. */
@Composable
fun WorldsPreviewScreen(m: GameModel) {
    Page("Worlds", 560.dp) {
        ChevronBar(m)
        Label("Worlds", 22.sp, Modifier.fillMaxWidth().semantics { heading() }, align = TextAlign.Center)
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { Label("Coming soon", 14.sp, color = LocalPalette.current.muted) }
        MenuButton("Purchase", primary = true) { m.openPurchase() }
    }
}

@Composable
fun PurchaseScreen(m: GameModel) {
    Page("Purchase", 560.dp) {
        ChevronBar(m)
        Label("Purchase", 22.sp, Modifier.fillMaxWidth().semantics { heading() }, align = TextAlign.Center)
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { Label("Coming soon", 14.sp, color = LocalPalette.current.muted) }
    }
}
