package com.insightpuzzle.app

import android.content.Context
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

/** Why a username cannot be used. [code] is the server's error code for the same rule. */
enum class NameProblem(val code: String) {
    CHARACTERS("NAME_CHARACTERS"), LENGTH("NAME_LENGTH"), HATE("NAME_HATE"), VIOLENCE("NAME_VIOLENCE"), PROFANITY("NAME_PROFANITY"), RESERVED("NAME_RESERVED");
    companion object { fun fromCode(code: String) = entries.firstOrNull { it.code == code } }
}

/**
 * Usernames: English letters, numbers, spaces, _ and -, 3–20 characters, and nothing hateful, violent, profane or reserved. The word lists and the algorithm mirror
 * server/src/username.ts (the server is the authority; this gives the player the reason before sending). Both read the same cases in
 * app/src/test/resources/username-cases.json.
 */
class UsernameFilter(private val words: JSONObject) {
    private class Words(val exact: List<Regex>, val roots: List<Regex>)
    private fun load(key: String): Words {
        val list = words.getJSONObject(key)
        fun strings(name: String) = list.getJSONArray(name).let { a -> List(a.length()) { a.getString(it) } }
        return Words(strings("exact").map { Regex("^${stretched(it)}$") }, strings("contains").map { Regex(stretched(it)) })
    }
    // Checked in this order, so a name that is both hateful and rude gets the stronger explanation.
    private val checks = listOf(NameProblem.HATE to load("hate"), NameProblem.VIOLENCE to load("violence"), NameProblem.PROFANITY to load("profanity"))
    private val reserved = load("reserved")

    /** Normalises a typed username and says why it cannot be used, or null when it is fine. */
    fun problem(value: String): NameProblem? {
        val name = Nicknames.normalize(value)
        if (!Regex("^[A-Za-z0-9 _-]*$").matches(name) || !Regex("[A-Za-z0-9]").containsMatchIn(name)) return NameProblem.CHARACTERS
        if (name.length < Nicknames.MIN_LENGTH || name.length > Nicknames.MAX_LENGTH) return NameProblem.LENGTH
        return banned(name)
    }

    fun banned(name: String): NameProblem? {
        val tokens = name.lowercase(Locale.ROOT).split(Regex("[ _-]+")).filter { it.isNotEmpty() }
        val reads = readings(tokens)
        for ((problem, list) in checks) if (reads.any { matches(list, it) }) return problem
        // Reserved names are judged as a whole ("Insight Fan" is fine, "Insight" and "Admin_1" are not).
        if (reads.any { r -> val all = r.joinToString(""); reserved.exact.any { it.containsMatchIn(all) } || reserved.roots.any { it.containsMatchIn(all) } }) return NameProblem.RESERVED
        return null
    }

    /** The ways one word is read: as typed, with digits as the letters they imitate, with digits dropped, and with look-alike spellings (v for u, ph for f). */
    private fun readings(tokens: List<String>): List<List<String>> {
        fun letters(t: String) = t.filter { it in 'a'..'z' }
        val leet = tokens.map { t -> letters(t.map { DIGIT_LETTERS[it] ?: it }.joinToString("")) }
        return listOf(tokens, leet, tokens.map(::letters), leet.map { it.replace("v", "u").replace("ph", "f") }).map { r -> r.filter { it.isNotEmpty() } }
    }

    /**
     * What a name is tested as: every word on its own, runs of single letters joined ("f u c k"), neighbouring words joined for phrases,
     * and short fragments joined ("fu ck"). Longer words are never glued together, so "Wash It" stays fine.
     */
    private fun matches(list: Words, tokens: List<String>): Boolean {
        val whole = tokens.toMutableList(); val inside = tokens.toMutableList()
        var run = ""
        for (t in tokens + "") {
            if (t.length == 1) { run += t; continue }
            if (run.length > 1) { whole += run; inside += run }
            run = ""
        }
        for (size in 2..4) for (i in 0..tokens.size - size) {
            val window = tokens.subList(i, i + size)
            whole += window.joinToString("")
            if (size <= 3 && window.all { it.length <= 3 }) inside += window.joinToString("")
        }
        return whole.any { c -> list.exact.any { it.matches(c) } } || inside.any { c -> list.roots.any { it.containsMatchIn(c) } }
    }

    companion object {
        private val DIGIT_LETTERS = mapOf('0' to 'o', '1' to 'i', '3' to 'e', '4' to 'a', '5' to 's', '7' to 't', '8' to 'b', '9' to 'g')
        /** A word as a pattern that also accepts stretched spellings: "fuuuck" and "asss" match, but "bob" does not match "boob". */
        internal fun stretched(word: String): String {
            val out = StringBuilder(); var i = 0
            while (i < word.length) { var j = i; while (j < word.length && word[j] == word[i]) j++; out.append(word[i]).append('{').append(j - i).append(",}"); i = j }
            return out.toString()
        }
        fun fromJson(text: String) = UsernameFilter(JSONObject(text))
        @Volatile private var shared: UsernameFilter? = null
        fun get(context: Context): UsernameFilter = shared ?: synchronized(this) {
            shared ?: fromJson(context.applicationContext.assets.open("username-words.json").bufferedReader().use { it.readText() }).also { shared = it }
        }
    }
}
