package com.insightpuzzle.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class NicknamesTest {
    private val filter = UsernameFilter.fromJson(File("src/main/assets/username-words.json").readText())
    private val cases = JSONObject(javaClass.classLoader!!.getResource("username-cases.json")!!.readText())

    @Test fun spacingAndCompatibilityCharactersAreNormalisedLikeTheServer() {
        assertEquals("My Name", Nicknames.normalize("  Ｍｙ\u3000Name "))
        assertEquals("a".repeat(20), Nicknames.clip("a".repeat(30)))
    }

    @Test fun ordinaryNamesPassEvenWhenTheyContainAShortBadWord() {
        val allowed = cases.getJSONArray("allowed")
        for (i in 0 until allowed.length()) assertNull(allowed.getString(i), filter.problem(allowed.getString(i)))
    }

    @Test fun problemNamesAreRefusedWithTheServersReasonCode() {
        val blocked = cases.getJSONArray("blocked")
        for (i in 0 until blocked.length()) {
            val case = blocked.getJSONObject(i)
            assertEquals(case.getString("name"), case.getString("problem"), filter.problem(case.getString("name"))?.code)
        }
    }

    @Test fun everyReasonHasAnExplanation() {
        for (problem in NameProblem.entries) assertTrue(Nicknames.message(problem).length > 10)
        assertEquals(NameProblem.HATE, NameProblem.fromCode("NAME_HATE"))
        assertNull(NameProblem.fromCode("NAME_TAKEN"))
    }
}
