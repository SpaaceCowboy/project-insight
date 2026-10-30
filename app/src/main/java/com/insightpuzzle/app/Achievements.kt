package com.insightpuzzle.app

enum class Metric { CAMPAIGN, ONLINE, DESIGNED, STREAK, LEVEL }
/** [name] and [requirement] are the English wording; [nameTemplate] and [requirementTemplate] are the same with {0} for [goal], which [tr] puts in the chosen language. */
data class Badge(val id: String, val name: String, val requirement: String, val goal: Int, val metric: Metric = Metric.CAMPAIGN, val nameTemplate: String = name, val requirementTemplate: String = requirement)
/** Online numbers from the last /v1/progress: distinct community puzzles solved, puzzles designed, longest daily streak, player level. */
data class OnlineStats(val onlineSolved: Int = 0, val designedCount: Int = 0, val bestStreak: Int = 0, val level: Int = 1)

/**
 * Journey: the first puzzle, every 30 puzzles, and the whole campaign. Online: puzzles solved, puzzles designed, daily streak, player level.
 * Must match server/src/campaign.ts and server/src/badges.ts.
 */
class Achievements(private val levels: List<Level>) {
    private fun badge(id: String, name: String, requirement: String, n: Int, metric: Metric = Metric.CAMPAIGN) =
        Badge(id, name.replace("{0}", "$n"), requirement.replace("{0}", "$n"), n, metric, name, requirement)
    val catalog: List<Badge> = buildList {
        add(badge("first", "First Journey Puzzle", "Solve 1 Journey puzzle.", 1))
        for (n in 30 until levels.size step 30) add(badge("levels-$n", "{0} Journey Puzzles", "Solve {0} Journey puzzles.", n))
        add(badge("complete", "All {0} Journey Puzzles", "Solve all {0} Journey puzzles.", levels.size))
        for (n in listOf(1, 10, 20, 50, 100, 200, 500, 1000)) add(if (n == 1) badge("online-1", "First Online Puzzle", "Solve 1 online puzzle.", 1, Metric.ONLINE) else badge("online-$n", "{0} Online Puzzles", "Solve {0} online puzzles.", n, Metric.ONLINE))
        for (n in listOf(1, 10, 20, 50, 100)) add(if (n == 1) badge("designed-1", "First Puzzle Designed", "Design 1 puzzle.", 1, Metric.DESIGNED) else badge("designed-$n", "{0} Puzzles Designed", "Design {0} puzzles.", n, Metric.DESIGNED))
        for (n in listOf(7, 14, 30, 50, 70, 100)) add(badge("streak-$n", "{0}-Day Streak", "Solve a puzzle {0} days in a row.", n, Metric.STREAK))
        for (n in listOf(10, 20, 30, 50, 70, 100)) add(badge("level-$n", "Level {0}", "Reach level {0}.", n, Metric.LEVEL))
    }

    /** Progress toward a badge. Journey counts solved level numbers (1-based); numbers of retired levels don't count. */
    fun progress(badge: Badge, done: Set<Int>, stats: OnlineStats = OnlineStats()): Int = minOf(badge.goal, when (badge.metric) {
        Metric.CAMPAIGN -> done.count { it in 1..levels.size }
        Metric.ONLINE -> stats.onlineSolved
        Metric.DESIGNED -> stats.designedCount
        Metric.STREAK -> stats.bestStreak
        Metric.LEVEL -> stats.level
    })

    /** Journey badges newly reached with these solves, not yet in [earned]. Online badges arrive from the server. */
    fun newlyEarned(done: Set<Int>, earned: Map<String, Long>) = catalog.filter { it.metric == Metric.CAMPAIGN && it.id !in earned && progress(it, done) >= it.goal }

    /** How many current badges are in [earned]; ids of retired badges are ignored. */
    fun earnedCount(earned: Map<String, Long>) = catalog.count { it.id in earned }
}
