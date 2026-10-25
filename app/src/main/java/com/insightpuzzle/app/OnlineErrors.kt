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
        error.status == 429 -> "Too many attempts. Please wait a few minutes and try again."
        error.status >= 500 -> "Online is temporarily unavailable. Please try again shortly."
        else -> error.message
    }
    is SocketTimeoutException -> "The connection timed out. Please check your internet connection and try again."
    is UnknownHostException -> "No internet connection or the server could not be reached. Please check your connection and try again."
    is SSLException -> "A secure connection could not be established. Check your device date and time and try again."
    is IOException -> "Could not connect. Check your internet connection and try again. Your saved work is safe."
    else -> "Online could not finish this action. Please try again."
}
