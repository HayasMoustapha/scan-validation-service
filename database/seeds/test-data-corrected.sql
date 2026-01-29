-- ========================================
-- 📊 DONNÉES DE TEST POUR SCAN-VALIDATION-SERVICE
-- ========================================

-- Insertion de sessions de scan de test
INSERT INTO scan_sessions (uid, started_at, ended_at, device_info, scan_operator_id, location, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', '2026-01-28 10:00:00', '2026-01-28 18:00:00', '{"device_id": "device_001", "device_type": "mobile"}', 1, 'Entrée Principale', '2026-01-28 10:00:00', '2026-01-28 10:00:00'),
('550e8400-e29b-41d4-a716-446655440002', '2026-01-28 14:00:00', '2026-01-28 22:00:00', '{"device_id": "device_002", "device_type": "tablet"}', 2, 'Sortie VIP', '2026-01-28 14:00:00', '2026-01-28 14:00:00'),
('550e8400-e29b-41d4-a716-446655440003', '2026-01-28 12:00:00', '2026-01-28 20:00:00', '{"device_id": "device_003", "device_type": "handheld"}', 3, 'Stand Food', '2026-01-28 12:00:00', '2026-01-28 12:00:00');

-- Insertion de logs de scan de test
INSERT INTO scan_logs (uid, scan_session_id, scanned_at, result, location, device_id, ticket_id, ticket_data, validation_details, fraud_flags, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440011', 1, '2026-01-28 10:15:00', 'VALID', 'Entrée Principale', 'device_001', 1234567890, '{"ticket_id": "TICKET_1234567890", "event_id": "EVENT_1234567890"}', '{"valid": true, "checks": ["signature", "expiration", "event"]}', '[]', '2026-01-28 10:15:00'),
('550e8400-e29b-41d4-a716-446655440012', 1, '2026-01-28 10:30:00', 'VALID', 'Entrée Principale', 'device_001', 2345678901, '{"ticket_id": "TICKET_2345678901", "event_id": "EVENT_1234567890"}', '{"valid": true, "checks": ["signature", "expiration", "event"]}', '[]', '2026-01-28 10:30:00'),
('550e8400-e29b-41d4-a716-446655440013', 2, '2026-01-28 14:20:00', 'VALID', 'Sortie VIP', 'device_002', 3456789012, '{"ticket_id": "TICKET_3456789012", "event_id": "EVENT_1234567890"}', '{"valid": true, "checks": ["signature", "expiration", "event"]}', '[]', '2026-01-28 14:20:00'),
('550e8400-e29b-41d4-a716-446655440014', 2, '2026-01-28 14:35:00', 'FRAUD_SUSPECTED', 'Sortie VIP', 'device_002', 4567890123, '{"ticket_id": "TICKET_4567890123", "event_id": "EVENT_1234567890"}', '{"valid": false, "checks": ["signature", "expiration", "event"], "fraud_indicators": ["duplicate_scan", "unusual_timing"]}', '["duplicate_scan", "unusual_timing"]', '2026-01-28 14:35:00'),
('550e8400-e29b-41d4-a716-446655440015', 3, '2026-01-28 12:10:00', 'VALID', 'Stand Food', 'device_003', 5678901234, '{"ticket_id": "TICKET_5678901234", "event_id": "EVENT_1234567890"}', '{"valid": true, "checks": ["signature", "expiration", "event"]}', '[]', '2026-01-28 12:10:00'),
('550e8400-e29b-41d4-a716-446655440016', 3, '2026-01-28 15:45:00', 'EXPIRED', 'Stand Food', 'device_003', 6789012345, '{"ticket_id": "TICKET_6789012345", "event_id": "EVENT_1234567890"}', '{"valid": false, "checks": ["signature", "expiration", "event"], "reason": "expired"}', '[]', '2026-01-28 15:45:00');

-- Insertion de tentatives de fraude de test
INSERT INTO fraud_attempts (uid, scan_log_id, fraud_type, severity, details, ip_address, user_agent, blocked, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440021', 4, 'duplicate_scan', 'high', '{"reason": "multiple_locations", "interval": 300}', '192.168.1.100', 'ScannerApp/1.0', true, '2026-01-28 14:35:00'),
('550e8400-e29b-41d4-a716-446655440022', 6, 'invalid_qr', 'medium', '{"reason": "tampered_signature", "format": "invalid"}', '192.168.1.101', 'ScannerApp/1.0', true, '2026-01-28 15:45:00'),
('550e8400-e29b-41d4-a716-446655440023', 5, 'suspicious_pattern', 'low', '{"reason": "rapid_succession", "devices": ["device_003", "device_001"]}', '192.168.1.102', 'ScannerApp/1.0', false, '2026-01-28 12:10:00');

-- Insertion de tickets scannés en cache
INSERT INTO scanned_tickets_cache (ticket_id, first_scan_at, last_scan_at, scan_count, scan_locations, is_blocked, block_reason, created_at, updated_at) VALUES
(1234567890, '2026-01-28 10:15:00', '2026-01-28 10:15:00', 1, '[{"location": "Entrée Principale", "time": "2026-01-28 10:15:00"}]', false, null, '2026-01-28 10:15:00', '2026-01-28 10:15:00'),
(2345678901, '2026-01-28 10:30:00', '2026-01-28 10:30:00', 1, '[{"location": "Entrée Principale", "time": "2026-01-28 10:30:00"}]', false, null, '2026-01-28 10:30:00', '2026-01-28 10:30:00'),
(3456789012, '2026-01-28 14:20:00', '2026-01-28 14:20:00', 1, '[{"location": "Sortie VIP", "time": "2026-01-28 14:20:00"}]', false, null, '2026-01-28 14:20:00', '2026-01-28 14:20:00'),
(4567890123, '2026-01-28 14:35:00', '2026-01-28 14:35:00', 1, '[{"location": "Sortie VIP", "time": "2026-01-28 14:35:00"}]', true, 'duplicate_scan_fraud', '2026-01-28 14:35:00', '2026-01-28 14:35:00'),
(5678901234, '2026-01-28 12:10:00', '2026-01-28 12:10:00', 1, '[{"location": "Stand Food", "time": "2026-01-28 12:10:00"}]', false, null, '2026-01-28 12:10:00', '2026-01-28 12:10:00');

-- Validation des insertions
DO $$
BEGIN
    RAISE NOTICE '✅ Données de test insérées avec succès';
    RAISE NOTICE '📊 Sessions de scan: 3';
    RAISE NOTICE '📋 Logs de scan: 6';
    RAISE NOTICE '🚨 Tentatives de fraude: 3';
    RAISE NOTICE '🎫 Tickets en cache: 5';
END $$;
