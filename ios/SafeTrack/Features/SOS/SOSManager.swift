// SafeTrack iOS — SOS Handler
// Silent Alert mode with hardware button shortcut and multi-mode architecture

import SwiftUI
import AVFoundation

// MARK: - SOS Mode Enum (extensible)
enum SOSMode: String, Codable, CaseIterable {
    case silentAlert = "SILENT_ALERT"
    // Future modes added here without touching trigger logic:
    // case audibleAlarm = "AUDIBLE_ALARM"
    // case autoCall     = "AUTO_CALL"

    var displayName: String {
        switch self {
        case .silentAlert: return "Silent Alert"
        }
    }
    var description: String {
        switch self {
        case .silentAlert: return "Sends a push alert to your trusted contacts with your location. No sound or screen change on your device."
        }
    }
}

// MARK: - SOS Trigger Result
struct SOSTriggerResult {
    let eventId: String
    let notifiedCount: Int
    let lat: Double
    let lng: Double
    let mode: SOSMode
    let timestamp: Date
}

// MARK: - SOS Manager
@MainActor
class SOSManager: ObservableObject {
    static let shared = SOSManager()

    @Published var isProcessing: Bool = false
    @Published var lastEvent: SOSTriggerResult?

    // MARK: - Primary Trigger
    /// Call this from any SOS activation path (button, hardware shortcut, widget)
    func trigger(mode: SOSMode = .silentAlert, groupId: String? = nil) async throws -> SOSTriggerResult {
        guard !isProcessing else { throw SOSError.alreadyProcessing }
        isProcessing = true
        defer { isProcessing = false }

        // 1. Capture current location (non-blocking with 5s timeout)
        let location = try await captureLocation(timeout: 5)

        // 2. Dispatch to mode-specific handler
        return try await handleMode(mode, location: location, groupId: groupId)
    }

    // MARK: - Mode Dispatch (single insertion point for new modes)
    private func handleMode(_ mode: SOSMode, location: CLLocationCoordinate2D, groupId: String?) async throws -> SOSTriggerResult {
        switch mode {
        case .silentAlert:
            return try await handleSilentAlert(location: location, groupId: groupId)
        }
    }

    // MARK: - Silent Alert Handler
    private func handleSilentAlert(location: CLLocationCoordinate2D, groupId: String?) async throws -> SOSTriggerResult {
        // CRITICAL: No sound, no haptic, no screen changes on THIS device
        // Contacts receive a push via backend fan-out
        let result = try await SafeTrackAPI.shared.triggerSOS(
            lat: location.latitude,
            lng: location.longitude,
            mode: SOSMode.silentAlert.rawValue,
            groupId: groupId
        )
        let ev = SOSTriggerResult(
            eventId: result.eventId,
            notifiedCount: result.notifiedCount,
            lat: location.latitude,
            lng: location.longitude,
            mode: .silentAlert,
            timestamp: Date()
        )
        lastEvent = ev
        return ev
    }

    // MARK: - Location capture
    private func captureLocation(timeout: TimeInterval) async throws -> CLLocationCoordinate2D {
        if let loc = SafeTrackLocationManager.shared.currentLocation {
            return loc.coordinate
        }
        // Fallback — wait briefly for a fresh fix
        try await Task.sleep(nanoseconds: UInt64(min(timeout, 3)) * 1_000_000_000)
        if let loc = SafeTrackLocationManager.shared.currentLocation {
            return loc.coordinate
        }
        throw SOSError.noLocationAvailable
    }
}

// MARK: - SOS Button View (compliant with ≥44×44pt hit target requirement)
struct SOSButtonView: View {
    @StateObject private var sos = SOSManager.shared
    @State private var isHolding = false
    @State private var holdProgress: CGFloat = 0
    @State private var holdTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            // Pulsing rings
            ForEach(0..<2) { i in
                Circle()
                    .stroke(Color.red.opacity(0.3), lineWidth: 2)
                    .scaleEffect(isHolding ? 1.8 : 1.0 + CGFloat(i) * 0.3)
                    .opacity(isHolding ? 0 : 0.6)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false).delay(Double(i) * 0.5), value: isHolding)
            }

            // Progress ring
            if isHolding {
                Circle()
                    .trim(from: 0, to: holdProgress)
                    .stroke(Color.red, lineWidth: 4)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.05), value: holdProgress)
            }

            // SOS Label
            Button(action: {}) {
                Text("SOS")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .frame(width: 72, height: 72)
                    .background(
                        RadialGradient(
                            gradient: Gradient(colors: [Color(red: 0.9, green: 0.2, blue: 0.2), Color(red: 0.6, green: 0.1, blue: 0.1)]),
                            center: .center,
                            startRadius: 0,
                            endRadius: 40
                        )
                    )
                    .clipShape(Circle())
                    .shadow(color: .red.opacity(0.5), radius: 12, x: 0, y: 4)
            }
            .accessibilityLabel("SOS Emergency Button — hold 2 seconds to activate")
            .accessibilityHint("Sends a silent alert to your trusted contacts with your location")
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 2.0)
                    .onChanged { _ in
                        if !isHolding {
                            isHolding = true
                            startHoldTimer()
                        }
                    }
                    .onEnded { _ in
                        Task { try? await SOSManager.shared.trigger() }
                        resetHold()
                    }
            )
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onEnded { _ in resetHold() }
            )
        }
        .frame(width: 80, height: 80) // exceeds 44×44 minimum hit target
    }

    private func startHoldTimer() {
        holdTask = Task {
            for i in 0...40 {
                try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
                await MainActor.run { holdProgress = CGFloat(i) / 40.0 }
            }
        }
    }

    private func resetHold() {
        isHolding = false
        holdProgress = 0
        holdTask?.cancel()
    }
}

enum SOSError: Error {
    case alreadyProcessing
    case noLocationAvailable
    case networkError(Error)
}
