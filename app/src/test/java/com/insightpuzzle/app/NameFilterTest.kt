package com.insightpuzzle.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class NameFilterTest {
    private val filter = NameFilter.fromJson(File("src/main/assets/blocked-words.json").readText())
    private val cases = JSONObject(javaClass.classLoader!!.getResource("name-filter-cases.json")!!.readText())
    private fun list(key: String) = cases.getJSONArray(key).let { a -> List(a.length()) { a.getString(it) } }

    @Test fun ordinaryNamesPassAndBlockedWordsFailExactlyAsOnTheServer() {
        for (name in list("allowed")) assertNull(name, filter.problem(name))
        for (name in list("blocked")) assertEquals(name, NameFilter.NOT_ALLOWED, filter.problem(name))
    }

    @Test fun nameShapeFollowsTheServerRules() {
        assertEquals("My World", filter.normalize("  \uFF2D\uFF59   World "))
        for (name in listOf("", "   ", "x".repeat(33), "Quiet\u200b Cove", "Bad\u202eName")) assertEquals(name, NameFilter.FORMAT, filter.problem(name))
        assertNull(filter.problem("x".repeat(32)))
    }

    @Test fun levelNamesMayBeBlankButAreFilteredWhenGiven() {
        assertNull(filter.levelProblem(""))
        assertNull(filter.levelProblem("   "))
        assertNull(filter.levelProblem("First Steps"))
        assertTrue(filter.levelProblem("Kill Zone") != null)
        assertFalse(filter.isBlocked("Wash It"))
    }
}
