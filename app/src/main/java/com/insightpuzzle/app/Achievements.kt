package com.insightpuzzle.app

enum class Metric { CAMPAIGN, ONLINE, DESIGNED, STREAK }
data class Badge(val id: String, val name: String, val requirement: String, val goal: Int, val metric: Metric = Metric.CAMPAIGN)
/** Online numbers from the last /v1/progress: distinct community puzzles solved, puzzles published, longest daily streak. */
data class OnlineStats(val onlineSolved: Int = 0, val designedCount: Int = 0, val bestStreak: Int = 0)

/**
 * Journey: the first level, every 30 levels, and the whole campaign. Online: puzzles solved, puzzles designed, daily streak.
 * Must match server/src/campaign.ts and server/src/badges.ts.
 */
class Achievements(private val levels: List<Level>) {
    val catalog: List<Badge> = buildList {
        add(Badge("first", "First Level", "Complete 1 level.", 1))
        for (n in 30 until levels.size step 30) add(Badge("levels-$n", "$n Levels", "Complete $n levels.", n))
        add(Badge("complete", "All ${levels.size} Levels", "Complete all ${levels.size} levels.", levels.size))
        for (n in listOf(1, 10, 20, 50, 100, 200, 500, 1000)) add(Badge("online-$n", if (n == 1) "First Online Puzzle" else "$n Online Puzzles", if (n == 1) "Solve 1 online puzzle." else "Solve $n online puzzles.", n, Metric.ONLINE))
        for (n in listOf(1, 10, 20)) add(Badge("designed-$n", if (n == 1) "First Puzzle Designed" else "$n Puzzles Designed", if (n == 1) "Publish 1 online puzzle." else "Publish $n online puzzles.", n, Metric.DESIGNED))
        for (n in listOf(7, 14, 30, 50, 70, 100)) add(Badge("streak-$n", "$n-Day Streak", "Solve a puzzle $n days in a row.", n, Metric.STREAK))
    }

    /** Progress toward a badge. Journey counts solved level numbers (1-based); numbers of retired levels don't count. */
    fun progress(badge: Badge, done: Set<Int>, stats: OnlineStats = OnlineStats()): Int = minOf(badge.goal, when (badge.metric) {
        Metric.CAMPAIGN -> done.count { it in 1..levels.size }
        Metric.ONLINE -> stats.onlineSolved
        Metric.DESIGNED -> stats.designedCount
        Metric.STREAK -> stats.bestStreak
    })

    /** Journey badges newly reached with these solves, not yet in [earned]. Online badges arrive from the server. */
    fun newlyEarned(done: Set<Int>, earned: Map<String, Long>) = catalog.filter { it.metric == Metric.CAMPAIGN && it.id !in earned && progress(it, done) >= it.goal }

    /** How many current badges are in [earned]; ids of retired badges are ignored. */
    fun earnedCount(earned: Map<String, Long>) = catalog.count { it.id in earned }
}
