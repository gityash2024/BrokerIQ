plugins {
    id("com.android.application") version "8.10.1"
    id("org.jetbrains.kotlin.android") version "2.2.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.21"
    id("org.jetbrains.kotlin.kapt") version "2.2.21"
}

android {
    namespace = "com.brokeriq.connect"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.brokeriq.connect"
        minSdk = 30
        targetSdk = 36
        versionCode = 7
        versionName = "1.5.1"
        val api = providers.gradleProperty("brokeriqApi").orElse("https://brokeriqapi.mymultimeds.com/api/").get()
        require(api.startsWith("https://") && api.endsWith("/") && !api.contains('"')) { "Use an HTTPS BrokerIQ API URL ending in /" }
        buildConfigField("String", "BROKERIQ_API", "\"$api\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { jvmToolchain(17) }

dependencies {
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.compose.material:material-icons-core:1.7.8")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("androidx.room:room-runtime:2.7.2")
    implementation("androidx.room:room-ktx:2.7.2")
    kapt("androidx.room:room-compiler:2.7.2")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
