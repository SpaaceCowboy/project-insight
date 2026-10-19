package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class AchievementsTest {
    private val levels = Levels.parse(java.io.File("src/main/assets/levels.json").readText())
    private val achievements = Achievements(levels)

    @Test fun onlyPristineUnlocksObsidian() {
        assertEquals(listOf("original", "obsidian"), COSMETICS.map { it.id })
        val obsidian = COSMETICS.last()
        assertFalse(achievements.owns(obsidian, emptyMap()))
        assertFalse(achievements.owns(obsidian, mapOf("first-clean" to 1L, "clean-sweep" to 2L, "complete" to 3L)))
        assertTrue(achievements.owns(obsidian, mapOf("pristine" to 4L)))
        assertEquals(listOf("pristine"), achievements.catalog.filter { achievements.reward(it) != null }.map { it.id })
        val pristine = achievements.catalog.single { it.id == "pristine" }
        assertEquals(levels.size - 1, achievements.progress(pristine, (1 until levels.size).toSet()))
        assertEquals(pristine.goal, achievements.progress(pristine, (1..levels.size).toSet()))
    }

    @Test fun devAccessDoesNotGrantOwnershipAndRetiredFinishesFallBack() {
        val earned = mapOf("first-clean" to 123L)
        assertTrue(achievements.owns(COSMETICS.last(), earned, dev = true))
        assertEquals("obsidian", achievements.equippedFinish("obsidian", earned, dev = true))
        assertEquals("original", achievements.equippedFinish("obsidian", earned, dev = false))
        assertEquals("obsidian", achievements.equippedFinish("obsidian", mapOf("pristine" to 456L), dev = false))
        for (id in listOf("frosted", "metal", "unknown")) {
            assertEquals("original", achievements.equippedFinish(id, earned, dev = false))
            assertEquals("original", achievements.equippedFinish(id, earned, dev = true))
        }
        assertEquals(mapOf("first-clean" to 123L), earned)
    }

    @Test fun badgeCopyHasNoRetiredInstructions() {
        for (badge in achievements.catalog) {
            assertFalse(badge.requirement.contains("distinct", ignoreCase = true))
            assertFalse(badge.requirement.contains("undo", ignoreCase = true))
        }
    }
}
