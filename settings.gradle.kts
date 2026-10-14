// Google's Android servers are unreachable from the dev network, so Google Maven comes from the Aliyun mirror.
// Swap the mirror for google() if you build somewhere that can reach dl.google.com.
pluginManagement {
    repositories {
        maven("https://maven.aliyun.com/repository/google")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven("https://maven.aliyun.com/repository/google")
        mavenCentral()
    }
}
rootProject.name = "insight-android"
include(":app")
