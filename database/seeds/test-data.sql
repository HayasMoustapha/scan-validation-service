-- ========================================
-- 📊 DONNÉES DE TEST POUR SCAN-VALIDATION-SERVICE
-- ========================================

-- Insertion de sessions de scan de test
INSERT INTO scan_sessions (id, operator_id, device_id, location, start_time, end_time, status, created_at, updated_at) VALUES
('session_001', 'operator_001', 'device_001', 'Entrée Principale', '2026-01-28 10:00:00', '2026-01-28 18:00:00', 'active', '2026-01-28 10:00:00', '2026-01-28 10:00:00'),
('session_002', 'operator_002', 'device_002', 'Sortie VIP', '2026-01-28 14:00:00', '2026-01-28 22:00:00', 'active', '2026-01-28 14:00:00', '2026-01-28 14:00:00'),
('session_003', 'operator_003', 'device_003', 'Stand Food', '2026-01-28 12:00:00', '2026-01-28 20:00:00', 'completed', '2026-01-28 12:00:00', '2026-01-28 20:00:00');

-- Insertion de logs de scan de test
INSERT INTO scan_logs (id, session_id, ticket_id, event_id, scan_result, scan_time, location, device_id, operator_id, fraud_indicators, created_at) VALUES
('log_001', 'session_001', 'TICKET_1234567890', 'EVENT_1234567890', 'VALID', '2026-01-28 10:15:00', 'Entrée Principale', 'device_001', 'operator_001', '[]', '2026-01-28 10:15:00'),
('log_002', 'session_001', 'TICKET_2345678901', 'EVENT_1234567890', 'VALID', '2026-01-28 10:30:00', 'Entrée Principale', 'device_001', 'operator_001', '[]', '2026-01-28 10:30:00'),
('log_003', 'session_002', 'TICKET_3456789012', 'EVENT_1234567890', 'VALID', '2026-01-28 14:20:00', 'Sortie VIP', 'device_002', 'operator_002', '[]', '2026-01-28 14:20:00'),
('log_004', 'session_002', 'TICKET_4567890123', 'EVENT_1234567890', 'FRAUD_SUSPECTED', '2026-01-28 14:35:00', 'Sortie VIP', 'device_002', 'operator_002', '["duplicate_scan", "unusual_timing"]', '2026-01-28 14:35:00'),
('log_005', 'session_003', 'TICKET_5678901234', 'EVENT_1234567890', 'VALID', '2026-01-28 12:10:00', 'Stand Food', 'device_003', 'operator_003', '[]', '2026-01-28 12:10:00'),
('log_006', 'session_003', 'TICKET_6789012345', 'EVENT_1234567890', 'EXPIRED', '2026-01-28 15:45:00', 'Stand Food', 'device_003', 'operator_003', '[]', '2026-01-28 15:45:00');

-- Insertion de tentatives de fraude de test
INSERT INTO fraud_attempts (id, ticket_id, event_id, scan_time, location, device_id, operator_id, fraud_type, fraud_indicators, blocked, created_at) VALUES
('fraud_001', 'TICKET_7890123456', 'EVENT_1234567890', '2026-01-28 11:00:00', 'Entrée Principale', 'device_001', 'operator_001', 'duplicate_scan', '["multiple_locations", "short_interval"]', true, '2026-01-28 11:00:00'),
('fraud_002', 'TICKET_8901234567', 'EVENT_1234567890', '2026-01-28 16:30:00', 'Sortie VIP', 'device_002', 'operator_002', 'invalid_qr', '["tampered_signature", "invalid_format"]', true, '2026-01-28 16:30:00'),
('fraud_003', 'TICKET_9012345678', 'EVENT_1234567890', '2026-01-28 13:15:00', 'Stand Food', 'device_003', 'operator_003', 'suspicious_pattern', '["rapid_succession", "multiple_devices"]', false, '2026-01-28 13:15:00');

-- Insertion de tickets scannés en cache
INSERT INTO scanned_tickets_cache (ticket_id, event_id, first_scan_time, last_scan_time, scan_count, location, device_id, operator_id, status, created_at, updated_at) VALUES
('TICKET_1234567890', 'EVENT_1234567890', '2026-01-28 10:15:00', '2026-01-28 10:15:00', 1, 'Entrée Principale', 'device_001', 'operator_001', 'scanned', '2026-01-28 10:15:00', '2026-01-28 10:15:00'),
('TICKET_2345678901', 'EVENT_1234567890', '2026-01-28 10:30:00', '2026-01-28 10:30:00', 1, 'Entrée Principale', 'device_001', 'operator_001', 'scanned', '2026-01-28 10:30:00', '2026-01-28 10:30:00'),
('TICKET_3456789012', 'EVENT_1234567890', '2026-01-28 14:20:00', '2026-01-28 14:20:00', 1, 'Sortie VIP', 'device_002', 'operator_002', 'scanned', '2026-01-28 14:20:00', '2026-01-28 14:20:00'),
('TICKET_4567890123', 'EVENT_1234567890', '2026-01-28 14:35:00', '2026-01-28 14:35:00', 1, 'Sortie VIP', 'device_002', 'operator_002', 'blocked', '2026-01-28 14:35:00', '2026-01-28 14:35:00'),
('TICKET_5678901234', 'EVENT_1234567890', '2026-01-28 12:10:00', '2026-01-28 12:10:00', 1, 'Stand Food', 'device_003', 'operator_003', 'scanned', '2026-01-28 12:10:00', '2026-01-28 12:10:00');

-- Insertion de règles de validation
INSERT INTO validation_rules (id, rule_name, rule_type, conditions, actions, priority, is_active, created_at, updated_at) VALUES
('rule_001', 'Max Scans per Ticket', 'scan_limit', '{"max_scans": 5, "time_window": "24h"}', '{"block": true, "alert": true}', 1, true, '2026-01-28 09:00:00', '2026-01-28 09:00:00'),
('rule_002', 'Duplicate Location Check', 'fraud_detection', '{"min_interval": 300, "same_location": false}', '{"flag": true, "require_review": true}', 2, true, '2026-01-28 09:00:00', '2026-01-28 09:00:00'),
('rule_003', 'Event Time Validation', 'time_check', '{"allow_before_start": false, "allow_after_end": false}', '{"reject": true}', 3, true, '2026-01-28 09:00:00', '2026-01-28 09:00:00');

-- Insertion d'opérateurs de scan
INSERT INTO scan_operators (id, name, email, role, permissions, is_active, created_at, updated_at) VALUES
('operator_001', 'Jean Dupont', 'jean.dupont@eventplanner.com', 'senior_scanner', '["scan", "view_stats", "manage_sessions"]', true, '2026-01-28 08:00:00', '2026-01-28 08:00:00'),
('operator_002', 'Marie Martin', 'marie.martin@eventplanner.com', 'vip_scanner', '["scan", "view_stats"]', true, '2026-01-28 08:00:00', '2026-01-28 08:00:00'),
('operator_003', 'Pierre Bernard', 'pierre.bernard@eventplanner.com', 'standard_scanner', '["scan"]', true, '2026-01-28 08:00:00', '2026-01-28 08:00:00');

-- Validation des insertions
DO $$
BEGIN
    RAISE NOTICE '✅ Données de test insérées avec succès';
    RAISE NOTICE '📊 Sessions de scan: 3';
    RAISE NOTICE '📋 Logs de scan: 6';
    RAISE NOTICE '🚨 Tentatives de fraude: 3';
    RAISE NOTICE '🎫 Tickets en cache: 5';
    RAISE NOTICE '📏 Règles de validation: 3';
    RAISE NOTICE '👥 Opérateurs: 3';
END $$;
