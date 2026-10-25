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
    @Test fun previewDiscoveryFiltersAndFailuresSurviveRecreation() {
        val context = isolatedContext(); var demo = DemoBackend(context)
        fun request(method: String, path: String, body: JSONObject = JSONObject()) = demo.request(method,path,body,"demo")
        val creators = request("GET","/v1/creators?sort=level").getJSONArray("items")
        assertEquals(2,creators.length())
        assertEquals("Warm Fern",creators.getJSONObject(0).getString("username"))
        assertEquals(1,request("GET","/v1/creators?query=Silver&sort=designed").getJSONArray("items").length())
        val grids = request("GET","/v1/grids?query=Silver&sort=number").getJSONArray("items")
        assertEquals(3,grids.length())
        val grid = grids.getJSONObject(0)
        val board = grid.board("start"); val target = grid.board("target"); val width = board[0].length
        val move = board.indices.flatMap { r -> board[r].indices.map { c -> Pos(r,c) } }.flatMap { a -> Rules.legalMoves(board,a).map { a to it } }.first { (a,b) -> Rules.swap(board,a,b) != target }
        val path = JSONArray().put(JSONArray(listOf(move.first.r*width+move.first.c,move.second.r*width+move.second.c)))
        val session = request("POST","/v1/grids/${grid.getString("id")}/sessions",OnlineRepository.operation()).getString("sessionId")
        val proof = OnlineRepository.operation().put("attemptId",UUID.randomUUID().toString()).put("reason","restart").put("path",path)
        request("POST","/v1/play-sessions/$session/failures",proof)
        proof.put("operationId",UUID.randomUUID().toString())
        request("POST","/v1/play-sessions/$session/failures",proof)
        demo = DemoBackend(context)
        val restored = request("GET","/v1/grids?query=Silver&sort=number").getJSONArray("items").getJSONObject(0)
        assertEquals(1,restored.getInt("failedAttemptCount")); assertEquals(0,restored.getInt("beatenCount"))
    }
    @Test fun restartProofIsDurableAndAccountScoped() {
        val context = isolatedContext(); var store = Store(context)
        store.selectAccount("attempt-player")
        val original = PlayAttempt.open(null,"session",0)
        val operation = UUID.randomUUID().toString()
        val proof = JSONObject().put("operationId",operation).put("_endpoint","/v1/play-sessions/session/failures")
            .put("attemptId",original.id).put("_notBefore",System.currentTimeMillis()+6000).put("reason","restart")
        store.savePlayAttempt("grid","0,1",original.copy(closed=true),proof)
        store = Store(context)
        assertTrue(store.playAttempt("grid")!!.getBoolean("closed"))
        assertEquals(operation,store.proofs().single().getString("operationId"))
        assertTrue(store.proofs().single().getLong("_notBefore")>System.currentTimeMillis())
        assertEquals("0,1",store.communityAttempt("grid"))
        store.selectAccount("other-player")
        assertNull(store.playAttempt("grid")); assertTrue(store.proofs().isEmpty())
    }
    private fun isolatedContext(): Context {
        val prefix = UUID.randomUUID().toString()
        return object : ContextWrapper(InstrumentationRegistry.getInstrumentation().targetContext) {
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences = super.getSharedPreferences("test_${prefix}_$name", mode)
        }
    }

    @Test fun casualPreviewSeedsResetsAndIgnoresLateCycleReports() {
        val context = isolatedContext()
        var demo = DemoBackend(context)
        fun request(path: String, body: JSONObject = OnlineRepository.operation()) = demo.request("POST", path, body, "demo")
        val player = demo.request("GET", "/v1/account", JSONObject(), "demo").getJSONObject("user").getString("id")
        val prefs = context.getSharedPreferences("online_demo_data", Context.MODE_PRIVATE)
        val root = JSONObject(prefs.getString("data", null)!!)
        val grids = root.getJSONArray("grids").objects().take(2)
        grids.forEach { it.put("start", JSONArray(listOf("RBY", "GPW"))).put("target", JSONArray(listOf("GBY", "RPW"))) }
        root.put("grids", JSONArray(grids)).put("gridCompletions", JSONArray().put(JSONObject().put("userId", player).put("gridId", grids[0].getString("id"))))
        assertTrue(prefs.edit().putString("data", root.toString()).commit())
        val operation = OnlineRepository.operation()
        val first = request("/v1/casual/sessions", operation)
        assertEquals(grids[1].getString("id"), first.getJSONObject("grid").getString("id"))
        assertEquals(first.toString(), request("/v1/casual/sessions", operation).toString())
        val late = request("/v1/casual/sessions")
        fun solve(session: JSONObject) = request("/v1/completions", OnlineRepository.operation().put("kind", "community")
            .put("sessionId", session.getString("sessionId")).put("attemptId", UUID.randomUUID().toString()).put("path", JSONArray().put(JSONArray(listOf(0, 3)))))
        solve(first)
        demo = DemoBackend(context)
        val reset = request("/v1/casual/sessions")
        assertFalse(reset.isNull("grid"))
        assertEquals(2, JSONObject(prefs.getString("data", null)!!).getInt("casualCycle"))
        solve(late)
        assertEquals(0, JSONObject(prefs.getString("data", null)!!).getJSONArray("casualDone").length())
        solve(reset)
        val next = request("/v1/casual/sessions")
        assertNotEquals(reset.getJSONObject("grid").getString("id"), next.getJSONObject("grid").getString("id"))
        val saved = JSONObject(prefs.getString("data", null)!!)
        saved.getJSONArray("grids").objects().forEach { it.put("hidden", true) }
        assertTrue(prefs.edit().putString("data", saved.toString()).commit())
        assertTrue(request("/v1/casual/sessions").isNull("grid"))
    }

    @Test fun savesProofsAndResetsAreAccountScoped() {
        val context = isolatedContext(); val store = Store(context)
        store.done = setOf(1); store.earned = mapOf("first" to 1L); store.sound = false
        store.saveProof(JSONObject().put("operationId", "guest-proof"))
        store.selectAccount("account-a")
        assertTrue(store.done.isEmpty()); assertTrue(store.earned.isEmpty()); assertTrue(store.proofs().isEmpty())
        store.done = setOf(2); store.earned = mapOf("steady" to 2L); store.saveAttempt(1, "0,3")
        store.communityDone = setOf("grid-a")
        store.saveCommunityAttempt("grid", "0,2"); store.saveProof(JSONObject().put("operationId", "a-proof"))
        store.selectAccount("account-b")
        assertTrue(store.communityDone.isEmpty())
        assertTrue(store.done.isEmpty()); assertNull(store.attempt(1)); assertNull(store.communityAttempt("grid")); assertTrue(store.proofs().isEmpty())
        store.done = setOf(3)
        store.selectAccount("account-a"); assertEquals(setOf(2), store.done); assertEquals("0,3", store.attempt(1))
        assertEquals(setOf("grid-a"), Store(context).communityDone)
        store.resetProgress()
        assertTrue(store.done.isEmpty()); assertEquals(mapOf("steady" to 2L), store.earned)
        assertEquals(setOf("grid-a"), store.communityDone)
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
        assertFalse(creator.solved); assertEquals(listOf(0 to 2), creator.proof)
        creator.move(Pos(0, 0), Pos(1, 0)); assertTrue(creator.solved)
        assertEquals(listOf(0 to 2), creator.proof)
        val restored = CreatorState(snapshot)
        assertTrue(restored.solved); assertEquals(creator.start, restored.start); assertEquals(creator.proof, restored.proof)
        restored.pressTarget(); assertEquals(listOf(0 to 2), restored.proof); assertFalse(restored.solved)
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
        val grids = request("GET", "/v1/grids?query=Silver&sort=number").getJSONArray("items")
        assertEquals(3, grids.length())
        val sampleGrid = grids.getJSONObject(0)
        assertFalse(sampleGrid.getBoolean("completed"))
        val play = request("POST", "/v1/grids/${sampleGrid.getString("id")}/sessions", op())
        // The first preview grid reuses campaign level 1, whose only solution is one horizontal swap.
        val spec = sampleGrid.board("start"); val target = sampleGrid.board("target")
        val move = spec.indices.flatMap { r -> spec[r].indices.map { c -> Pos(r,c) } }.flatMap { p -> Rules.legalMoves(spec,p).map { p to it } }.first { (a,b) -> Rules.swap(spec,a,b) == target }
        val width = spec[0].length; val proof = JSONArray().put(JSONArray(listOf(move.first.r*width+move.first.c,move.second.r*width+move.second.c)))
        val body = op().put("kind", "community").put("sessionId", play.getString("sessionId")).put("path", proof)
        val first = request("POST", "/v1/completions", body)
        assertEquals("100000", first.getString("awardedMilli")); assertEquals(first.toString(), request("POST", "/v1/completions", body).toString())
        assertTrue(request("GET", "/v1/grids/code/${sampleGrid.getString("code")}").getJSONObject("grid").getBoolean("completed"))
        assertEquals(sampleGrid.getString("id"), request("GET", "/v1/progress").getJSONArray("communityDone").getString(0))
        assertEquals(0, request("GET", "/v1/progress").getJSONArray("done").length())
        val username = request("GET", "/v1/account").getJSONObject("user").getString("username")
        val publishing = op().put("start", JSONArray(listOf("RBY","GPW"))).put("target", JSONArray(listOf("GBY","RPW"))).put("path", JSONArray().put(JSONArray(listOf(0,3))))
        val created = request("POST", "/v1/grids", publishing)
        assertEquals(created.toString(), request("POST", "/v1/grids", publishing).toString())
        demo = DemoBackend(context)
        assertEquals(username, request("GET", "/v1/account").getJSONObject("user").getString("username"))
        assertTrue(request("GET", "/v1/grids/code/${sampleGrid.getString("code")}").getJSONObject("grid").getBoolean("completed"))
        val profile = request("GET", "/v1/profiles/$account")
        assertEquals(1, profile.getInt("gridCount")); assertEquals(1, profile.getInt("communityCount"))
        assertEquals(created.getString("id"), request("GET", "/v1/grids/code/${created.getString("code")}").getJSONObject("grid").getString("id"))
        request("PATCH", "/v1/grids/${created.getString("id")}", op().put("hidden", true))
        assertEquals(0, request("GET", "/v1/profiles/$account").getInt("gridCount"))
        val owned = request("GET", "/v1/grids?owner=$account&sort=number").getJSONArray("items")
        assertEquals(1, owned.length()); assertTrue(owned.getJSONObject(0).getBoolean("hidden"))
        for (n in 2..21) {
            val next = JSONObject(publishing.toString()).put("operationId", UUID.randomUUID().toString())
            assertEquals(n, request("POST", "/v1/grids", next).getInt("levelNumber"))
        }
        assertEquals(21, request("GET", "/v1/grids?owner=$account&sort=number&page=1").getJSONArray("items").getJSONObject(0).getInt("levelNumber"))
    }
}
