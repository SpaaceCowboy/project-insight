package com.insightpuzzle.app

import java.security.MessageDigest
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Both HTTP Retry-After forms; a bad/missing header falls back to the JSON contract. */
internal fun retryAfterMillis(header: String?, bodySeconds: Long = 0, nowMillis: Long = System.currentTimeMillis()): Long {
    val seconds = header?.trim()?.toLongOrNull()
    val millis = if (seconds != null && seconds >= 0) seconds.coerceAtMost(86400) * 1000 else {
        val date = try { header?.let { ZonedDateTime.parse(it, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli() } } catch (_: Exception) { null }
        if (date != null) (date - nowMillis).coerceIn(0, 86_400_000) else bodySeconds.coerceIn(0, 86400) * 1000
    }
    return millis
}

internal data class RequestCooldown(val status: Int, val policy: String, val remainingMillis: Long)

/** Persistent advisory cooldowns. Server enforcement remains authoritative. No tokens or email addresses are stored. */
internal class RateLimitCooldown(initial: Map<String, Long> = emptyMap(), private val now: () -> Long = System::currentTimeMillis) {
    private val deadlines = initial.toMutableMap()
    private val auth = setOf("/v1/auth/register", "/v1/auth/login", "/v1/auth/google", "/v1/auth/recover/request", "/v1/auth/recover/confirm")
    private val policies = listOf("ingress", "store", "edge", "authCapacity", "authIp", "registerIp", "refreshIp", "authPair", "loginAddress", "googleIdentity", "recoveryAddress", "recoveryConfirm", "refreshAccount", "account", "read", "discovery", "write", "sync", "feedback", "notFound", "endpoint")
    private fun key(status: Int, policy: String, method: String, rawPath: String, account: String?, identity: String?): String? {
        val path = rawPath.substringBefore('?')
        val discovery = method == "GET" && (path in setOf("/v1/grids", "/v1/creators", "/v1/following", "/v1/followers") || path.startsWith("/v1/profiles/") || path.startsWith("/v1/grids/code/"))
        val sync = method == "POST" && (path in setOf("/v1/completions", "/v1/progress/import") || (path.startsWith("/v1/play-sessions/") && (path.endsWith("/move") || path.endsWith("/failures"))))
        val scope = when (policy) {
            "ingress", "store", "edge" -> "device"
            "authCapacity", "authIp" -> if (method == "POST" && path in auth) "auth" else return null
            "registerIp" -> if (path == "/v1/auth/register") "register" else return null
            "googleIdentity" -> if (path == "/v1/auth/google") "google" else return null
            "refreshIp" -> if (path == "/v1/auth/refresh") "refresh" else return null
            "authPair", "loginAddress", "recoveryAddress", "recoveryConfirm" -> if (path in auth) "$path:${identity?.trim()?.lowercase().orEmpty()}" else return null
            "refreshAccount" -> if (path == "/v1/auth/refresh") account ?: return null else return null
            "account" -> account ?: return null
            "discovery" -> if (discovery) account ?: return null else return null
            "read" -> if (method == "GET" && !discovery) account ?: return null else return null
            "sync" -> if (sync) account ?: return null else return null
            "write" -> if (method != "GET" && !sync && path != "/v1/feedback") account ?: return null else return null
            "feedback" -> if (path == "/v1/feedback") account ?: "guest" else return null
            else -> "$method:$path:${account ?: "guest"}"
        }
        val bytes = MessageDigest.getInstance("SHA-256").digest("$status:$policy:$scope".toByteArray())
        val hex = "0123456789abcdef"
        return buildString(64) { bytes.forEach { val n = it.toInt() and 255; append(hex[n ushr 4]); append(hex[n and 15]) } }
    }
    @Synchronized fun remaining(method: String, path: String, account: String?, identity: String? = null): RequestCooldown? {
        val time = now()
        deadlines.entries.removeAll { it.value <= time }
        if (deadlines.isEmpty()) return null
        return policies.flatMap { policy -> listOf(429, 503).mapNotNull { status ->
            val deadline = key(status, policy, method, path, account, identity)?.let { deadlines[it] } ?: return@mapNotNull null
            (deadline - time).coerceIn(0, 86_400_000).takeIf { it > 0 }?.let { RequestCooldown(status, policy, it) }
        } }.maxByOrNull { it.remainingMillis }
    }
    @Synchronized fun remember(status: Int, suppliedPolicy: String, method: String, path: String, account: String?, delayMillis: Long, identity: String? = null) {
        if (status !in listOf(429, 503) || delayMillis <= 0) return
        val policy = suppliedPolicy.takeIf { it in policies } ?: "endpoint"
        val key = key(status, policy, method, path, account, identity) ?: return
        val time = now()
        deadlines.entries.removeAll { it.value <= time }
        if (deadlines.size >= 256 && key !in deadlines) deadlines.minByOrNull { it.value }?.let { deadlines.remove(it.key) }
        deadlines[key] = maxOf(deadlines[key] ?: 0, time + delayMillis.coerceAtMost(86_400_000))
    }
    @Synchronized fun snapshot(): Map<String, Long> = deadlines.filterValues { it > now() }
}
