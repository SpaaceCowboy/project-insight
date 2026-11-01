package com.insightpuzzle.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
    @Test fun usernameRefusalsAreRoutedToTheUsernameLine() {
        for (code in listOf("NAME_TAKEN", "NAME_PROFANITY", "NAME_LENGTH", "NAME_CHARACTERS", "NAME_RESERVED")) assertTrue(isNameError(OnlineException(400, code, "x")))
        assertFalse(isNameError(OnlineException(409, "EMAIL_TAKEN", "x")))
        assertFalse(isNameError(OnlineException(401, "LOGIN_FAILED", "x")))
        assertFalse(isNameError(IOException()))
    }
    @Test fun signUpNeedsEveryBoxAndLoginOnlyTwo() {
        assertFalse(authFilled(true, "", "", "", "Quiet Cove"))
        assertFalse(authFilled(true, "a@b.co", "long-password-1", "long-password-1", ""))
        assertFalse(authFilled(true, "a@b.co", "long-password-1", "long-password-1", "   "))
        assertFalse(authFilled(true, "a@b.co", "long-password-1", "", "Quiet Cove"))
        assertFalse(authFilled(true, "a@b.co", "", "long-password-1", "Quiet Cove"))
        assertFalse(authFilled(true, "  ", "long-password-1", "long-password-1", "Quiet Cove"))
        assertTrue(authFilled(true, "a@b.co", "long-password-1", "long-password-1", "Quiet Cove"))
        assertFalse(authFilled(false, "a@b.co", "", "", ""))
        assertTrue(authFilled(false, "a@b.co", "pw", "", ""))
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
