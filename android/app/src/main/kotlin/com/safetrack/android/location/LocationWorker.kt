// SafeTrack Android — FusedLocation Worker (Kotlin/WorkManager)
// Periodic background location updates with adaptive frequency + SMS fallback

package com.safetrack.android.location

import android.content.Context
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import androidx.work.*
import com.google.android.gms.location.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// ─── Ping Mode ──────────────────────────────────────────────────────────────
enum class PingMode(val intervalSeconds: Long, val batteryDescription: String) {
    HIGH(30,  "High battery impact"),
    MEDIUM(300, "Moderate battery impact"),
    LOW(900, "Low battery impact"),
    CUSTOM(-1, "Custom interval"),
    ADAPTIVE(-1, "Adaptive — varies with motion")
}

// ─── Location Update Payload ─────────────────────────────────────────────────
data class LocationUpdate(
    val lat: Double,
    val lng: Double,
    val accuracy: Float?,
    val altitude: Double?,
    val speed: Float?,
    val bearing: Float?,
    val batteryPct: Int?,
    val source: String = "NATIVE_GPS",
    val pingMechanism: String? = null,
    val trackerTagId: String? = null
)

// ─── SafeTrack Location Worker ────────────────────────────────────────────────
class LocationWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)
    private val prefs = context.getSharedPreferences("safetrack_prefs", Context.MODE_PRIVATE)

    companion object {
        const val WORK_NAME = "st_location_periodic"
        const val KEY_PING_MODE = "ping_mode"
        const val KEY_CUSTOM_INTERVAL = "custom_interval_sec"

        fun schedule(context: Context, pingMode: PingMode, customIntervalSec: Long? = null) {
            val intervalSec = when {
                pingMode == PingMode.CUSTOM && customIntervalSec != null -> customIntervalSec
                pingMode == PingMode.ADAPTIVE -> PingMode.MEDIUM.intervalSeconds
                else -> pingMode.intervalSeconds
            }

            val request = PeriodicWorkRequestBuilder<LocationWorker>(
                intervalSec, TimeUnit.SECONDS,
                flexTimeInterval = intervalSec / 2, flexTimeIntervalUnit = TimeUnit.SECONDS
            )
                .setInputData(
                    workDataOf(
                        KEY_PING_MODE to pingMode.name,
                        KEY_CUSTOM_INTERVAL to (customIntervalSec ?: -1L)
                    )
                )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiresBatteryNotLow(false) // Always run for safety
                        .build()
                )
                .addTag("safetrack_location")
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.REPLACE,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val location = getLastKnownLocation()
                ?: return@withContext Result.retry()

            val battery = getBatteryPercent()
            val pingMode = inputData.getString(KEY_PING_MODE) ?: PingMode.MEDIUM.name

            val update = LocationUpdate(
                lat = location.latitude,
                lng = location.longitude,
                accuracy = location.accuracy,
                altitude = location.altitude,
                speed = if (location.hasSpeed()) location.speed else null,
                bearing = if (location.hasBearing()) location.bearing else null,
                batteryPct = battery,
                source = "NATIVE_GPS",
                pingMechanism = pingMode
            )

            val isOnline = isNetworkAvailable()
            if (isOnline) {
                SafeTrackApiClient.postLocation(update)
                flushOfflineQueue()
            } else {
                queueOffline(update)
                sendSmsFallback(update)
            }

            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("LocationWorker", "Error: ${e.message}", e)
            Result.retry()
        }
    }

    // ── Get Location ─────────────────────────────────────────────────────────
    private suspend fun getLastKnownLocation(): android.location.Location? =
        suspendCancellableCoroutine { cont ->
            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
                cont.resume(null)
                return@suspendCancellableCoroutine
            }

            val request = CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setDurationMillis(5000L)
                .setMaxUpdateAgeMillis(10000L)
                .build()

            fusedClient.getCurrentLocation(request, null)
                .addOnSuccessListener { loc -> cont.resume(loc) }
                .addOnFailureListener { e -> cont.resumeWithException(e) }
        }

    // ── Battery ───────────────────────────────────────────────────────────────
    private fun getBatteryPercent(): Int? {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        return bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    // ── Network ───────────────────────────────────────────────────────────────
    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ── SMS Fallback ─────────────────────────────────────────────────────────
    private fun sendSmsFallback(update: LocationUpdate) {
        val smsNumber = prefs.getString("sms_gateway_number", null) ?: return
        val userId = prefs.getString("user_id", "") ?: ""
        val bat = update.batteryPct ?: 0
        val ts = System.currentTimeMillis()
        val payload = "LOC,$userId,${update.lat},${update.lng},${update.accuracy ?: 0f},$bat,$ts"

        try {
            SmsManager.getDefault().sendTextMessage(smsNumber, null, payload, null, null)
            android.util.Log.i("LocationWorker", "[SMS Fallback] Sent: $payload")
        } catch (e: Exception) {
            android.util.Log.w("LocationWorker", "[SMS Fallback] Failed: ${e.message}")
        }
    }

    // ── Offline Queue ─────────────────────────────────────────────────────────
    private val offlineQueue: ArrayDeque<LocationUpdate> = ArrayDeque()

    private fun queueOffline(update: LocationUpdate) {
        offlineQueue.addLast(update)
    }

    private suspend fun flushOfflineQueue() {
        while (offlineQueue.isNotEmpty()) {
            val update = offlineQueue.removeFirst()
            SafeTrackApiClient.postLocation(update)
        }
    }
}
