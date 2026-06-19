// SafeTrack iOS — Location Manager
// CoreLocation wrapper with background updates, adaptive frequency, and SMS fallback

import CoreLocation
import BackgroundTasks
import MessageUI

// MARK: - Ping Mode
enum PingMode: String, Codable {
    case high   = "HIGH"    // 30s
    case medium = "MEDIUM"  // 5min
    case low    = "LOW"     // 15min
    case custom = "CUSTOM"
    case adaptive = "ADAPTIVE"

    var interval: TimeInterval {
        switch self {
        case .high:    return 30
        case .medium:  return 300
        case .low:     return 900
        case .custom, .adaptive: return 300
        }
    }

    var batteryDescription: String {
        switch self {
        case .high:    return "High battery impact"
        case .medium:  return "Moderate battery impact"
        case .low:     return "Low battery impact"
        case .custom:  return "Custom interval"
        case .adaptive: return "Adaptive — varies with motion"
        }
    }
}

// MARK: - Location Source
enum LocationSource: String, Codable {
    case nativeGPS               = "NATIVE_GPS"
    case smsFallback             = "SMS_FALLBACK"
    case bleTrackerTag           = "BLE_TRACKER_TAG"
    case remotePingForced        = "REMOTE_PING_FORCED"
}

// MARK: - Location Update
struct LocationUpdate: Codable {
    let lat: Double
    let lng: Double
    let accuracy: Double?
    let altitude: Double?
    let speed: Double?
    let bearing: Double?
    let batteryPct: Int?
    let source: String
    let pingMechanism: String?
    let trackerTagId: String?
}

// MARK: - SafeTrackLocationManager
class SafeTrackLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = SafeTrackLocationManager()

    private let manager = CLLocationManager()
    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    // Settings
    var pingMode: PingMode = .medium
    var adaptiveEnabled: Bool = false
    var customIntervalSec: TimeInterval?

    private var pingTimer: Timer?
    private var offlineQueue: [LocationUpdate] = []
    private var isOnline: Bool = true

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.pausesLocationUpdatesAutomatically = false
        if #available(iOS 11.0, *) {
            manager.showsBackgroundLocationIndicator = true
        }
    }

    // MARK: - Request Permission
    func requestPermission() {
        manager.requestAlwaysAuthorization()
    }

    // MARK: - Start Tracking
    func startTracking() {
        manager.startUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = true
        startPingScheduler()
    }

    // MARK: - Stop Tracking
    func stopTracking() {
        manager.stopUpdatingLocation()
        pingTimer?.invalidate()
    }

    // MARK: - Ping Scheduler
    private func startPingScheduler() {
        pingTimer?.invalidate()
        let interval = effectiveInterval
        pingTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.sendLocationPing()
        }
    }

    var effectiveInterval: TimeInterval {
        if let custom = customIntervalSec { return custom }
        return pingMode.interval
    }

    private func sendLocationPing() {
        guard let location = currentLocation else { return }
        let battery = Int(UIDevice.current.batteryLevel * 100)
        let update = LocationUpdate(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            altitude: location.altitude,
            speed: location.speed >= 0 ? location.speed : nil,
            bearing: location.course >= 0 ? location.course : nil,
            batteryPct: battery >= 0 ? battery : nil,
            source: LocationSource.nativeGPS.rawValue,
            pingMechanism: pingMode.rawValue,
            trackerTagId: nil
        )

        if isOnline {
            SafeTrackAPI.shared.postLocation(update) { result in
                if case .failure = result {
                    self.queueOffline(update)
                }
            }
        } else {
            sendSMSFallback(update)
        }
    }

    // MARK: - SMS Fallback
    private func sendSMSFallback(_ update: LocationUpdate) {
        let userId = AppSession.shared.userId ?? ""
        let bat = update.batteryPct ?? 0
        let ts = Int(Date().timeIntervalSince1970 * 1000)
        let payload = "LOC,\(userId),\(update.lat),\(update.lng),\(update.accuracy ?? 0),\(bat),\(ts)"
        // NOTE: On iOS, SMS sending without UI requires enterprise MDM entitlements.
        // This implementation queues the payload for display in a MessageUI compose sheet.
        SMSQueue.shared.enqueue(payload: payload)
        NotificationCenter.default.post(name: .smsFallbackQueued, object: payload)
    }

    // MARK: - Offline Queue
    private func queueOffline(_ update: LocationUpdate) {
        offlineQueue.append(update)
    }

    func flushOfflineQueue() {
        guard isOnline, !offlineQueue.isEmpty else { return }
        let queued = offlineQueue
        offlineQueue.removeAll()
        for update in queued {
            SafeTrackAPI.shared.postLocation(update) { _ in }
        }
    }

    // MARK: - Remote Ping Response
    func respondToPing(pingId: String) {
        sendLocationPing()  // Force-report immediately
    }

    // MARK: - CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        currentLocation = location
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        DispatchQueue.main.async { self.authorizationStatus = status }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationManager] Error: \(error.localizedDescription)")
    }
}

// MARK: - NSNotification extension
extension Notification.Name {
    static let smsFallbackQueued = Notification.Name("SafeTrack.SMSFallbackQueued")
}
