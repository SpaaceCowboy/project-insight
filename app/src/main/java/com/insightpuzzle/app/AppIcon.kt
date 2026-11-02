package com.insightpuzzle.app

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * The launcher icon: the app's own, or the same icon with its background and mark colours swapped. Each is a launcher entry (an activity alias in the manifest)
 * and exactly one is switched on; MainActivity itself is never disabled, so tests and deep links still start it by name.
 */
object AppIcon {
    // The aliases are declared relative to the namespace, not the application id, so the preview build's are still com.insightpuzzle.app.Launcher*.
    private fun alias(context: Context, name: String) = ComponentName(context, "${AppIcon::class.java.packageName}.$name")

    fun isAlternative(context: Context) =
        context.packageManager.getComponentEnabledSetting(alias(context, "LauncherAlt")) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED

    /** Switches the launcher icon. The new entry is enabled before the old one is disabled, so the app is never without one; the process is not restarted. */
    fun set(context: Context, alternative: Boolean) {
        val pm = context.packageManager
        fun enable(name: String, on: Boolean) = pm.setComponentEnabledSetting(
            alias(context, name), if (on) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        if (alternative) { enable("LauncherAlt", true); enable("LauncherDefault", false) }
        else { enable("LauncherDefault", true); enable("LauncherAlt", false) }
    }
}
