package com.insightpuzzle.app

import android.graphics.Outline as ViewOutline
import android.view.TextureView
import android.view.View
import android.view.ViewOutlineProvider
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.toRect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer

/** Where sign-in leads: the Worlds screen only for an account that owns Worlds, and no purchase for one that already does. */
internal fun afterSignIn(destination: Route, owns: Boolean): Route = when {
    destination == Route.Online && !owns -> Route.WorldsPreview
    destination == Route.Purchase && owns -> Route.Online
    else -> destination
}

/** The preview's button: it signs in first when there is no account, and says so. */
internal fun previewButtonLabel(signedIn: Boolean): String = if (signedIn) "Purchase" else "Log in and purchase"

/**
 * The showcase video: seven clips recorded on a phone and cut into one loop per theme (assets/showcase/worlds_dark.mp4 and worlds_light.mp4), 1080 wide
 * at 60 fps. Each clip is the whole screen without the status bar above it and the gesture handle below, so it sits in a phone-like frame.
 * The captions are not in the video: they are drawn over each screen's top icon row, in the app's font and language.
 *
 * [showcaseCues]: where each caption starts, in ms from the loop's first frame. Every clip is 2 s (120 frames) except the last, 4 s; the loop is 16 s
 * (960 frames) in both themes. Clips 1 and 2 (building a start grid, then into the target phase), 3 and 4 (Follow on a profile, sorting the player
 * list), 5 and 6 (a move, Like and Bookmark in a game, then your own profile's Bookmarked), then 7 (swiping through Worlds pages).
 */
internal val showcaseCues = listOf(0L to "designers", 4_000L to "share", 8_000L to "like", 12_000L to "endless")
private val showcaseCaptions = mapOf("designers" to "Join the community of puzzle designers around the world", "share" to "Share and follow",
    "like" to "Like and bookmark", "endless" to "Endless puzzles")
/** Width over height of the cut clips, so the frame holds its shape before the first frame arrives. */
private const val SHOWCASE_RATIO = 1080f / 2198f
/** The recording phone's width in dp (1080 px at 450 dpi, 2.8125 px/dp): the frame shows that phone's screen at [frame width] / this scale. */
private const val RECORDED_WIDTH_DP = 384f
/** The phone frame: a ring in the keys' side colour around the screen, as the website's captures have. */
private val RING = 5.dp
/** The small gaps that leave the frame as much height as the screen can give. */
private val PREVIEW_GAP = 6.dp

/** The English caption showing at [positionMs] into the loop. */
internal fun showcaseCaption(positionMs: Long): String =
    showcaseCaptions.getValue(showcaseCues.last { it.first <= positionMs.coerceAtLeast(0) }.second)

/**
 * A phone's rounded outline, as the website draws its captures: corners 12.5 % of the frame's width. [inset] is how far this shape sits inside the
 * frame, so the screen's corners follow the frame's with the ring's width between them.
 */
private class PhoneShape(private val inset: Dp) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val i = with(density) { inset.toPx() }
        return Outline.Rounded(RoundRect(size.toRect(), CornerRadius(phoneCorner(size.width, i))))
    }
}
private fun phoneCorner(width: Float, inset: Float) = ((width + 2 * inset) * 0.125f - inset).coerceAtLeast(0f)

/** What the Worlds button opens for anyone who has not bought Worlds, signed in or not: the showcase in a phone frame, then Purchase. */
@Composable
fun WorldsPreviewScreen(m: GameModel) {
    val p = LocalPalette.current
    val context = LocalContext.current
    // Silent and looping; it never asks for audio focus, so the game's own sound carries on.
    val player = remember { ExoPlayer.Builder(context).build().apply { volume = 0f; repeatMode = Player.REPEAT_MODE_ALL } }
    var ratio by remember { mutableFloatStateOf(SHOWCASE_RATIO) }
    var caption by remember { mutableStateOf(showcaseCaption(0)) }
    val theme = if (p.dark) "dark" else "light"
    LaunchedEffect(theme) {
        player.setMediaItem(MediaItem.fromUri("asset:///showcase/worlds_$theme.mp4"))
        player.prepare(); player.playWhenReady = true
    }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(size: VideoSize) { if (size.width > 0 && size.height > 0) ratio = size.width * size.pixelWidthHeightRatio / size.height }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener); player.release() }
    }
    // Paused while the app is in the background.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) player.pause() else if (event == Lifecycle.Event.ON_START) player.play()
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    // The caption changes on the frame the clip does: checked every frame, and cut, never faded.
    LaunchedEffect(player) { while (true) withFrameNanos { caption = showcaseCaption(player.currentPosition) } }

    Page("Worlds", 560.dp) {
        Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) { BackChevron(m) }
        Spacer(Modifier.height(PREVIEW_GAP))
        // The frame takes the largest size the space holds at the video's shape: no fillMaxWidth, so a short screen narrows it instead of squashing it.
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            val frame = PhoneShape(0.dp); val screen = PhoneShape(RING)
            Box(Modifier.shadow(16.dp, frame, clip = false, ambientColor = p.shadow, spotColor = p.shadow).background(p.side, frame)
                .border(1.dp, p.line, frame).padding(RING).aspectRatio(ratio).clip(screen).background(backdrop(p.dark).first())) {
                ShowcaseVideo(player)
                ShowcaseCaption(caption)
            }
        }
        Spacer(Modifier.height(PREVIEW_GAP))
        MenuButton(previewButtonLabel(m.online.user != null), primary = true) { m.openPurchase() }
    }
}

/** The video, its corners cut to the frame's: the TextureView clips itself, as a View inside Compose need not follow a Compose clip. */
@Composable
private fun ShowcaseVideo(player: ExoPlayer) {
    val ring = with(LocalDensity.current) { RING.toPx() }
    AndroidView({ context ->
        TextureView(context).also { view ->
            view.outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(v: View, outline: ViewOutline) { outline.setRoundRect(0, 0, v.width, v.height, phoneCorner(v.width.toFloat(), ring)) }
            }
            view.clipToOutline = true
            player.setVideoTextureView(view)
        }
    }, Modifier.fillMaxSize(), onRelease = { player.clearVideoTextureView(it) })
}

/**
 * The caption, over the recorded screen's top icon row (16dp below its top, 48dp tall, scaled with the frame): bold on a rounded plate in the
 * theme's ink, so it reads as laid over the clip. It stays clear of the row's side buttons and of everything below the row.
 */
@Composable
private fun ShowcaseCaption(caption: String) {
    val p = LocalPalette.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val scale = maxWidth.value / RECORDED_WIDTH_DP
        // The row's centre, and the room around it that holds nothing in any clip (the page's top padding and the gap under the row).
        val centre = (16f + 24f) * scale; val room = 38f * scale
        // As wide as the row between its side buttons.
        val widest = maxWidth - (104f * scale).dp
        Box(Modifier.fillMaxWidth().height((centre + room).dp).padding(top = ((centre - room).coerceAtLeast(0f)).dp), contentAlignment = Alignment.Center) {
            BasicText(tr(caption), Modifier.widthIn(max = widest).clip(RoundedCornerShape(10.dp)).background(p.ink)
                .padding(horizontal = 12.dp, vertical = 6.dp).semantics { heading() },
                style = TextStyle(color = backdrop(p.dark).first(), fontFamily = MonoFamily, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center,
                    lineHeight = 1.15.em), maxLines = 2, autoSize = TextAutoSize.StepBased(minFontSize = 9.sp, maxFontSize = 14.sp, stepSize = 0.5.sp))
        }
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
