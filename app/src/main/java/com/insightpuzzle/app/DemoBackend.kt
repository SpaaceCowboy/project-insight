package com.insightpuzzle.app

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import java.util.Locale
import java.time.Instant
import java.time.temporal.TemporalAdjusters
import java.time.DayOfWeek

/** Explicit, device-only preview transport. Never selected as a fallback for a real service failure. */
class DemoBackend(context: Context) {
    private val prefs = context.getSharedPreferences("online_demo_data", Context.MODE_PRIVATE)
    private val levels = Levels.parse(context.assets.open("levels.json").bufferedReader().use { it.readText() })
    private val player = "00000000-0000-4000-8000-000000000001"
    private val first = listOf("Amber", "Calm", "Clear", "Gentle", "Golden", "Quiet", "Silver", "Soft", "Still", "Warm")
    private val second = listOf("Brook", "Cove", "Dawn", "Fern", "Grove", "Leaf", "Meadow", "Pebble", "Pool", "Tide")
    private fun id() = UUID.randomUUID().toString()
    private fun failure(code: String, message: String, status: Int = 400): Nothing = throw OnlineException(status, code, message)
    private val names = NameFilter.get(context)
    private fun cleanName(name: String): String {
        names.problem(name)?.let { failure("INVALID_NAME", it) }
        return names.normalize(name)
    }
    private fun initial(): JSONObject {
        val users = JSONArray().put(JSONObject().put("id", player).put("username", "Quiet Cove").put("verified", true).put("done", JSONArray()).put("badges", JSONArray()).put("sampleXp", 0))
        val worlds = JSONArray(); val grids = JSONArray()
        listOf("Silver Grove", "Warm Fern").forEachIndexed { index, name ->
            val author = id(); val world = id()
            users.put(JSONObject().put("id", author).put("username", name).put("verified", true).put("done", JSONArray((1..(10 + index * 15)).toList())).put("badges", JSONArray(listOf("first"))).put("sampleXp", 850000 + index * 500000))
            worlds.put(JSONObject().put("id", world).put("ownerId", author).put("name", if (index == 0) "Silver Tide" else "Warm Grove").put("icon", if (index == 0) "B" else "G").put("hidden", false).put("moderated", false).put("samplePopularity", 24 - index * 7))
            listOf(0, 3, 8).forEachIndexed { n, level ->
                val spec = levels[level + index]
                grids.put(JSONObject().put("id", id()).put("ownerId", author).put("worldId", world).put("name", "${first[n + index]} ${second[n + index]}").put("levelNumber", n + 1)
                    .put("code", UUID.randomUUID().toString().replace("-", "").take(16).uppercase()).put("start", JSONArray(spec.start)).put("target", JSONArray(spec.target))
                    .put("hidden", false).put("moderated", false).put("publishedAt", "2026-10-16T00:00:00Z").put("hash", hash(spec.start, spec.target)))
            }
        }
        return JSONObject().put("users", users).put("worlds", worlds).put("grids", grids).put("sessions", JSONArray()).put("plays", JSONArray())
            .put("completions", JSONArray()).put("gridCompletions", JSONArray()).put("ledger", JSONArray()).put("operations", JSONObject())
            .put("claims", JSONArray(levels.map { hash(it.start, it.target) }.distinct()))
    }
    private fun hash(start: Board, target: Board): String {
        val (top, bottom, left, right) = Rules.bounds(start)
        fun crop(b: Board) = b.subList(top, bottom + 1).map { it.substring(left, right + 1) }
        val value = JSONArray().put(JSONArray(crop(start))).put(JSONArray(crop(target))).toString()
        return MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
    private fun checked(start: Board, target: Board, moves: JSONArray, complete: Boolean = true) {
        if (start.isEmpty() || start.size !in 1..5 || start[0].length !in 1..5 || start.any { it.length != start[0].length || it.any { c -> c !in Rules.TYPES && c != '.' } } || target.size != start.size || target.any { it.length != start[0].length }) failure("INVALID_BOARD", "Invalid puzzle dimensions.")
        if (start.joinToString("").toList().sorted() != target.joinToString("").toList().sorted() || start.indices.any { r -> start[r].indices.any { c -> (start[r][c] == '.') != (target[r][c] == '.') } } || start == target) failure("INVALID_BOARD", "Start and target must have matching tiles and fixed holes.")
        if (moves.length() !in 1..10000) failure("INVALID_PATH", "Provide a legal solution.")
        var board = start
        for (i in 0 until moves.length()) {
            val step = moves.getJSONArray(i); val a = step.getInt(0); val b = step.getInt(1); val width = start[0].length
            if (a !in 0 until width * start.size || b !in 0 until width * start.size || board == target) failure("ILLEGAL_MOVE", "Invalid solution path.")
            val from = Pos(a / width, a % width); val to = Pos(b / width, b % width)
            if (!Rules.isLegal(board, from, to)) failure("ILLEGAL_MOVE", "Move does not follow the tile rule.")
            board = Rules.swap(board, from, to)
        }
        if (complete && board != target) failure("NOT_SOLVED", "The solution does not reach the target.")
        if (!complete && board == target) return
    }
    @Synchronized fun request(method: String, path: String, body: JSONObject, access: String?): JSONObject {
        val root = prefs.getString("data", null)?.let { JSONObject(it) } ?: initial()
        val uri = Uri.parse("https://preview.local$path"); val route = uri.path!!
        fun list(key: String) = root.getJSONArray(key).objects()
        var upgraded = false
        if (!root.has("attemptOutcomes")) { root.put("attemptOutcomes", JSONArray()); upgraded = true }
        // Likes, bookmarks, follows and the days the player solved something (daily streak).
        for (key in listOf("likes", "bookmarks", "follows", "activity")) if (!root.has(key)) { root.put(key, JSONArray()); upgraded = true }
        // Flatten historical preview collections once, preserving puzzle identities and completions.
        if (!root.optBoolean("flatPuzzles")) {
            list("grids").groupBy { it.getString("ownerId") }.values.forEach { owned ->
                owned.filter { !it.isNull("publishedAt") }.forEachIndexed { index, g ->
                    val world = list("worlds").firstOrNull { it.getString("id") == g.optString("worldId") }
                    g.put("levelNumber", index + 1)
                    if (world?.optBoolean("hidden") == true) g.put("hidden", true)
                    if (world?.optBoolean("moderated") == true) g.put("moderated", true)
                }
            }
            root.put("flatPuzzles", true); upgraded = true
        }
        fun entity(key: String, value: String) = list(key).firstOrNull { it.getString("id") == value } ?: failure("NOT_FOUND", "Preview item unavailable.", 404)
        fun own(key: String, value: String): JSONObject = entity(key, value).also { if (it.optString("ownerId") != player || it.optBoolean("moderated")) failure("NOT_FOUND", "Item unavailable.", 404) }
        fun person(value: String) = entity("users", value)
        fun rename(value: String) {
            if (!Nicknames.valid(value)) failure("INVALID_NICKNAME", Nicknames.REQUIREMENT)
            val name = Nicknames.normalize(value)
            val key = name.lowercase(Locale.ROOT)
            if (list("users").any { it.getString("id") != player && Nicknames.normalize(it.getString("username")).lowercase(Locale.ROOT) == key }) failure("NAME_TAKEN", "That nickname is already taken. Choose another.", 409)
            person(player).put("username", name)
        }
        fun publicUser(value: String) = person(value).let { JSONObject().put("id", value).put("username", it.getString("username")).put("verified", true) }
        fun visible(g: JSONObject): Boolean = !g.isNull("publishedAt") && !g.optBoolean("hidden") && !g.optBoolean("moderated")
        fun grid(g: JSONObject): JSONObject = JSONObject(g.toString()).apply {
            remove("hash"); remove("worldId"); remove("name")
            put("username", person(g.getString("ownerId")).getString("username"))
            put("completed", list("gridCompletions").any { it.getString("userId") == player && it.getString("gridId") == g.getString("id") })
            put("beatenCount", list("gridCompletions").filter { it.getString("gridId") == g.getString("id") && it.getString("userId") != g.getString("ownerId") }.map { it.getString("userId") }.distinct().size)
            put("failedAttemptCount", list("attemptOutcomes").count { it.getString("gridId") == g.getString("id") && it.getString("outcome") == "failed" && it.getString("userId") != g.getString("ownerId") })
            put("popularity", list("plays").count { it.getString("gridId") == g.getString("id") })
            put("likeCount", list("likes").count { it.getString("gridId") == g.getString("id") })
            put("liked", list("likes").any { it.getString("gridId") == g.getString("id") && it.getString("userId") == player })
            put("bookmarked", list("bookmarks").any { it.getString("gridId") == g.getString("id") && it.getString("userId") == player })
        }
        val day = LocalDate.now(ZoneOffset.UTC).toString()
        fun award(owner: String, reason: String, source: String, amount: Long, cap: Long = Long.MAX_VALUE): Long {
            val ledger = list("ledger")
            if (ledger.any { it.getString("userId") == owner && it.getString("reason") == reason && it.getString("source") == source }) return 0
            val total = ledger.filter { it.getString("userId") == owner && it.getString("reason") == reason && it.getString("day") == day }.sumOf { it.getLong("amount") }
            val awarded = minOf(amount, cap - total).coerceAtLeast(0)
            if (awarded > 0) root.getJSONArray("ledger").put(JSONObject().put("userId", owner).put("reason", reason).put("source", source).put("amount", awarded).put("day", day))
            return awarded
        }
        fun xp(owner: String): JSONObject {
            val total = person(owner).optLong("sampleXp") + list("ledger").filter { it.getString("userId") == owner }.sumOf { it.getLong("amount") }
            fun threshold(level: Int): Long { val n = (level - 1).toLong(); return (100 * n + 10 * n * (n - 1)) * 1000 }
            var level = 1; while (level < 100 && total >= threshold(level + 1)) level++
            return JSONObject().put("level", level).put("xpMilli", total.toString()).put("levelStartMilli", threshold(level).toString()).put("nextLevelMilli", if (level == 100) JSONObject.NULL else threshold(level + 1).toString())
        }
        fun days(who: String) = list("activity").filter { it.getString("userId") == who }.map { LocalDate.parse(it.getString("day")) }.toSet()
        fun stats(who: String): OnlineStats {
            val solved = list("gridCompletions").filter { it.getString("userId") == who }.map { it.getString("gridId") }.distinct()
                .count { g -> list("grids").any { it.getString("id") == g && it.getString("ownerId") != who } }
            val designed = list("grids").count { it.getString("ownerId") == who && !it.isNull("publishedAt") }
            val sorted = days(who).sorted(); var best = 0; var run = 0
            sorted.forEachIndexed { i, d -> run = if (i > 0 && sorted[i - 1].plusDays(1) == d) run + 1 else 1; best = maxOf(best, run) }
            return OnlineStats(solved, designed, best)
        }
        fun streak(who: String, today: LocalDate): Int {
            val set = days(who); var d = if (today in set) today else today.minusDays(1); var run = 0
            while (d in set) { run++; d = d.minusDays(1) }
            return run
        }
        fun awardSocial(who: String) {
            val s = stats(who)
            val earned = Achievements(levels).catalog.filter { it.metric != Metric.CAMPAIGN && Achievements(levels).progress(it, emptySet(), s) >= it.goal }.map { it.id }
            person(who).put("badges", JSONArray((person(who).getJSONArray("badges").strings() + earned).distinct()))
        }
        val clientToday = uri.getQueryParameter("today")?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now(ZoneOffset.UTC)
        fun profile(who: String): JSONObject {
                val p = person(who)
                val gs = list("grids").filter { it.getString("ownerId") == who && visible(it) }
                val done = p.getJSONArray("done").let { a -> List(a.length()) { a.getInt(it) } }
                val campaignHashes = done.map { hash(levels[it - 1].start, levels[it - 1].target) }.toSet()
                val community = list("gridCompletions").filter { it.getString("userId") == who }.map { entity("grids", it.getString("gridId")) }.filter { it.getString("ownerId") != who && it.getString("hash") !in campaignHashes }.distinctBy { it.getString("hash") }
                return xp(who).put("id", who).put("username", p.getString("username"))
                    .put("gridCount", gs.size).put("campaignCount", done.size).put("communityCount", community.size).put("beatenCount", done.size + community.size).put("badges", p.getJSONArray("badges"))
                    .put("followerCount", list("follows").count { it.getString("followee") == who }).put("following", list("follows").any { it.getString("followee") == who && it.getString("follower") == player })
                    .put("streak", streak(who, clientToday)).put("followingCount", list("follows").count { it.getString("follower") == who })
                    .put("bookmarkCount", if (who != player) 0 else list("bookmarks").count { b -> b.getString("userId") == who && list("grids").any { it.getString("id") == b.getString("gridId") && visible(it) } })
        }
        fun progress(): JSONObject = xp(player).put("done", person(player).getJSONArray("done")).put("badges", person(player).getJSONArray("badges"))
            .put("onlineSolved", stats(player).onlineSolved).put("designedCount", stats(player).designedCount).put("bestStreak", stats(player).bestStreak)
            .put("communityDone", JSONArray(list("gridCompletions").filter { it.getString("userId") == player }.map { it.getString("gridId") }))
        fun qualify(g: JSONObject) {
            if (g.getString("ownerId") == player || list("plays").any { it.getString("gridId") == g.getString("id") && it.getString("userId") == player }) return
            root.getJSONArray("plays").put(JSONObject().put("gridId", g.getString("id")).put("userId", player))
            award(g.getString("ownerId"), "play", "$player:${g.getString("id")}", 1)
        }
        fun session(value: String): JSONObject = list("sessions").firstOrNull { it.getString("id") == value }?.let { entity("grids", it.getString("gridId")) } ?: failure("SESSION_UNAVAILABLE", "Open the preview grid again.", 404)
        fun outcome(g: JSONObject, sessionId: String, result: String): Boolean {
            val attempt = body.optString("attemptId")
            if (attempt.isBlank()) return true
            val existing = list("attemptOutcomes").firstOrNull { it.getString("userId") == player && it.getString("attemptId") == attempt }
            if (existing != null) {
                if (existing.getString("gridId") != g.getString("id") || existing.getString("sessionId") != sessionId || existing.getString("outcome") != result ||
                    (result == "failed" && existing.optString("reason") != body.optString("reason"))) failure("ATTEMPT_CLOSED", "This attempt has already ended.", 409)
                return false
            }
            root.getJSONArray("attemptOutcomes").put(JSONObject().put("userId", player).put("attemptId", attempt).put("gridId", g.getString("id")).put("sessionId", sessionId).put("outcome", result).put("reason", body.optString("reason")))
            return true
        }
        fun since(period: String?): Instant? {
            val today = LocalDate.now(ZoneOffset.UTC)
            return when (period) {
                "today" -> today; "week" -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); "month" -> today.withDayOfMonth(1); "year" -> today.withDayOfYear(1); else -> null
            }?.atStartOfDay(ZoneOffset.UTC)?.toInstant()
        }
        fun creator(who: String, likedSince: Instant?): JSONObject = profile(who).put("likeCount", list("likes").count { l ->
            list("grids").any { it.getString("id") == l.getString("gridId") && it.getString("ownerId") == who && visible(it) } && (likedSince == null || !Instant.parse(l.getString("at")).isBefore(likedSince))
        })
        val public = route == "/v1/capabilities" || route.startsWith("/v1/auth/") || route == "/v1/feedback"
        if (!public && access == null) failure("AUTH_REQUIRED", "Enter the local preview first.", 401)
        val operation = body.optString("operationId")
        val operationKey = "$player:$operation"
        val fingerprint = "$method $path ${body}"
        if (operation.isNotBlank() && !route.startsWith("/v1/auth/")) root.getJSONObject("operations").optJSONObject(operationKey)?.let {
            if (it.getString("fingerprint") != fingerprint) failure("OPERATION_REUSED", "Use a new operation for changed input.", 409)
            return it.getJSONObject("response")
        }
        val parts = route.trim('/').split('/')
        val result: JSONObject = when {
            route == "/v1/capabilities" -> JSONObject().put("emailDelivery", "local-preview")
            route == "/v1/auth/login" -> {
                rename(body.optString("password", "Quiet Cove"))
                JSONObject().put("accessToken", "D".repeat(43)).put("refreshToken", "R".repeat(43)).put("user", publicUser(player))
            }
            route == "/v1/auth/refresh" -> JSONObject().put("accessToken", "D".repeat(43)).put("refreshToken", "R".repeat(43)).put("user", publicUser(player))
            route == "/v1/auth/logout" -> JSONObject().put("accepted", true)
            route == "/v1/account" -> JSONObject().put("user", publicUser(player))
            route == "/v1/progress" -> progress()
            route == "/v1/progress/import" -> {
                val p = person(player)
                p.put("done", JSONArray((p.getJSONArray("done").let { a -> List(a.length()) { a.getInt(it) } } + body.getJSONArray("done").let { a -> List(a.length()) { a.getInt(it) } }).distinct()))
                p.put("badges", JSONArray((p.getJSONArray("badges").strings() + body.getJSONArray("badges").strings()).distinct()))
                JSONObject().put("accepted", true).put("awardedMilli", "0")
            }
            parts.size == 3 && parts[1] == "profiles" -> profile(parts[2])
            route == "/v1/creators" -> {
                val query = uri.getQueryParameter("query").orEmpty()
                val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 0
                val sort = uri.getQueryParameter("sort") ?: "level"
                val since = since(uri.getQueryParameter("period"))
                val rows = list("users").map { creator(it.getString("id"), since) }.filter { it.getInt("gridCount") > 0 && it.getString("username").contains(query, ignoreCase = true) }
                    .sortedWith(compareByDescending<JSONObject> {
                        when (sort) { "designed" -> it.getInt("gridCount").toBigInteger(); "played" -> it.getInt("beatenCount").toBigInteger(); "liked" -> it.getInt("likeCount").toBigInteger(); else -> it.getString("xpMilli").toBigInteger() }
                    }.thenByDescending { it.getString("xpMilli").toBigInteger() }.thenBy { it.getString("id") })
                JSONObject().put("items", JSONArray(rows.drop(page * 20).take(20))).put("nextPage", if ((page + 1) * 20 < rows.size) page + 1 else JSONObject.NULL)
            }
            route == "/v1/following" || route == "/v1/followers" -> {
                val mine = route == "/v1/following"
                val rows = list("follows").filter { it.getString(if (mine) "follower" else "followee") == player }.map { creator(it.getString(if (mine) "followee" else "follower"), null) }.sortedByDescending { it.getString("xpMilli").toBigInteger() }
                val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 0
                JSONObject().put("items", JSONArray(rows.drop(page * 20).take(20))).put("nextPage", if ((page + 1) * 20 < rows.size) page + 1 else JSONObject.NULL)
            }
            // The preview keeps feedback on the device; the real server emails it.
            route == "/v1/feedback" && method == "POST" -> {
                if (body.optString("text").isBlank()) failure("INVALID_REQUEST", "Write something first.", 400)
                if (!root.has("feedback")) root.put("feedback", JSONArray())
                root.getJSONArray("feedback").put(JSONObject().put("kind", body.optString("kind")).put("text", body.optString("text")).put("at", Instant.now().toString()))
                JSONObject().put("accepted", true)
            }
            parts.size == 4 && parts[1] == "users" && parts[3] == "follow" && method == "POST" -> {
                val who = parts[2]; person(who)
                if (who == player) failure("SELF_FOLLOW", "You cannot follow yourself.")
                val follows = root.getJSONArray("follows")
                val existing = (0 until follows.length()).firstOrNull { follows.getJSONObject(it).getString("follower") == player && follows.getJSONObject(it).getString("followee") == who }
                if (body.getBoolean("on") && existing == null) follows.put(JSONObject().put("follower", player).put("followee", who).put("at", Instant.now().toString()))
                if (!body.getBoolean("on") && existing != null) follows.remove(existing)
                JSONObject().put("following", body.getBoolean("on")).put("followerCount", list("follows").count { it.getString("followee") == who })
            }
            parts.size == 4 && parts[1] == "grids" && (parts[3] == "like" || parts[3] == "bookmark") && method == "POST" -> {
                val g = entity("grids", parts[2]); if (!visible(g)) failure("NOT_FOUND", "Grid unavailable.", 404)
                val like = parts[3] == "like"
                if (like && g.getString("ownerId") == player) failure("OWN_PUZZLE", "You cannot like your own puzzle.")
                val rows = root.getJSONArray(if (like) "likes" else "bookmarks")
                val existing = (0 until rows.length()).firstOrNull { rows.getJSONObject(it).getString("userId") == player && rows.getJSONObject(it).getString("gridId") == g.getString("id") }
                if (body.getBoolean("on") && existing == null) rows.put(JSONObject().put("userId", player).put("gridId", g.getString("id")).put("at", Instant.now().toString()))
                if (!body.getBoolean("on") && existing != null) rows.remove(existing)
                if (like) JSONObject().put("liked", body.getBoolean("on")).put("likeCount", list("likes").count { it.getString("gridId") == g.getString("id") })
                else JSONObject().put("bookmarked", body.getBoolean("on"))
            }
            route == "/v1/grids" && method == "GET" -> {
                val owner = uri.getQueryParameter("owner")
                val query = uri.getQueryParameter("query").orEmpty().trim()
                val page = (uri.getQueryParameter("page")?.toIntOrNull() ?: 0).coerceAtLeast(0)
                val since = since(uri.getQueryParameter("period"))
                val bookmarked = uri.getQueryParameter("bookmarked") == "true"
                fun bookmarkedAt(g: JSONObject) = list("bookmarks").firstOrNull { it.getString("userId") == player && it.getString("gridId") == g.getString("id") }?.getString("at")
                val comparator = if (bookmarked) compareByDescending<JSONObject> { bookmarkedAt(it) }.thenBy { it.getString("id") } else when (uri.getQueryParameter("sort")) {
                    "liked" -> compareByDescending<JSONObject> { it.getInt("likeCount") }.thenBy { it.getString("id") }
                    "number" -> compareBy<JSONObject> { it.getInt("levelNumber") }.thenBy { it.getString("id") }
                    "newest" -> compareByDescending<JSONObject> { Instant.parse(it.getString("publishedAt")) }.thenBy { it.getString("id") }
                    else -> compareByDescending<JSONObject> { it.getInt("popularity") }.thenByDescending { it.getString("publishedAt") }.thenBy { it.getString("id") }
                }
                val rows = list("grids").filter { g -> !g.isNull("publishedAt") &&
                    (visible(g) || owner == player && g.getString("ownerId") == player) &&
                    (owner == null || g.getString("ownerId") == owner) &&
                    (query.isEmpty() || if (query.all { it.isDigit() }) g.getInt("levelNumber") == query.toIntOrNull() else person(g.getString("ownerId")).getString("username").contains(query, true)) &&
                    (since == null || !Instant.parse(g.getString("publishedAt")).isBefore(since)) &&
                    (!bookmarked || bookmarkedAt(g) != null)
                }.map { grid(it) }.sortedWith(comparator)
                JSONObject().put("items", JSONArray(rows.drop(page * 20).take(20))).put("nextPage", if ((page + 1) * 20 < rows.size) page + 1 else JSONObject.NULL)
            }
            route == "/v1/grids" && method == "POST" -> {
                val start = body.board("start"); val target = body.board("target"); checked(start, target, body.getJSONArray("path"))
                val number = (list("grids").filter { it.getString("ownerId") == player && !it.isNull("publishedAt") }.maxOfOrNull { it.getInt("levelNumber") } ?: 0) + 1
                val g = JSONObject().put("id", id()).put("ownerId", player).put("levelNumber", number)
                    .put("code", UUID.randomUUID().toString().replace("-", "").take(16).uppercase(Locale.ROOT))
                    .put("start", JSONArray(start)).put("target", JSONArray(target)).put("hash", hash(start, target))
                    .put("publishedAt", Instant.now().toString()).put("hidden", false).put("moderated", false)
                var reward = 0L
                if (g.getString("hash") !in root.getJSONArray("claims").strings()) {
                    root.getJSONArray("claims").put(g.getString("hash")); reward = award(player, "create", g.getString("hash"), 25000, 50000)
                }
                root.getJSONArray("grids").put(g)
                awardSocial(player)
                JSONObject().put("id", g.getString("id")).put("code", g.getString("code")).put("levelNumber", number).put("awardedMilli", reward.toString())
            }
            parts.size == 3 && parts[1] == "grids" && method == "PATCH" -> { own("grids", parts[2]).put("hidden", body.getBoolean("hidden")); JSONObject().put("accepted", true) }
            parts.size == 4 && parts[1] == "grids" && parts[2] == "code" -> JSONObject().put("grid", list("grids").firstOrNull { it.getString("code") == parts[3] && visible(it) }?.let { grid(it) } ?: failure("NOT_FOUND", "Preview grid not found.", 404))
            route == "/v1/casual/sessions" -> {
                if (!root.has("casualCycle")) {
                    root.put("casualCycle", 1)
                    root.put("casualDone", JSONArray(list("gridCompletions").filter { it.getString("userId") == player }.map { it.getString("gridId") }))
                }
                val eligible = list("grids").filter { visible(it) && it.getString("ownerId") != player && !person(it.getString("ownerId")).optBoolean("suspended") }
                var remaining = eligible.filter { it.getString("id") !in root.getJSONArray("casualDone").strings() }
                if (remaining.isEmpty() && eligible.isNotEmpty()) {
                    root.put("casualCycle", root.getInt("casualCycle") + 1).put("casualDone", JSONArray())
                    remaining = eligible
                }
                val g = remaining.randomOrNull()
                if (g == null) JSONObject().put("sessionId", JSONObject.NULL).put("grid", JSONObject.NULL)
                else {
                    val identity = id()
                    root.getJSONArray("sessions").put(JSONObject().put("id", identity).put("gridId", g.getString("id")).put("casualCycle", root.getInt("casualCycle")))
                    JSONObject().put("sessionId", identity).put("grid", grid(g))
                }
            }
            parts.size == 4 && parts[1] == "grids" && parts[3] == "sessions" -> {
                val g = entity("grids", parts[2]); if (!visible(g)) failure("NOT_FOUND", "Grid unavailable.", 404)
                val s = id(); root.getJSONArray("sessions").put(JSONObject().put("id", s).put("gridId", g.getString("id")))
                JSONObject().put("sessionId", s).put("grid", grid(g))
            }
            parts.size == 4 && parts[1] == "play-sessions" -> {
                val g = session(parts[2]); checked(g.board("start"), g.board("target"), body.getJSONArray("path"), false)
                if (parts[3] == "failures") {
                    if (body.optString("attemptId").isBlank() || body.optString("reason") !in listOf("restart", "leave")) failure("INVALID_REQUEST", "Check the attempt fields.")
                    var board = g.board("start"); val width = board[0].length
                    body.getJSONArray("path").let { moves -> for (i in 0 until moves.length()) { val step = moves.getJSONArray(i); board = Rules.swap(board, Pos(step.getInt(0) / width, step.getInt(0) % width), Pos(step.getInt(1) / width, step.getInt(1) % width)) } }
                    if (board == g.board("target")) failure("ALREADY_SOLVED", "A solved attempt cannot be marked as failed.")
                    outcome(g, parts[2], "failed")
                }
                qualify(g); JSONObject().put("accepted", true)
            }
            route == "/v1/completions" -> {
                if (body.optBoolean("debug")) failure("DEBUG_ACTIVITY", "Debug activity cannot earn XP.")
                val community = body.getString("kind") == "community"
                val g = if (community) session(body.getString("sessionId")) else null
                val level = if (community) null else levels[body.getInt("levelId") - 1]
                val start = g?.board("start") ?: level!!.start; val target = g?.board("target") ?: level!!.target
                checked(start, target, body.getJSONArray("path")); val hash = hash(start, target)
                // Any solve keeps the daily streak, dated by the player's calendar (within a day of UTC).
                val solvedOn = body.optString("day").let { runCatching { LocalDate.parse(it) }.getOrNull() }
                    ?.takeIf { kotlin.math.abs(it.toEpochDay() - LocalDate.now(ZoneOffset.UTC).toEpochDay()) <= 1 } ?: LocalDate.now(ZoneOffset.UTC)
                if (list("activity").none { it.getString("userId") == player && it.getString("day") == solvedOn.toString() })
                    root.getJSONArray("activity").put(JSONObject().put("userId", player).put("day", solvedOn.toString()))
                val freshAttempt = g == null || outcome(g, body.getString("sessionId"), "solved")
                if (g != null) {
                    qualify(g)
                    val playedSession = list("sessions").first { it.getString("id") == body.getString("sessionId") }
                    if (freshAttempt && root.has("casualCycle") && (!playedSession.has("casualCycle") || playedSession.getInt("casualCycle") == root.getInt("casualCycle"))) {
                        val done = root.getJSONArray("casualDone")
                        if (g.getString("id") !in done.strings()) done.put(g.getString("id"))
                    }
                    if (list("gridCompletions").none { it.getString("userId") == player && it.getString("gridId") == g.getString("id") }) root.getJSONArray("gridCompletions").put(JSONObject().put("userId", player).put("gridId", g.getString("id")))
                } else {
                    val done = person(player).getJSONArray("done").let { a -> List(a.length()) { a.getInt(it) } }.toSet() + body.getInt("levelId")
                    person(player).put("done", JSONArray(done.sorted()))
                    val earned = Achievements(levels).newlyEarned(done, person(player).getJSONArray("badges").strings().associateWith { 0L }).map { it.id }
                    person(player).put("badges", JSONArray((person(player).getJSONArray("badges").strings() + earned).distinct()))
                }
                var reward = 0L
                if (freshAttempt && list("grids").none { it.getString("ownerId") == player && it.getString("hash") == hash && !it.isNull("publishedAt") }) {
                    val firstSolve = list("completions").none { it.getString("userId") == player && it.getString("hash") == hash }
                    if (firstSolve) {
                        root.getJSONArray("completions").put(JSONObject().put("userId", player).put("hash", hash)); reward = award(player, "first", hash, 100000)
                    } else reward = award(player, "replay", "$hash:$day", 10000, 50000)
                }
                awardSocial(player)
                xp(player).put("accepted", true).put("awardedMilli", reward.toString())
            }
            else -> failure("NOT_FOUND", "This action is not part of the local preview.", 404)
        }
        if (operation.isNotBlank() && !route.startsWith("/v1/auth/")) root.getJSONObject("operations").put(operationKey, JSONObject().put("fingerprint", fingerprint).put("response", result))
        if (method != "GET" || !prefs.contains("data") || upgraded) check(prefs.edit().putString("data", root.toString()).commit()) { "Could not save preview" }
        return JSONObject(result.toString())
    }
}
