package com.insightpuzzle.app

import org.json.JSONObject
import java.util.UUID

/** One visit/attempt, separate from the saved board and the server's play session. */
data class PlayAttempt(val id: String, val session: String, val baseline: Int, val startedAt: Long, val closed: Boolean = false) {
    fun json() = JSONObject().put("id", id).put("session", session).put("baseline", baseline).put("startedAt", startedAt).put("closed", closed)
    fun canFail(moves: Int, solved: Boolean, dev: Boolean) = !closed && !solved && !dev && moves > baseline
    companion object {
        fun open(saved: JSONObject?, session: String, moves: Int, now: Long = System.currentTimeMillis()): PlayAttempt {
            // Keep interrupted visits, but renew old sessions before the service's seven-day expiry.
            if (saved != null && !saved.optBoolean("closed") && saved.optInt("baseline") in 0..moves && now - saved.optLong("startedAt") in 0 until 6 * 86400000L) {
                return PlayAttempt(saved.getString("id"), saved.getString("session"), saved.getInt("baseline"), saved.getLong("startedAt"))
            }
            return PlayAttempt(UUID.randomUUID().toString(), session, moves, now)
        }
    }
}
