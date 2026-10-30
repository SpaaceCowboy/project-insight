package com.insightpuzzle.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

/**
 * The app's languages: English, Spanish, French, Italian and German. The English wording in the code is the key; [tr] looks it up in [Translations] and
 * falls back to the English text itself, so text without a translation (a username, a number) is simply shown as it is. [language] is Compose state, so every
 * screen that reads a string through [tr] redraws the moment the language is changed in Options.
 */
object L10n {
    /** Language code to its own name, the way the language buttons in Options show it. */
    val LANGUAGES = listOf("en" to "English", "es" to "Español", "fr" to "Français", "it" to "Italiano", "de" to "Deutsch")
    var language by mutableStateOf("en")
    fun supported(code: String?) = LANGUAGES.any { it.first == code }
    /** The phone's language if the app has it, else English. */
    fun deviceLanguage(): String = Locale.getDefault().language.takeIf { supported(it) } ?: "en"
}

/** [text] in the chosen language ([text] itself in English, or when it has no translation). */
fun tr(text: String): String = if (L10n.language == "en") text else Translations.lookup(L10n.language, text)

/** [tr] with {0}, {1}... in the text replaced by [args] (so a language can put them wherever its sentence needs them). */
fun tr(text: String, vararg args: Any?): String {
    var out = tr(text)
    args.forEachIndexed { i, value -> out = out.replace("{$i}", value.toString()) }
    return out
}
