package com.insightpuzzle.app

import java.text.Normalizer

object Nicknames {
    const val REQUIREMENT = "Choose a nickname of 1–32 visible characters."
    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC).replace(Regex("[\\s\\p{Z}\\uFEFF]+"), " ").trim()
    fun valid(value: String): Boolean {
        val name = normalize(value)
        val withoutJoiners = name.replace("\u200c", "").replace("\u200d", "")
        return name.codePointCount(0, name.length) <= 32 && Regex("[\\p{L}\\p{N}\\p{P}\\p{S}]").containsMatchIn(name) && !Regex("\\p{C}").containsMatchIn(withoutJoiners)
    }
}
