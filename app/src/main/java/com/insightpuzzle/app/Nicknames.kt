package com.insightpuzzle.app

import java.text.Normalizer

/** Username shape. What a name may say is in [UsernameFilter]; both mirror the server (server/src/username.ts). */
object Nicknames {
    const val MIN_LENGTH = 3
    const val MAX_LENGTH = 20
    /** The first [MAX_LENGTH] characters as the server counts them. */
    fun clip(value: String): String =
        if (value.codePointCount(0, value.length) <= MAX_LENGTH) value else value.substring(0, value.offsetByCodePoints(0, MAX_LENGTH))
    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC).replace(Regex("[\\s\\p{Z}\\uFEFF]+"), " ").trim()
    /** The reason for [problem] in the chosen language (the English wording is the server's, so a server refusal reads the same). */
    fun message(problem: NameProblem) = tr(when (problem) {
        NameProblem.CHARACTERS -> "Use only English letters, numbers, spaces, _ and -."
        NameProblem.LENGTH -> "Choose a username of 3–20 characters."
        NameProblem.HATE -> "Usernames can't contain hateful or discriminatory language."
        NameProblem.VIOLENCE -> "Usernames can't contain violent or threatening language."
        NameProblem.PROFANITY -> "Usernames can't contain profanity or sexual language."
        NameProblem.RESERVED -> "That username is reserved. Please choose another."
    })
}
