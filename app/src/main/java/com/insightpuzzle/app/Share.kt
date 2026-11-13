package com.insightpuzzle.app

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

/** The website: a shared puzzle's link, and where the link lands when the game is not installed (for now the site; later the Play Store page). */
object ShareLinks {
    const val HOST = "midoripuzzle.com"
    // The site answers on www (the bare domain redirects there, and Android will not verify an app link through a redirect), so links name www.
    fun puzzle(code: String) = "https://" + short(code)
    /** The link as a chat message shows it: no scheme, so it reads short; chat apps still make it tappable (as http://, which the app also opens). */
    fun short(code: String) = "www.$HOST/p/${code.uppercase()}"

    /** The puzzle code in a shared link (http(s)://(www.)midoripuzzle.com/p/<16 hex>), or null for anything else. */
    fun code(uri: Uri?): String? {
        if (uri == null || (uri.scheme != "https" && uri.scheme != "http") || (uri.host != HOST && uri.host != "www.$HOST")) return null
        val segments = uri.pathSegments
        if (segments.size != 2 || segments[0] != "p") return null
        return segments[1].takeIf { CODE.matches(it) }?.uppercase()
    }
    private val CODE = Regex("^[A-Fa-f0-9]{16}$")
}

/**
 * Shares a community puzzle: a clean picture of its target under the MIDORI wordmark, on the page colour of the theme in use, with a "Play here" link as the
 * message. Apps that read HTML (mail) show "Play here" as the link itself; chat apps only take plain text, so there it is "Play here: www.midoripuzzle.com/p/…".
 * Tapping the link opens the puzzle in the game when it is installed, and the website otherwise. If the picture cannot be made the text goes alone.
 */
fun sharePuzzle(context: Context, grid: JSONObject, dark: Boolean) {
    val code = grid.getString("code")
    val line = tr("Play puzzle {0} by {1} in Midori.", grid.optInt("levelNumber"), grid.getString("username"))
    val here = tr("Play here")
    val text = "$line $here: ${ShareLinks.short(code)}"
    val html = "${android.text.TextUtils.htmlEncode(line)} <a href=\"${ShareLinks.puzzle(code)}\">${android.text.TextUtils.htmlEncode(here)}</a>"
    val image = try { shareImage(context, Rules.crop(grid.board("target")), dark, code) } catch (error: Exception) { Log.w("InsightShare", "image_failed ${error.javaClass.simpleName}"); null }
    val send = Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, text).putExtra(Intent.EXTRA_HTML_TEXT, html)
    if (image != null) {
        send.setType("image/png").putExtra(Intent.EXTRA_STREAM, image).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        send.clipData = ClipData.newRawUri("", image)
    } else send.setType("text/plain")
    context.startActivity(Intent.createChooser(send, tr("Share puzzle")))
}

/** Renders the share picture into the app's cache and returns a content URI the receiving app can read. */
private fun shareImage(context: Context, target: Board, dark: Boolean, code: String): Uri {
    val width = SHARE_WIDTH
    val rows = target.size; val cols = target.firstOrNull()?.length ?: 0
    // The target fills at most about half of the picture's width, in the board's own proportions.
    val gapRatio = 2.6f / 16f
    val cell = (width * .5f / (cols + (cols - 1) * gapRatio)).coerceAtMost(width * .5f / (rows + (rows - 1) * gapRatio)).coerceAtMost(width * .16f)
    val gap = cell * gapRatio
    val targetW = cols * cell + (cols - 1) * gap; val targetH = rows * cell + (rows - 1) * gap
    val titleSize = width * .085f
    val margin = width * .12f
    val height = (margin + titleSize + width * .1f + targetH + margin).toInt()
    val bitmap = ImageBitmap(width, height)
    val canvas = androidx.compose.ui.graphics.Canvas(bitmap)
    val palette = if (dark) DarkPalette else LightPalette
    val page = if (dark) Color(0xFF1F1F1F) else Color(0xFFFBF8F5)
    CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, canvas, Size(width.toFloat(), height.toFloat())) {
        drawRect(page)
        // The wordmark as on the main menu: JetBrains Mono Bold, widely spaced, in the accent colour.
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.accent.toArgb(); textSize = titleSize; letterSpacing = .3f; textAlign = android.graphics.Paint.Align.CENTER
            typeface = androidx.core.content.res.ResourcesCompat.getFont(context, R.font.jetbrains_mono_bold)
        }
        // Letter spacing adds room after the last letter too; half of it is taken back so the word sits centred.
        drawContext.canvas.nativeCanvas.drawText("MIDORI", width / 2f + titleSize * .15f, margin + titleSize * .8f, paint)
        val top = margin + titleSize + width * .1f
        val left = (width - targetW) / 2
        for (r in target.indices) for (c in target[r].indices) {
            val type = target[r][c]; if (type == '.') continue
            targetSquare(type, Offset(left + c * (cell + gap), top + r * (cell + gap)), cell, dark)
        }
    }
    val folder = File(context.cacheDir, "share").apply { mkdirs() }
    // One picture at a time: an older share is replaced, so the cache never grows.
    folder.listFiles()?.forEach { it.delete() }
    val file = File(folder, "midori-${code.lowercase()}.png")
    file.outputStream().use { bitmap.asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    return FileProvider.getUriForFile(context, "${context.packageName}.share", file)
}

/** The share picture's width in pixels (square-ish, sharp in any chat). */
private const val SHARE_WIDTH = 1080
