package com.insightpuzzle.app

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class OnlinePersistenceTest {
    private fun isolatedContext(): Context {
        val prefix = UUID.randomUUID().toString()
        return object : ContextWrapper(InstrumentationRegistry.getInstrumentation().targetContext) {
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences = super.getSharedPreferences("test_${prefix}_$name", mode)
        }
    }

    @Test fun savesProofsAndResetsAreAccountScoped() {
        val store = Store(isolatedContext())
        store.done = setOf(1); store.earned = mapOf("first" to 1L); store.sound = false
        store.saveProof(JSONObject().put("operationId", "guest-proof"))
        store.selectAccount("account-a")
        assertTrue(store.done.isEmpty()); assertTrue(store.earned.isEmpty()); assertTrue(store.proofs().isEmpty())
        store.done = setOf(2); store.earned = mapOf("steady" to 2L); store.saveAttempt(1, "0,3")
        store.saveCommunityAttempt("grid", "0,2"); store.saveProof(JSONObject().put("operationId", "a-proof"))
        store.selectAccount("account-b")
        assertTrue(store.done.isEmpty()); assertNull(store.attempt(1)); assertNull(store.communityAttempt("grid")); assertTrue(store.proofs().isEmpty())
        store.done = setOf(3)
        store.selectAccount("account-a"); assertEquals(setOf(2), store.done); assertEquals("0,3", store.attempt(1))
        store.resetProgress()
        assertTrue(store.done.isEmpty()); assertEquals(mapOf("steady" to 2L), store.earned)
        assertEquals("a-proof", store.proofs().single().getString("operationId"))
        store.selectAccount("account-b"); assertEquals(setOf(3), store.done)
        store.selectAccount(null); assertEquals(setOf(1), store.done); assertFalse(store.sound)
        assertEquals("guest-proof", store.proofs().single().getString("operationId"))
    }

    @Test fun creatorCheckProofSurvivesRecreationAndEditingInvalidatesIt() {
        var snapshot = ""
        val creator = CreatorState(persist = { snapshot = it })
        creator.place('R', Pos(0, 0)); creator.place('B', Pos(0, 1)); creator.place('Y', Pos(1, 0))
        creator.pressStart(); creator.move(Pos(0, 0), Pos(1, 0)); creator.pressTarget()
        assertFalse(creator.solved); assertTrue(creator.proof.isEmpty())
        creator.move(Pos(0, 0), Pos(1, 0)); assertTrue(creator.solved)
        assertEquals(listOf(0 to 3), creator.proof)
        val restored = CreatorState(snapshot)
        assertTrue(restored.solved); assertEquals(creator.start, restored.start); assertEquals(creator.proof, restored.proof)
        restored.pressTarget(); assertTrue(restored.proof.isEmpty()); assertFalse(restored.solved)
        restored.pressStart(); assertNull(restored.target); assertTrue(restored.proof.isEmpty())
    }

    @Test fun roomOutboxAndCacheDoNotCrossAccountsAndSurviveReopening() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "test-${UUID.randomUUID()}.db"
        fun open() = Room.databaseBuilder(context, OnlineDatabase::class.java, name).allowMainThreadQueries().build()
        var db = open()
        try {
            for (account in listOf("a", "b")) db.queries().enqueue(OnlineDatabase.Pending().apply {
                id = "same-id"; this.account = account; endpoint = "/v1/completions"; payload = "{}"; createdAt = 1
            })
            db.queries().save(OnlineDatabase.Record().apply { account = "a"; key = "profile"; value = "{\"name\":\"Quiet Cove\"}" })
            db.close(); db = open()
            assertEquals(1, db.queries().pending("a").size); assertEquals(1, db.queries().pending("b").size)
            assertNull(db.queries().read("b", "profile")); assertNotNull(db.queries().read("a", "profile"))
            db.queries().acknowledge("a", "same-id"); assertTrue(db.queries().pending("a").isEmpty()); assertEquals(1, db.queries().pending("b").size)
            db.queries().fail("b", "same-id", "Needs verification"); assertTrue(db.queries().pending("b").isEmpty())
            assertEquals("Needs verification", db.queries().outcomes("b").single().error)
        } finally { db.close(); context.deleteDatabase(name) }
    }

    @Test fun offlineDemoRunsPublishingPlayRewardsAndRestoresWithoutAnyServer() {
        val context = isolatedContext(); var demo = DemoBackend(context)
        fun request(method: String, path: String, body: JSONObject = JSONObject()) = demo.request(method, path, body, "demo")
        fun op() = OnlineRepository.operation()
        val account = request("POST", "/v1/auth/login", JSONObject().put("password", "Quiet Cove")).getJSONObject("user").getString("id")
        val worlds = request("GET", "/v1/worlds").getJSONArray("items")
        assertEquals(2, worlds.length())
        val sampleWorld = worlds.getJSONObject(0)
        val sampleGrid = request("GET", "/v1/worlds/${sampleWorld.getString("id")}/grids").getJSONArray("items").getJSONObject(0)
        val play = request("POST", "/v1/grids/${sampleGrid.getString("id")}/sessions", op())
        // The first preview grid reuses campaign level 1, whose only solution is one horizontal swap.
        val spec = sampleGrid.board("start"); val target = sampleGrid.board("target")
        val move = spec.indices.flatMap { r -> spec[r].indices.map { c -> Pos(r,c) } }.flatMap { p -> Rules.legalMoves(spec,p).map { p to it } }.first { (a,b) -> Rules.swap(spec,a,b) == target }
        val width = spec[0].length; val proof = JSONArray().put(JSONArray(listOf(move.first.r*width+move.first.c,move.second.r*width+move.second.c)))
        val body = op().put("kind", "community").put("sessionId", play.getString("sessionId")).put("path", proof)
        val first = request("POST", "/v1/completions", body)
        assertEquals("100000", first.getString("awardedMilli")); assertEquals(first.toString(), request("POST", "/v1/completions", body).toString())
        val w = request("POST", "/v1/worlds", op().put("name", "Calm Pool").put("icon", "R"))
        val draft = request("POST", "/v1/grids/drafts", op().put("name", "Soft Cove").put("start", JSONArray(listOf("RBY","GPW"))).put("target", JSONArray(listOf("GBY","RPW"))).put("path", JSONArray().put(JSONArray(listOf(0,3)))))
        request("POST", "/v1/grids/${draft.getString("id")}/publish", op().put("worldId", w.getString("id")))
        demo = DemoBackend(context)
        val profile = request("GET", "/v1/profiles/$account")
        assertEquals(1, profile.getInt("worldCount")); assertEquals(1, profile.getInt("gridCount")); assertEquals(1, profile.getInt("communityCount"))
        assertEquals(draft.getString("id"), request("GET", "/v1/grids/code/${draft.getString("code")}").getJSONObject("grid").getString("id"))
    }
}
