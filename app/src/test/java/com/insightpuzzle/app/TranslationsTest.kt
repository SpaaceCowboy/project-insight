package com.insightpuzzle.app

import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class TranslationsTest {
    @After fun backToEnglish() { L10n.language = "en" }

    private val sources = File("src/main/java/com/insightpuzzle/app").listFiles { f -> f.extension == "kt" }!!.filter { it.name !in setOf("Translations.kt", "DemoBackend.kt", "OnlineClient.kt") }
    /** Texts the code hands to [tr], or to composables that translate their text. {0}-style keys keep their placeholders. */
    private val patterns = listOf(
        Regex("""\btr\("((?:[^"\\]|\\.)*)""""),
        Regex("""\b(?:Label|MenuButton|ToggleRow|InfoRow|HomeIconButton|SectionTitle|Eyebrow|Page|ProfileButton|Stat|OnlineField|VolumeSlider|WinButton|SmallIconButton|PlaySearch)\(\s*(?:[a-z.]+,\s*)?"((?:[^"\\]|\\.)*)""""),
        Regex("""\bdescription = "((?:[^"\\]|\\.)*)""""),
        Regex("""\bsubtitle = "((?:[^"\\]|\\.)*)""""),
        Regex("""\bempty(?: =|: String =) "((?:[^"\\]|\\.)*)""""),
        Regex(""""[a-z]+" to "((?:[^"\\]|\\.)*)""""),
    )
    /** Texts that are not meant to be translated: the language names, a font name, the debug-only toggle, the wordmark. */
    private val untranslated = setOf("English", "Español", "Français", "Italiano", "Deutsch", "JetBrains Mono", "Developer mode", "MIDORI")

    @Test fun everyTextTheCodeTranslatesHasARowInAllFourLanguages() {
        val missing = sortedSetOf<String>()
        for (file in sources) {
            val text = file.readText()
            for (pattern in patterns) for (match in pattern.findAll(text)) {
                val key = match.groupValues[1]
                if ('$' in key || !Regex("[A-Za-z]{2}").containsMatchIn(key) || key in untranslated) continue
                if (key !in Translations.keys) missing += "${file.name}: $key"
            }
        }
        assertEquals("English texts without a translation row", emptyList<String>(), missing.toList())
    }

    @Test fun translationsKeepTheirPlaceholdersAndAreNeverEmpty() {
        for (key in Translations.keys) for (language in listOf("es", "fr", "it", "de")) {
            val text = Translations.lookup(language, key)
            assertTrue("$language: \"$key\" is empty", text.isNotBlank())
            for (n in 0..3) assertEquals("$language: \"$key\" must keep {$n} as often as the English", key.split("{$n}").size, text.split("{$n}").size)
        }
    }

    @Test fun anUnknownTextAndEnglishAreShownAsTheyAre() {
        L10n.language = "fr"
        assertEquals("Quiet Cove", tr("Quiet Cove"))
        L10n.language = "en"
        assertEquals("Settings are saved", tr("Settings are saved"))
        assertEquals("Level 3", tr("Level {0}", 3))
    }

    @Test fun placeholdersFillIn() {
        L10n.language = "de"
        assertEquals("Level 7", tr("Level {0}", 7))
        L10n.language = "es"
        assertEquals("Volumen de Efectos", tr("{0} volume", tr("Effects")))
        L10n.language = "it"
        assertEquals("Gioca al puzzle 4 di Ada su Midori: ABC", tr("Play puzzle {0} by {1} in Midori: {2}", 4, "Ada", "ABC"))
    }

    @Test fun languagesAreFiveAndNamedInThemselves() {
        assertEquals(listOf("en", "es", "fr", "it", "de"), L10n.LANGUAGES.map { it.first })
        assertEquals(listOf("English", "Español", "Français", "Italiano", "Deutsch"), L10n.LANGUAGES.map { it.second })
        assertTrue(L10n.supported("fr")); assertFalse(L10n.supported("fa")); assertFalse(L10n.supported(null))
    }

    @Test fun colourNamesFollowThePaletteAndTheLanguage() {
        Art.colorblind = false
        assertEquals("Red", Art.name('R'))
        L10n.language = "es"
        assertEquals("Rojo", Art.name('R'))
        Art.colorblind = true
        try {
            assertEquals("Bermellón", Art.name('R'))
            assertEquals("Púrpura rojizo", Art.name('P'))
            L10n.language = "en"
            assertEquals(listOf("Vermillion", "Blue", "Bluish green", "Yellow", "Off-white", "Reddish purple"), "RBGYWP".map { Art.name(it) })
        } finally { Art.colorblind = false }
    }
}
