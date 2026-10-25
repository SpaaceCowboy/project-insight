package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class AchievementsTest {
    private val levels = Levels.parse(java.io.File("src/main/assets/levels.json").readText())
    private val achievements = Achievements(levels)

    @Test fun catalogIsFirstEveryThirtyAndComplete() {
        assertEquals(200, levels.size)
        val journey = achievements.catalog.filter { it.metric == Metric.CAMPAIGN }
        assertEquals(listOf("first", "levels-30", "levels-60", "levels-90", "levels-120", "levels-150", "levels-180", "complete"), journey.map { it.id })
        assertEquals(listOf(1, 30, 60, 90, 120, 150, 180, 200), journey.map { it.goal })
    }

    @Test fun completeProgressTracksCampaignCompletion() {
        val complete = achievements.catalog.single { it.id == "complete" }
        assertEquals(levels.size - 1, achievements.progress(complete, (1 until levels.size).toSet()))
        assertEquals(complete.goal, achievements.progress(complete, (1..levels.size).toSet()))
    }

    @Test fun retiredLevelsDoNotCount() {
        val first = achievements.catalog.single { it.id == "first" }
        assertEquals(0, achievements.progress(first, setOf(201, 206)))
    }

    @Test fun newlyEarnedSkipsAlreadyEarned() {
        val earned = achievements.newlyEarned((1..30).toSet(), mapOf("first" to 1L)).map { it.id }
        assertEquals(listOf("levels-30"), earned)
    }

    /** Same ids and goals as server/src/badges.ts. */
    @Test fun onlineDesignAndStreakBadgesMatchTheServer() {
        val ids = achievements.catalog.filter { it.metric != Metric.CAMPAIGN }.map { it.id }
        assertEquals(listOf(1, 10, 20, 50, 100, 200, 500, 1000).map { "online-$it" } + listOf(1, 10, 20).map { "designed-$it" } + listOf(7, 14, 30, 50, 70, 100).map { "streak-$it" }, ids)
        val streak = achievements.catalog.single { it.id == "streak-7" }
        assertEquals(5, achievements.progress(streak, emptySet(), OnlineStats(bestStreak = 5)))
        assertEquals(7, achievements.progress(streak, emptySet(), OnlineStats(bestStreak = 9)))
    }

    @Test fun onlineBadgesAreNeverEarnedLocally() {
        assertTrue(achievements.newlyEarned((1..200).toSet(), emptyMap()).all { it.metric == Metric.CAMPAIGN })
    }
}
