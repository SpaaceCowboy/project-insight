package com.insightpuzzle.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

class OnlineErrorsTest {
    @Test fun incorrectCredentialsAndConflictsKeepTheirActionableMessage() {
        for ((status, code, message) in listOf(
            Triple(401, "LOGIN_FAILED", "Email or password is incorrect."),
            Triple(409, "NAME_TAKEN", "That username is already taken. Choose another."),
            Triple(409, "EMAIL_TAKEN", "An account with this email already exists. Please log in.")
        )) assertEquals(message, playerErrorMessage(OnlineException(status, code, message)))
    }
    @Test fun transportFailuresHavePlayerFacingInstructions() {
        assertTrue(playerErrorMessage(UnknownHostException()).contains("check your connection"))
        assertTrue(playerErrorMessage(SocketTimeoutException()).contains("timed out"))
        assertTrue(playerErrorMessage(SSLException("private details")).contains("date and time"))
        assertTrue(playerErrorMessage(IOException()).contains("saved work is safe"))
        assertTrue(playerErrorMessage(OnlineException(503, "INTERNAL", "private details")).contains("temporarily unavailable"))
        assertTrue(playerErrorMessage(OnlineException(429, "RATE_LIMITED", "slow down")).contains("wait"))
    }
}
