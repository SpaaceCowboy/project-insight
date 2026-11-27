package com.insightpuzzle.app

import android.graphics.Outline as ViewOutline
import android.view.TextureView
import android.view.View
import android.view.ViewOutlineProvider
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.toRect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
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

/** The preview's button: it signs in first when there is no account, and says so. Its face shows only the price; this is what it is called to a screen reader. */
internal fun previewButtonLabel(signedIn: Boolean): String = if (signedIn) "Purchase" else "Log in and purchase"

/** The price in minor units (cents), never a float. Placeholders until the purchase mechanism is decided; Play Billing's own price replaces them. */
internal const val OFFER_CENTS = 299
internal const val LIST_CENTS = 499
internal fun priceText(cents: Int): String = "${cents / 100}.${(cents % 100).toString().padStart(2, '0')}"

/**
 * The showcase video: seven clips recorded on a phone and cut into one loop per theme (assets/showcase/worlds_dark.mp4 and worlds_light.mp4), 1080 wide
 * at 60 fps. Each clip is the whole screen without the status bar above it and the gesture handle below, so it sits in a phone-like frame.
 * The captions are not in the video: they are drawn over each screen's top (see [ShowcaseOverlay]), in the app's font and language.
 *
 * [showcaseCues]: where each caption starts, in ms from the loop's first frame. Every clip is 3 s (180 frames) except the last, 4 s; the loop is 22 s
 * (1320 frames) in both themes. Clips 1 and 2 (building a start grid, then into the target phase), 3 and 4 (Follow on a profile, sorting the player
 * list), 5 and 6 (a move, Like and Bookmark in a game, then your own profile up to the press on Bookmarked), then 7 (swiping through Worlds pages).
 */
internal val showcaseCues = listOf(0L to "designers", 6_000L to "share", 12_000L to "like", 18_000L to "endless")
private val showcaseCaptions = mapOf("designers" to "Join community of puzzle designers", "share" to "Share and follow",
    "like" to "Like and bookmark", "endless" to "Endless puzzles")
/** Length of each of the first six clips; the seventh runs on to the end of the loop. */
private const val CLIP_MS = 3_000L
/** Width over height of the cut clips, so the frame holds its shape before the first frame arrives. */
private const val SHOWCASE_RATIO = 1080f / 2198f
/** The recording phone's width in dp (1080 px at 450 dp/inch, 2.8125 px/dp): the frame shows that phone's screen at [frame width] / this scale. */
private const val RECORDED_WIDTH_DP = 384f
/** The phone frame: a ring in the keys' side colour around the screen, as the website's captures have. */
private val RING = 5.dp
/** The same small gap above the frame (under the Back chevron's point) and below it (above the price button). */
private val PREVIEW_GAP = 4.dp
/** Where the Back chevron's point ends in its 48dp key: the 20dp icon sits 14dp in, its point is 16/24 of the way down, plus half the line's width. */
private val CHEVRON_POINT = 28.dp

/** The English caption showing at [positionMs] into the loop. */
internal fun showcaseCaption(positionMs: Long): String =
    showcaseCaptions.getValue(showcaseCues.last { it.first <= positionMs.coerceAtLeast(0) }.second)

/** Which clip (0..6) [positionMs] into the loop is in. */
internal fun showcaseClip(positionMs: Long): Int = (positionMs.coerceAtLeast(0) / CLIP_MS).toInt().coerceAtMost(6)

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
    var clip by remember { mutableIntStateOf(0) }
    // The first frame is out: the video fades in and the caption starts, so a slow start is a fade and never a pop.
    var shown by remember { mutableStateOf(false) }
    val theme = if (p.dark) "dark" else "light"
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(size: VideoSize) { if (size.width > 0 && size.height > 0) ratio = size.width * size.pixelWidthHeightRatio / size.height }
            override fun onRenderedFirstFrame() { shown = true }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener); player.release() }
    }
    LaunchedEffect(theme) {
        player.setMediaItem(MediaItem.fromUri("asset:///showcase/worlds_$theme.mp4"))
        player.prepare(); player.playWhenReady = true
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
    // The caption and the top mask change on the frame the clip does: checked every frame, and cut, never faded.
    LaunchedEffect(player) {
        while (true) withFrameNanos {
            val at = player.currentPosition
            caption = showcaseCaption(at); clip = showcaseClip(at)
            if (at > 0) shown = true
        }
    }

    Page("Worlds", 560.dp) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            // The frame takes the largest size the space holds at the video's shape: no fillMaxWidth, so a short screen narrows it instead of squashing it.
            // It starts just under the chevron's point, not under its whole 48dp key: the key is drawn after it, so it still wins its own touches.
            Box(Modifier.fillMaxSize().padding(top = CHEVRON_POINT + PREVIEW_GAP), contentAlignment = Alignment.Center) {
                val frame = PhoneShape(0.dp); val screen = PhoneShape(RING)
                Box(Modifier.shadow(16.dp, frame, clip = false, ambientColor = p.shadow, spotColor = p.shadow).background(p.side, frame)
                    .border(1.dp, p.line, frame).padding(RING).aspectRatio(ratio).clip(screen).background(backdrop(p.dark).first())
                    // Touch and hold the video to stop it where it is; it carries on when the finger lifts (or the touch is taken away).
                    .pointerInput(player) {
                        awaitEachGesture {
                            awaitFirstDown()
                            player.playWhenReady = false
                            try { waitForUpOrCancellation() } finally { player.playWhenReady = true }
                        }
                    }) {
                    ShowcaseVideo(player, Modifier.fillMaxSize(), shown)
                    ShowcaseOverlay(caption, clip, shown)
                }
            }
            Box(Modifier.fillMaxWidth().height(48.dp).align(Alignment.TopCenter), contentAlignment = Alignment.Center) { BackChevron(m) }
        }
        Spacer(Modifier.height(PREVIEW_GAP))
        PurchaseKey(m.online.user != null) { m.openPurchase() }
        Label("One-time purchase", 11.sp, Modifier.fillMaxWidth().padding(top = 6.dp), color = p.muted, align = TextAlign.Center)
    }
}

/** The price is the whole label: the offer in the middle and, tiny and struck through, the usual price at the bottom right. */
@Composable
private fun PurchaseKey(signedIn: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    val offer = priceText(OFFER_CENTS)
    val was = remember { buildAnnotatedString { withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { append(priceText(LIST_CENTS)) } } }
    // Said aloud as what the key does, then its price (already in the app's language, which tr() leaves as it is).
    MenuButton(offer, primary = true, fontSize = 20.sp, weight = FontWeight.Bold, description = "${tr(previewButtonLabel(signedIn))}, $offer",
        footer = { Label(was, 10.sp, Modifier.align(Alignment.BottomEnd), color = p.accentInk.copy(alpha = .7f)) }, onClick = onClick)
}

/**
 * The video, its corners cut to the frame's: the TextureView clips itself, as a View inside Compose need not follow a Compose clip. It fades in once
 * [shown] (the first frame is out).
 */
@Composable
private fun ShowcaseVideo(player: ExoPlayer, modifier: Modifier, shown: Boolean = true) {
    val ring = with(LocalDensity.current) { RING.toPx() }
    val alpha by animateFloatAsState(if (shown) 1f else 0f, if (LocalReduceMotion.current) snap() else tween(120), label = "video")
    AndroidView({ context ->
        TextureView(context).also { view ->
            view.outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(v: View, outline: ViewOutline) { outline.setRoundRect(0, 0, v.width, v.height, phoneCorner(v.width.toFloat(), ring)) }
            }
            view.clipToOutline = true
            player.setVideoTextureView(view)
        }
    }, modifier.graphicsLayer { this.alpha = alpha }, onRelease = { player.clearVideoTextureView(it) })
}

/**
 * Composed once under the splash: plays the showcase muted and hidden until the splash goes, so the first real visit finds the player's classes, the H.264
 * decoder and the file already warm, as every later visit does. It is not waited for.
 */
@Composable
internal fun ShowcaseWarmup() {
    val context = LocalContext.current
    val theme = if (LocalPalette.current.dark) "dark" else "light"
    val player = remember { ExoPlayer.Builder(context).build().apply { volume = 0f } }
    DisposableEffect(player) { onDispose { player.release() } }
    LaunchedEffect(theme) { player.setMediaItem(MediaItem.fromUri("asset:///showcase/worlds_$theme.mp4")); player.prepare(); player.playWhenReady = true }
    Box(Modifier.size(16.dp).graphicsLayer { alpha = .01f }.clearAndSetSemantics { }) { ShowcaseVideo(player, Modifier.fillMaxSize()) }
}

/** What the top of each clip hides: [band] is how far down the recorded screen (in its dp) the mask reaches across the whole width, and [centre] how far a block in the middle goes. */
private class MaskSpec(val band: Float, val centre: Float = 0f)
/**
 * The mask is the app's own backdrop over the recorded screen's top, so the caption reads on a clean ground and the clips show none of their own top
 * controls (Options, Profile, Back, Logout) or headings. The game clip's creator key ("Isabella 5") sits between the Like and Bookmark keys, so a block in
 * the middle covers it. Each reach stops short of what its clip shows below: the start/target heading (clips 1 and 2) has the tiles 115 dp down; a profile
 * card starts 78 dp down and the second icon row of the player and Worlds lists 72 dp down.
 */
private val masks = listOf(MaskSpec(96f), MaskSpec(96f), MaskSpec(68f), MaskSpec(68f), MaskSpec(68f, centre = 106f), MaskSpec(68f), MaskSpec(68f))
private const val MASK_CENTRE_FROM = .26f
private const val MASK_CENTRE_TO = .74f
/** The recorded row the caption is centred in: the top icon row (16 dp padding, 48 dp key) is 80 dp tall around the same centre. */
private const val CAPTION_ROW_DP = 80f
private const val CAPTION_IN_MS = 600

/**
 * Over the video: the top mask, then the caption in the app's font, the colour of the screen's own text. A caption comes in over its first 600 ms (it rises
 * a little, fades up and settles in size) and then floats very gently. Every caption is the same size, and none of it moves under reduced motion.
 */
@Composable
private fun ShowcaseOverlay(caption: String, clip: Int, shown: Boolean) {
    val p = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val colors = backdrop(p.dark)
    val enter = remember(caption) { Animatable(0f) }
    LaunchedEffect(caption, shown) {
        if (shown) { if (reduce) enter.snapTo(1f) else enter.animateTo(1f, tween(CAPTION_IN_MS, easing = FastOutSlowInEasing)) }
    }
    val float = if (reduce) null else rememberInfiniteTransition(label = "caption").animateFloat(-1f, 1f,
        infiniteRepeatable(tween(3_500, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "float")
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val scale = maxWidth.value / RECORDED_WIDTH_DP
        val spec = masks[clip.coerceIn(masks.indices)]
        Box(Modifier.fillMaxSize().drawWithCache {
            // The recorded screens are drawn with this same diagonal gradient across their whole size.
            val brush = Brush.linearGradient(colors, Offset.Zero, Offset(size.width, size.height))
            val band = spec.band * scale * density; val centre = spec.centre * scale * density
            onDrawBehind {
                clipRect(0f, 0f, size.width, band) { drawDithered(brush) }
                if (centre > band) clipRect(size.width * MASK_CENTRE_FROM, band, size.width * MASK_CENTRE_TO, centre) { drawDithered(brush) }
            }
        })
        Box(Modifier.fillMaxWidth().height((CAPTION_ROW_DP * scale).dp), contentAlignment = Alignment.Center) {
            BasicText(tr(caption), Modifier.padding(horizontal = 16.dp).graphicsLayer {
                val t = enter.value
                alpha = t
                translationY = (1f - t) * 10.dp.toPx() + (float?.value ?: 0f) * 2.dp.toPx()
                scaleX = .96f + .04f * t; scaleY = scaleX
            }.semantics { heading() },
                style = TextStyle(color = p.ink, fontFamily = MonoFamily, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, textAlign = TextAlign.Center, lineHeight = 1.2.em),
                maxLines = 3)
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
