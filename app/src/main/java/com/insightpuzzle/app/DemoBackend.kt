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
            users.put(JSONObject().put("id", author).put("username", name).put("verified", true).put("done", JSONArray((1..(10 + index * 15)).toList())).put("badges", JSONArray(listOf("first", "first-clean", "flow", "steady"))).put("sampleXp", 850000 + index * 500000))
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
        list("worlds").forEach { w ->
            val unnumbered = list("grids").filter { it.optString("worldId") == w.getString("id") && !it.isNull("publishedAt") && !it.has("levelNumber") }
            val numbered = list("grids").count { it.optString("worldId") == w.getString("id") && !it.isNull("publishedAt") && it.has("levelNumber") }
            unnumbered.forEachIndexed { i, g -> g.put("levelNumber", numbered + i + 1); upgraded = true }
        }
        list("worlds").forEachIndexed { index, world ->
            if (!world.has("createdAt")) { world.put("createdAt", Instant.now().minusSeconds(index * 8 * 86400L).toString()); upgraded = true }
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
        fun visible(g: JSONObject): Boolean = !g.isNull("publishedAt") && !g.optBoolean("hidden") && !g.optBoolean("moderated") && entity("worlds", g.getString("worldId")).let { !it.optBoolean("hidden") && !it.optBoolean("moderated") }
        fun grid(g: JSONObject): JSONObject = JSONObject(g.toString()).apply {
            remove("hash"); put("username", person(g.getString("ownerId")).getString("username"))
            put("completed", list("gridCompletions").any { it.getString("userId") == player && it.getString("gridId") == g.getString("id") })
            put("beatenCount", list("gridCompletions").filter { it.getString("gridId") == g.getString("id") && it.getString("userId") != g.getString("ownerId") }.map { it.getString("userId") }.distinct().size)
            put("failedAttemptCount", list("attemptOutcomes").count { it.getString("gridId") == g.getString("id") && it.getString("outcome") == "failed" && it.getString("userId") != g.getString("ownerId") })
            put("worldName", if (g.isNull("worldId")) JSONObject.NULL else entity("worlds", g.getString("worldId")).getString("name"))
        }
        fun world(w: JSONObject): JSONObject = JSONObject(w.toString()).apply {
            val gs = list("grids").filter { it.optString("worldId") == w.getString("id") && !it.isNull("publishedAt") }
            val shown = gs.filter { visible(it) }.map { it.getString("id") }.toSet()
            put("username", person(w.getString("ownerId")).getString("username")); put("usedSlots", gs.size); put("gridCount", gs.count { !it.optBoolean("hidden") && !it.optBoolean("moderated") })
            put("popularity", w.optInt("samplePopularity") + list("plays").count { it.getString("gridId") in shown })
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
        fun publishInto(g: JSONObject, w: JSONObject): Long {
            val used = list("grids").count { it.optString("worldId") == w.getString("id") && !it.isNull("publishedAt") }
            if (used >= 20) failure("WORLD_FULL", "This world already contains 20 levels. Create another world.", 409)
            g.put("worldId", w.getString("id")).put("publishedAt", "${day}T00:00:00Z").put("levelNumber", used + 1)
            if (g.getString("name").isEmpty()) g.put("name", "Level ${used + 1}")
            if (g.getString("hash") in root.getJSONArray("claims").strings()) return 0L
            root.getJSONArray("claims").put(g.getString("hash"))
            return award(player, "create", g.getString("hash"), 25000, 50000)
        }
        fun profile(who: String): JSONObject {
                val p = person(who); val ws = list("worlds").filter { it.getString("ownerId") == who && !it.optBoolean("hidden") }
                val gs = list("grids").filter { it.getString("ownerId") == who && visible(it) }
                val done = p.getJSONArray("done").let { a -> List(a.length()) { a.getInt(it) } }
                val campaignHashes = done.map { hash(levels[it - 1].start, levels[it - 1].target) }.toSet()
                val community = list("gridCompletions").filter { it.getString("userId") == who }.map { entity("grids", it.getString("gridId")) }.filter { it.getString("ownerId") != who && it.getString("hash") !in campaignHashes }.distinctBy { it.getString("hash") }
                return xp(who).put("id", who).put("username", p.getString("username")).put("worldCount", ws.count { w -> gs.any { it.getString("worldId") == w.getString("id") } })
                    .put("gridCount", gs.size).put("campaignCount", done.size).put("communityCount", community.size).put("beatenCount", done.size + community.size).put("badges", p.getJSONArray("badges"))
        }
        fun progress(): JSONObject = xp(player).put("done", person(player).getJSONArray("done")).put("badges", person(player).getJSONArray("badges"))
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
        val public = route == "/v1/capabilities" || route.startsWith("/v1/auth/")
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
                val rows = list("users").map { profile(it.getString("id")) }.filter { it.getInt("gridCount") > 0 && it.getString("username").contains(query, ignoreCase = true) }
                    .sortedWith(compareByDescending<JSONObject> {
                        when (sort) { "designed" -> it.getInt("gridCount").toBigInteger(); "played" -> it.getInt("beatenCount").toBigInteger(); else -> it.getString("xpMilli").toBigInteger() }
                    }.thenByDescending { it.getString("xpMilli").toBigInteger() }.thenBy { it.getString("id") })
                JSONObject().put("items", JSONArray(rows.drop(page * 20).take(20))).put("nextPage", if ((page + 1) * 20 < rows.size) page + 1 else JSONObject.NULL)
            }
            route == "/v1/worlds" && method == "GET" -> {
                val mine = uri.getQueryParameter("mine") == "true"; val owner = uri.getQueryParameter("owner"); val query = uri.getQueryParameter("query").orEmpty(); val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 0
                val today = LocalDate.now(ZoneOffset.UTC)
                val since = when (uri.getQueryParameter("period")) {
                    "today" -> today; "week" -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); "month" -> today.withDayOfMonth(1); "year" -> today.withDayOfYear(1); else -> null
                }?.atStartOfDay(ZoneOffset.UTC)?.toInstant()
                val comparator = if (uri.getQueryParameter("sort") == "newest") compareByDescending<JSONObject> { Instant.parse(it.getString("createdAt")) }.thenBy { it.getString("id") }
                    else compareByDescending<JSONObject> { it.getInt("popularity") }.thenBy { it.getString("id") }
                val ws = list("worlds").filter { w -> (if (mine) w.getString("ownerId") == player else !w.optBoolean("hidden") && !w.optBoolean("moderated") && list("grids").any { it.optString("worldId") == w.getString("id") && visible(it) }) &&
                    (owner == null || w.getString("ownerId") == owner) && w.getString("name").contains(query, ignoreCase = true) && (since == null || !Instant.parse(w.getString("createdAt")).isBefore(since))
                }.map { world(it) }.sortedWith(comparator)
                JSONObject().put("items", JSONArray(ws.drop(page * 20).take(20))).put("nextPage", if ((page + 1) * 20 < ws.size) page + 1 else JSONObject.NULL)
            }
            route == "/v1/worlds" && method == "POST" -> JSONObject().put("id", id()).put("ownerId", player).put("name", cleanName(body.getString("name"))).put("icon", body.getString("icon")).put("hidden", false).put("moderated", false).put("createdAt", Instant.now().toString()).also { root.getJSONArray("worlds").put(it) }.let { world(it) }
            parts.size == 3 && parts[1] == "worlds" && method == "PATCH" -> { own("worlds", parts[2]).put("name", cleanName(body.getString("name"))).put("icon", body.getString("icon")).put("hidden", body.getBoolean("hidden")); JSONObject().put("accepted", true) }
            parts.size == 4 && parts[1] == "worlds" && parts[3] == "grids" -> {
                val w = entity("worlds", parts[2]); val gs = list("grids").filter { it.optString("worldId") == parts[2] && !it.isNull("publishedAt") && (visible(it) || it.getString("ownerId") == player) }.sortedBy { it.optInt("levelNumber") }
                JSONObject().put("world", world(w)).put("items", JSONArray(gs.map { grid(it) }))
            }
            route == "/v1/grids/drafts" && method == "GET" -> JSONObject().put("items", JSONArray(list("grids").filter { it.getString("ownerId") == player && it.isNull("publishedAt") }.map { grid(it) }))
            route == "/v1/grids/drafts" && method == "POST" -> {
                val start = body.board("start"); val target = body.board("target"); checked(start, target, body.getJSONArray("path"))
                val g = JSONObject().put("id", id()).put("ownerId", player).put("worldId", JSONObject.NULL).put("levelNumber", JSONObject.NULL).put("name", cleanName(body.getString("name"))).put("code", UUID.randomUUID().toString().replace("-", "").take(16).uppercase())
                    .put("start", JSONArray(start)).put("target", JSONArray(target)).put("hash", hash(start, target)).put("publishedAt", JSONObject.NULL).put("hidden", false).put("moderated", false)
                root.getJSONArray("grids").put(g); grid(g)
            }
            parts.size == 4 && parts[1] == "grids" && parts[3] == "publish" -> {
                val g = own("grids", parts[2]); val w = own("worlds", body.getString("worldId"))
                val reward = if (g.isNull("publishedAt")) publishInto(g, w) else 0L
                JSONObject().put("id", g.getString("id")).put("code", g.getString("code")).put("levelNumber", g.getInt("levelNumber")).put("awardedMilli", reward.toString())
            }
            parts.size == 4 && parts[1] == "worlds" && parts[3] == "levels" && method == "POST" -> {
                val w = own("worlds", parts[2]); val start = body.board("start"); val target = body.board("target"); checked(start, target, body.getJSONArray("path"))
                val label = body.optString("name"); val title = if (label.isBlank()) "" else cleanName(label)
                val g = JSONObject().put("id", id()).put("ownerId", player).put("worldId", JSONObject.NULL).put("levelNumber", JSONObject.NULL).put("name", title).put("code", UUID.randomUUID().toString().replace("-", "").take(16).uppercase())
                    .put("start", JSONArray(start)).put("target", JSONArray(target)).put("hash", hash(start, target)).put("publishedAt", JSONObject.NULL).put("hidden", false).put("moderated", false)
                val reward = publishInto(g, w); root.getJSONArray("grids").put(g)
                JSONObject().put("id", g.getString("id")).put("code", g.getString("code")).put("name", g.getString("name")).put("levelNumber", g.getInt("levelNumber")).put("awardedMilli", reward.toString())
            }
            parts.size == 3 && parts[1] == "grids" && method == "PATCH" -> { own("grids", parts[2]).put("name", cleanName(body.getString("name"))).put("hidden", body.getBoolean("hidden")); JSONObject().put("accepted", true) }
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
                xp(player).put("accepted", true).put("awardedMilli", reward.toString())
            }
            else -> failure("NOT_FOUND", "This action is not part of the local preview.", 404)
        }
        if (operation.isNotBlank() && !route.startsWith("/v1/auth/")) root.getJSONObject("operations").put(operationKey, JSONObject().put("fingerprint", fingerprint).put("response", result))
        if (method != "GET" || !prefs.contains("data") || upgraded) check(prefs.edit().putString("data", root.toString()).commit()) { "Could not save preview" }
        return JSONObject(result.toString())
    }
}
