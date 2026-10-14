package com.insightpuzzle.app

// Port of src/achievements.mjs. The app has no undo, so every solve is a clean (no-undo) solve.
data class Badge(val id: String, val name: String, val requirement: String, val goal: Int, val mark: String, val world: Int = 0, val metric: Metric)
enum class Metric { COMPLETED, WORLD, CLEAN, CLEAN_WORLD }
data class Cosmetic(val id: String, val kind: String, val name: String, val description: String, val badge: String? = null)

val COSMETICS = listOf(
    Cosmetic("forest", "background", "Forest", "Soft greens and moving light."),
    Cosmetic("mist", "background", "Northern Mist", "Cool blue skies and teal light.", "world-1"),
    Cosmetic("aurora", "background", "Aurora", "Blue twilight with violet light.", "complete"),
    Cosmetic("original", "finish", "Original", "The familiar warm tile surface."),
    Cosmetic("frosted", "finish", "Frosted", "A soft, luminous glass surface.", "first-clean"),
    Cosmetic("metal", "finish", "Brushed Metal", "Fine brushing and a gentle satin shine.", "clean-sweep"),
)

class Achievements(private val levels: List<Level>) {
    private val worlds = levels.map { it.world }.distinct()
    val catalog: List<Badge> = buildList {
        add(Badge("first", "First Step", "Complete 1 campaign level.", 1, "Ⅰ", metric = Metric.COMPLETED))
        add(Badge("flow", "Finding Flow", "Complete 10 distinct campaign levels.", 10, "≈", metric = Metric.COMPLETED))
        add(Badge("halfway", "Halfway Home", "Complete 50 distinct campaign levels.", 50, "◐", metric = Metric.COMPLETED))
        add(Badge("complete", "INSIGHT Complete", "Complete all ${levels.size} campaign levels.", levels.size, "✦", metric = Metric.COMPLETED))
        worlds.forEach { w -> add(Badge("world-$w", "World $w Master", "Complete every level in World $w.", levels.count { it.world == w }, "$w", w, Metric.WORLD)) }
        add(Badge("first-clean", "First Clean Solve", "Complete 1 campaign level without undo.", 1, "★", metric = Metric.CLEAN))
        add(Badge("steady", "Steady Hand", "Complete 10 distinct levels without undo.", 10, "⌁", metric = Metric.CLEAN))
        add(Badge("unbroken", "Unbroken", "Complete 25 distinct levels without undo.", 25, "✧", metric = Metric.CLEAN))
        add(Badge("flawless", "Flawless", "Complete 50 distinct levels without undo.", 50, "◇", metric = Metric.CLEAN))
        add(Badge("clean-sweep", "Clean Sweep", "Complete every level in one world without undo.", 1, "⋈", metric = Metric.CLEAN_WORLD))
        add(Badge("pristine", "Pristine", "Complete all ${levels.size} campaign levels without undo.", levels.size, "⊞", metric = Metric.CLEAN))
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
    fun owns(cosmetic: Cosmetic, earned: Map<String, Long>) = cosmetic.badge == null || cosmetic.badge in earned
}
