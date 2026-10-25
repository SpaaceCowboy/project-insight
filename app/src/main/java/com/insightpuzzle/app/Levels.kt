package com.insightpuzzle.app

import org.json.JSONArray

data class Level(val name: String, val start: Board, val target: Board, val world: Int, val par: Int)

object Levels {
    /** Parses assets/levels.json, generated from the web game by tools/export-assets.mjs. */
    fun parse(json: String): List<Level> {
        val array = JSONArray(json)
        return List(array.length()) { i ->
            val item = array.getJSONObject(i)
            fun rows(key: String) = item.getJSONArray(key).let { a -> List(a.length()) { a.getString(it) } }
            Level(item.optString("name", ""), rows("start"), rows("target"), item.optInt("world", i / 20 + 1), item.optInt("par"))
        }
    }
}
