package com.insightpuzzle.app

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/** A failure to reach the server at all, as opposed to the server refusing the request. */
fun isConnectionError(error: Throwable) = error is IOException && error !is OnlineException

/** The server refused a username (a rule it breaks, or taken): shown once, under the username box, not in the form's message line. */
fun isNameError(error: Throwable) = error is OnlineException && error.code.startsWith("NAME_")

/** Sign-up needs every box filled in; the button stays muted until then. Login needs only email and password. */
internal fun authFilled(register: Boolean, email: String, password: String, repeat: String, name: String) =
    email.isNotBlank() && password.isNotEmpty() && (!register || (repeat.isNotEmpty() && name.isNotBlank()))

/** Shared wording for failures from forms, community screens and progress sync. */
fun playerErrorMessage(error: Throwable): String = when (error) {
    is OnlineException -> when {
        error.status == 429 -> if (error.retryAfterMillis > 0) {
            val seconds = (error.retryAfterMillis + 999) / 1000
            if (seconds >= 60) tr("Too many attempts. Please wait {0} minutes before trying again.", (seconds + 59) / 60)
            else tr("Too many attempts. Please wait {0} seconds before trying again.", seconds)
        } else tr("Too many attempts. Please wait a few minutes and try again.")
        error.status >= 500 -> tr("Online is temporarily unavailable. Please try again shortly.")
        // The server's own wording is the key, so every message it can send a player is translated here; an unknown one is shown as it came.
        else -> tr(error.message)
    }
    is SocketTimeoutException -> tr("The connection timed out. Please check your internet connection and try again.")
    is UnknownHostException -> tr("No internet connection or the server could not be reached. Please check your connection and try again.")
    is SSLException -> tr("A secure connection could not be established. Check your device date and time and try again.")
    is IOException -> tr("Could not connect. Check your internet connection and try again. Your saved work is safe.")
    else -> tr("Something went wrong. Please try again.")
}
