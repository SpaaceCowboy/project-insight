package com.insightpuzzle.app

// Legacy clean badges keep their IDs and completion requirements for saved progress.
data class Badge(val id: String, val name: String, val requirement: String, val goal: Int, val mark: String, val world: Int = 0, val metric: Metric)
enum class Metric { COMPLETED, WORLD, CLEAN, CLEAN_WORLD }
data class Cosmetic(val id: String, val kind: String, val name: String, val description: String, val badge: String? = null)

val COSMETICS = listOf(
    Cosmetic("original", "finish", "Original", "The familiar warm tile surface."),
    Cosmetic("obsidian", "finish", "Obsidian", "Dark satin tiles with vivid coloured symbols.", "pristine"),
)

class Achievements(private val levels: List<Level>) {
    private val worlds = levels.map { it.world }.distinct()
    val catalog: List<Badge> = buildList {
        add(Badge("first", "First Step", "Complete 1 campaign level.", 1, "Ⅰ", metric = Metric.COMPLETED))
        add(Badge("flow", "Finding Flow", "Complete 10 campaign levels.", 10, "≈", metric = Metric.COMPLETED))
        add(Badge("halfway", "Halfway Home", "Complete 50 campaign levels.", 50, "◐", metric = Metric.COMPLETED))
        add(Badge("complete", "INSIGHT Complete", "Complete all ${levels.size} campaign levels.", levels.size, "✦", metric = Metric.COMPLETED))
        worlds.forEach { w -> add(Badge("world-$w", "World $w Master", "Complete every level in World $w.", levels.count { it.world == w }, "$w", w, Metric.WORLD)) }
        add(Badge("first-clean", "First Clean Solve", "Complete 1 campaign level.", 1, "★", metric = Metric.CLEAN))
        add(Badge("steady", "Steady Hand", "Complete 10 levels.", 10, "⌁", metric = Metric.CLEAN))
        add(Badge("unbroken", "Unbroken", "Complete 25 levels.", 25, "✧", metric = Metric.CLEAN))
        add(Badge("flawless", "Flawless", "Complete 50 levels.", 50, "◇", metric = Metric.CLEAN))
        add(Badge("clean-sweep", "Clean Sweep", "Complete every level in one world.", 1, "⋈", metric = Metric.CLEAN_WORLD))
        add(Badge("pristine", "Pristine", "Complete all ${levels.size} campaign levels.", levels.size, "⊞", metric = Metric.CLEAN))
    }

    /** Progress toward a badge given the solved level numbers (1-based). */
    fun progress(badge: Badge, done: Set<Int>): Int = minOf(badge.goal, when (badge.metric) {
        Metric.COMPLETED, Metric.CLEAN -> done.size
        Metric.WORLD -> done.count { levels.getOrNull(it - 1)?.world == badge.world }
        Metric.CLEAN_WORLD -> worlds.count { w -> levels.withIndex().all { (i, l) -> l.world != w || (i + 1) in done } }
    })

    /** Badges newly reached with these solves, not yet in [earned]. */
    fun newlyEarned(done: Set<Int>, earned: Map<String, Long>) = catalog.filter { it.id !in earned && progress(it, done) >= it.goal }

    fun reward(badge: Badge) = COSMETICS.find { it.badge == badge.id }?.name
    fun owns(cosmetic: Cosmetic, earned: Map<String, Long>, dev: Boolean = false) = dev || cosmetic.badge == null || cosmetic.badge in earned

    fun equippedFinish(id: String, earned: Map<String, Long>, dev: Boolean) =
        COSMETICS.find { it.id == id && owns(it, earned, dev) }?.id ?: "original"
}
