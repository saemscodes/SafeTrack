// SafeTrack Android — SOS Manager (Kotlin)
// Silent Alert mode with hardware button shortcut and extensible mode architecture

package com.safetrack.android.sos

import android.content.Context
import com.safetrack.android.location.SafeTrackApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// ─── SOS Mode (extensible enum — add new modes without touching trigger logic) ──
enum class SOSMode(val apiValue: String, val displayName: String, val description: String) {
    SILENT_ALERT(
        apiValue = "SILENT_ALERT",
        displayName = "Silent Alert",
        description = "Sends a push alert to trusted contacts with your location. No sound or visible change on your device."
    );
    // Future modes:
    // AUDIBLE_ALARM("AUDIBLE_ALARM", "Audible Alarm", "...")
    // AUTO_CALL("AUTO_CALL", "Auto Call", "...")
}

// ─── SOS Result ──────────────────────────────────────────────────────────────
data class SOSTriggerResult(
    val eventId: String,
    val notifiedCount: Int,
    val lat: Double,
    val lng: Double,
    val mode: SOSMode,
    val timestamp: Long = System.currentTimeMillis()
)

// ─── SOS Manager ─────────────────────────────────────────────────────────────
class SOSManager(private val context: Context) {

    companion object {
        @Volatile private var instance: SOSManager? = null
        fun getInstance(context: Context) = instance ?: synchronized(this) {
            instance ?: SOSManager(context.applicationContext).also { instance = it }
        }
    }

    private val scope = CoroutineScope(Dispatchers.Main)

    private val _state = MutableStateFlow<SOSState>(SOSState.Idle)
    val state: StateFlow<SOSState> = _state

    sealed class SOSState {
        object Idle : SOSState()
        object Processing : SOSState()
        data class Triggered(val result: SOSTriggerResult) : SOSState()
        data class Error(val message: String) : SOSState()
    }

    // ── Primary Trigger (call from button, hardware shortcut, or widget) ──────
    fun trigger(mode: SOSMode = SOSMode.SILENT_ALERT, groupId: String? = null) {
        if (_state.value is SOSState.Processing) return
        _state.value = SOSState.Processing

        scope.launch(Dispatchers.IO) {
            try {
                val location = getCurrentLocation()
                val result = dispatch(mode, location, groupId)
                _state.value = SOSState.Triggered(result)
            } catch (e: Exception) {
                _state.value = SOSState.Error(e.message ?: "Unknown error")
            }
        }
    }

    // ── Mode Dispatcher (single point for new mode handling) ──────────────────
    private suspend fun dispatch(
        mode: SOSMode,
        location: Pair<Double, Double>?,
        groupId: String?
    ): SOSTriggerResult {
        return when (mode) {
            SOSMode.SILENT_ALERT -> handleSilentAlert(location, groupId)
        }
    }

    // ── Silent Alert ──────────────────────────────────────────────────────────
    private suspend fun handleSilentAlert(
        location: Pair<Double, Double>?,
        groupId: String?
    ): SOSTriggerResult {
        // CRITICAL: On Android, do NOT trigger vibration, sound, or any screen wake.
        // The backend handles fan-out notifications to contacts.
        val (lat, lng) = location ?: (0.0 to 0.0)
        val response = SafeTrackApiClient.triggerSOS(
            lat = lat,
            lng = lng,
            mode = SOSMode.SILENT_ALERT.apiValue,
            groupId = groupId
        )
        return SOSTriggerResult(
            eventId = response.eventId,
            notifiedCount = response.notifiedCount,
            lat = lat,
            lng = lng,
            mode = SOSMode.SILENT_ALERT
        )
    }

    // ── Hardware shortcut: triple power button press (Android 12+) ──────────
    // Register in AndroidManifest.xml:
    // <action android:name="android.intent.action.EMERGENCY_GESTURE"/>
    fun handleEmergencyIntent() {
        trigger(mode = SOSMode.SILENT_ALERT)
    }

    // ── Location ─────────────────────────────────────────────────────────────
    private fun getCurrentLocation(): Pair<Double, Double>? {
        // Simplified: in production use FusedLocationProviderClient suspending call
        // LocationWorker already handles the live tracking; SOS grabs last known
        return null // replaced by FusedLocationProviderClient call in real impl
    }

    fun reset() {
        _state.value = SOSState.Idle
    }
}

// ─── SOS Button Composable ────────────────────────────────────────────────────
// In Jetpack Compose (SOS_Button.kt):
/*
@Composable
fun SOSButton(modifier: Modifier = Modifier) {
    val sosManager = SOSManager.getInstance(LocalContext.current)
    var holdProgress by remember { mutableStateOf(0f) }
    var isHolding by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .size(72.dp)                     // ≥ 48dp minimum hit target
            .semantics {
                contentDescription = "SOS Emergency Button — hold 2 seconds to activate"
            }
            .pointerInput(Unit) {
                detectTapGestures(
                    onLongPress = { sosManager.trigger() }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Pulsing ring
            drawCircle(color = Color.Red.copy(alpha = 0.3f), radius = size.minDimension / 2)
        }
        Surface(
            shape = CircleShape,
            color = Color(0xFFDC2626),
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "SOS",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }
    }
}
*/
