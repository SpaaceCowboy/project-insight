package com.insightpuzzle.app

import org.junit.Assert.assertEquals
import org.junit.Test

class AfterSignInTest {
    @Test fun purchaseStaysPurchaseUntilTheAccountOwnsWorlds() {
        assertEquals(Route.Purchase, afterSignIn(Route.Purchase, owns = false))
        assertEquals(Route.Online, afterSignIn(Route.Purchase, owns = true))
    }
    @Test fun worldsIsOnlyForOwnersAndEveryoneElseGetsThePreview() {
        assertEquals(Route.Online, afterSignIn(Route.Online, owns = true))
        assertEquals(Route.WorldsPreview, afterSignIn(Route.Online, owns = false))
    }
    @Test fun otherDestinationsAreUntouched() {
        assertEquals(Route.Profile(), afterSignIn(Route.Profile(), owns = false))
        assertEquals(Route.Create, afterSignIn(Route.Create, owns = true))
    }
}
