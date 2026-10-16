plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    val onlineDemo = providers.gradleProperty("insightOnlineDemo").getOrElse("false").toBooleanStrict()
    namespace = "com.insightpuzzle.app"
    compileSdk = 37
    defaultConfig {
        // The application id is permanent once published on Play; change it before the first upload if needed.
        applicationId = "com.insightpuzzle.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.1.2"
        buildConfigField("boolean", "ONLINE_DEMO", onlineDemo.toString())
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        if (onlineDemo) {
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-preview"
            resValue("string", "app_name", "INSIGHT Preview")
        }
    }
    buildTypes {
        release {
            val onlineUrl = providers.gradleProperty("insightApiUrl").orElse(providers.environmentVariable("INSIGHT_API_URL")).getOrElse("")
            require(onlineUrl.isEmpty() || onlineUrl.startsWith("https://")) { "Release Online URL must use HTTPS" }
            buildConfigField("String", "ONLINE_BASE_URL", "\"${onlineUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
        debug {
            val onlineUrl = providers.gradleProperty("insightApiUrl").orElse(providers.environmentVariable("INSIGHT_API_URL")).getOrElse("http://10.0.2.2:3000")
            buildConfigField("String", "ONLINE_BASE_URL", "\"${onlineUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    val bom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(bom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    // Bounded networking and a durable account-scoped sync outbox; Java Room entities avoid another compiler plugin.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.room:room-runtime:2.8.4")
    annotationProcessor("androidx.room:room-compiler:2.8.4")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
}
