// SafeTrack iOS — BLE Tracker Manager
// Scans for paired generic BLE beacons, records last-seen location

import CoreBluetooth
import CoreLocation

// MARK: - TrackerTag Model
struct TrackerTag: Identifiable, Codable {
    let id: String
    let label: String
    let bleUuid: String
    var lastSeenLat: Double?
    var lastSeenLng: Double?
    var lastSeenAt: Date?
    var batteryPct: Int?
    var rssi: Int?
    var isInRange: Bool = false
}

// MARK: - BLE Scanner
class BLEManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    static let shared = BLEManager()

    private var central: CBCentralManager!
    @Published var pairedTags: [TrackerTag] = []
    @Published var discoveredPeripherals: [CBPeripheral] = []

    // Map bleUUID → TrackerTag for quick lookup
    private var tagsByUUID: [String: TrackerTag] = [:]
    private var peripheralsByUUID: [UUID: CBPeripheral] = [:]

    private override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil, options: [
            CBCentralManagerOptionRestoreIdentifierKey: "SafeTrackBLERestore"
        ])
    }

    // MARK: - Load paired tags from server/local
    func loadPairedTags(_ tags: [TrackerTag]) {
        pairedTags = tags
        tagsByUUID = Dictionary(uniqueKeysWithValues: tags.map { ($0.bleUuid.uppercased(), $0) })
    }

    // MARK: - Start scanning (background-capable with CBCentralManagerScanOptionAllowDuplicatesKey)
    func startScanning() {
        guard central.state == .poweredOn else { return }
        central.scanForPeripherals(
            withServices: nil,  // scan all services — generic BLE tags
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
        print("[BLE] Started scanning for tracker tags")
    }

    func stopScanning() {
        central.stopScan()
    }

    // MARK: - CBCentralManagerDelegate
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            startScanning()
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any],
                        rssi RSSI: NSNumber) {

        let uuid = peripheral.identifier.uuidString.uppercased()

        guard var tag = tagsByUUID[uuid] else { return } // only care about paired tags

        // Get current phone location for tag's last-seen
        let location = SafeTrackLocationManager.shared.currentLocation
        tag.lastSeenLat = location?.coordinate.latitude
        tag.lastSeenLng = location?.coordinate.longitude
        tag.lastSeenAt = Date()
        tag.rssi = RSSI.intValue
        tag.isInRange = true

        // Extract battery from advertisement if available (e.g. via manufacturer data)
        if let mfData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data, mfData.count >= 2 {
            tag.batteryPct = Int(mfData[1])
        }

        tagsByUUID[uuid] = tag
        updatePairedTag(tag)

        // Report seen event to backend
        reportTagSeen(tag)
    }

    func centralManager(_ central: CBCentralManager,
                        willRestoreState dict: [String: Any]) {
        // Background BLE state restoration
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
            peripherals.forEach { peripheralsByUUID[$0.identifier] = $0 }
        }
    }

    // MARK: - Tag Out of Range Detection
    func markTagsOutOfRange() {
        let cutoffDate = Date().addingTimeInterval(-300) // 5 min without signal = out of range
        for (uuid, tag) in tagsByUUID {
            if let lastSeen = tag.lastSeenAt, lastSeen < cutoffDate {
                var updated = tag
                updated.isInRange = false
                tagsByUUID[uuid] = updated
                updatePairedTag(updated)
            }
        }
    }

    private func updatePairedTag(_ tag: TrackerTag) {
        if let idx = pairedTags.firstIndex(where: { $0.id == tag.id }) {
            DispatchQueue.main.async { self.pairedTags[idx] = tag }
        }
    }

    // MARK: - Backend Reporting
    private func reportTagSeen(_ tag: TrackerTag) {
        guard let lat = tag.lastSeenLat, let lng = tag.lastSeenLng else { return }
        SafeTrackAPI.shared.reportTagSeen(
            tagId: tag.id,
            lat: lat,
            lng: lng,
            batteryPct: tag.batteryPct
        ) { _ in }
    }
}
