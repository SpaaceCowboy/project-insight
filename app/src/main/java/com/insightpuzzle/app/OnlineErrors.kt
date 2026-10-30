package com.insightpuzzle.app

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/** A failure to reach the server at all, as opposed to the server refusing the request. */
fun isConnectionError(error: Throwable) = error is IOException && error !is OnlineException

/** Shared wording for failures from forms, community screens and progress sync. */
fun playerErrorMessage(error: Throwable): String = when (error) {
    is OnlineException -> when {
        error.status == 429 -> tr("Too many attempts. Please wait a few minutes and try again.")
        error.status >= 500 -> tr("Online is temporarily unavailable. Please try again shortly.")
        // The server's own wording is the key, so every message it can send a player is translated here; an unknown one is shown as it came.
        error.code == "DAILY_LIMIT" -> tr("You have reached the daily limit of {0} puzzles. Try again tomorrow.", CREATE_DAILY_LIMIT)
        else -> tr(error.message)
    }
    is SocketTimeoutException -> tr("The connection timed out. Please check your internet connection and try again.")
    is UnknownHostException -> tr("No internet connection or the server could not be reached. Please check your connection and try again.")
    is SSLException -> tr("A secure connection could not be established. Check your device date and time and try again.")
    is IOException -> tr("Could not connect. Check your internet connection and try again. Your saved work is safe.")
    else -> tr("Something went wrong. Please try again.")
}
