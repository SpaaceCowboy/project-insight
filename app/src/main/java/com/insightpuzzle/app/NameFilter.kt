package com.insightpuzzle.app

import android.content.Context
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

/** Free-text world and level names with a blocklist; the algorithm and word lists mirror server/src/names.ts. */
class NameFilter(exact: List<String>, contains: List<String>) {
    private val exact = exact.flatMap { listOf(it, collapse(it)) }.toSet()
    private val roots = contains.map { collapse(it) }

    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC).trim().replace(Regex("[\\s\\p{Z}\\uFEFF]+"), " ")

    /** Player-facing reason the name cannot be used, or null when it is fine. */
    fun problem(value: String): String? {
        val name = normalize(value)
        val withoutJoiners = name.replace("\u200c", "").replace("\u200d", "")
        val formatOk = name.codePointCount(0, name.length) <= 32 && Regex("[\\p{L}\\p{N}\\p{P}\\p{S}]").containsMatchIn(name) && !Regex("\\p{C}").containsMatchIn(withoutJoiners)
        return when {
            !formatOk -> FORMAT
            isBlocked(name) -> NOT_ALLOWED
            else -> null
        }
    }

    /** A blank level name is allowed and becomes "Level N". */
    fun levelProblem(value: String): String? = if (value.isBlank()) null else problem(value)

    fun isBlocked(value: String): Boolean {
        val exactCandidates = mutableListOf<String>(); val rootCandidates = mutableListOf<String>(); var run = ""
        for (word in fold(value).split(Regex("\\s+")).filter { it.isNotEmpty() } + "") {
            val letters = word.replace(Regex("[^a-z]"), "")
            if (word.codePointCount(0, word.length) == 1 && letters.length == 1) { run += letters; continue }
            if (run.length > 1) { exactCandidates += run; rootCandidates += run }
            run = ""
            if (letters.isNotEmpty()) { exactCandidates += letters; rootCandidates += letters }
            exactCandidates += word.split(Regex("[^a-z]+")).filter { it.isNotEmpty() }
        }
        return exactCandidates.any { it in exact || collapse(it) in exact } || rootCandidates.any { candidate -> roots.any { collapse(candidate).contains(it) } }
    }

    private fun fold(value: String): String =
        Normalizer.normalize(Normalizer.normalize(value, Normalizer.Form.NFKC).lowercase(Locale.ROOT), Normalizer.Form.NFD).replace(Regex("\\p{M}"), "")
            .map { LEET[it] ?: it }.joinToString("")

    companion object {
        const val FORMAT = "Choose a name of 1–32 visible characters."
        const val NOT_ALLOWED = "That name isn't allowed. Please choose another."
        private val LEET = mapOf('0' to 'o', '1' to 'i', '3' to 'e', '4' to 'a', '5' to 's', '7' to 't', '@' to 'a', '$' to 's', '!' to 'i')
        private fun collapse(value: String) = value.replace(Regex("(.)\\1+"), "$1")
        fun fromJson(text: String): NameFilter {
            val json = JSONObject(text)
            fun words(key: String) = json.getJSONArray(key).let { a -> List(a.length()) { a.getString(it) } }
            return NameFilter(words("exact"), words("contains"))
        }
        @Volatile private var shared: NameFilter? = null
        fun get(context: Context): NameFilter = shared ?: synchronized(this) {
            shared ?: fromJson(context.applicationContext.assets.open("blocked-words.json").bufferedReader().use { it.readText() }).also { shared = it }
        }
    }
}
