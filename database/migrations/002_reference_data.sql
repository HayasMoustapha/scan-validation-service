-- ========================================
-- MIGRATION 002: DONNÉES RÉFÉRENCE & VALIDATION
-- ========================================
-- Gère les références externes et données système
-- Version IDEMPOTENTE - Généré le 2026-01-26

-- ========================================
-- Vue pour valider les références externes (IDEMPOTENT)
-- ========================================
CREATE OR REPLACE VIEW external_references_validation AS
SELECT 
    'scan_sessions' as table_name,
    'scan_operator_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN scan_operator_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN scan_operator_id IS NULL THEN 1 END) as null_reference
FROM scan_sessions WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'scan_logs' as table_name,
    'ticket_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ticket_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN ticket_id IS NULL THEN 1 END) as null_reference
FROM scan_logs

UNION ALL

SELECT 
    'fraud_attempts' as table_name,
    'scan_log_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN scan_log_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN scan_log_id IS NULL THEN 1 END) as null_reference
FROM fraud_attempts

UNION ALL

SELECT 
    'scanned_tickets_cache' as table_name,
    'ticket_id' as column_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ticket_id IS NOT NULL THEN 1 END) as with_reference,
    COUNT(CASE WHEN ticket_id IS NULL THEN 1 END) as null_reference
FROM scanned_tickets_cache;

-- ========================================
-- Fonction pour valider l'intégrité des références (IDEMPOTENT)
-- ========================================
CREATE OR REPLACE FUNCTION validate_external_references()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    total_records BIGINT,
    with_reference BIGINT,
    null_reference BIGINT,
    integrity_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        erv.table_name,
        erv.column_name,
        erv.total_records,
        erv.with_reference,
        erv.null_reference,
        CASE 
            WHEN erv.total_records = 0 THEN 'EMPTY_TABLE'
            WHEN erv.null_reference = 0 THEN 'ALL_REFERENCED'
            WHEN erv.with_reference > 0 THEN 'PARTIAL_REFERENCES'
            ELSE 'NO_REFERENCES'
        END as integrity_status
    FROM external_references_validation erv;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Configuration système par défaut (IDEMPOTENT)
-- ========================================
-- Créer une table de configuration pour les paramètres du service
CREATE TABLE IF NOT EXISTS service_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT
);

-- Insérer les configurations par défaut
INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'scan_settings',
    '{"max_scan_attempts": 3, "scan_timeout": 5000, "retry_delay": 1000}',
    'Paramètres de scan par défaut',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'scan_settings'
);

INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'fraud_detection',
    '{"enable_duplicate_check": true, "enable_location_check": true, "enable_time_check": true}',
    'Configuration détection fraude',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'fraud_detection'
);

INSERT INTO service_config (key, value, description, created_at, updated_at)
SELECT 
    'rate_limiting',
    '{"scans_per_minute": 10, "scans_per_hour": 100, "block_duration": 300}',
    'Paramètres rate limiting',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM service_config WHERE key = 'rate_limiting'
);

-- ========================================
-- Opérateurs de scan par défaut (IDEMPOTENT)
-- ========================================
INSERT INTO scan_operators (access_code, permissions, is_active, created_at, updated_at)
SELECT 
    'SYSTEM_OPERATOR',
    '{"can_scan": true, "can_validate": true, "can_view_stats": true, "is_system": true}',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM scan_operators WHERE access_code = 'SYSTEM_OPERATOR' AND deleted_at IS NULL
);

INSERT INTO scan_operators (access_code, permissions, is_active, created_at, updated_at)
SELECT 
    'DEMO_OPERATOR',
    '{"can_scan": true, "can_validate": false, "can_view_stats": false, "is_demo": true}',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM scan_operators WHERE access_code = 'DEMO_OPERATOR' AND deleted_at IS NULL
);

-- ========================================
-- Règles de validation par défaut (IDEMPOTENT)
-- ========================================
INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_at, updated_at)
SELECT 
    'ticket_expiry',
    '{"hours": 24, "grace_period": 1}',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM validation_rules WHERE rule_type = 'ticket_expiry' AND deleted_at IS NULL
);

INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_at, updated_at)
SELECT 
    'duplicate_check',
    '{"check_interval": 1000, "max_scans": 5}',
    true,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM validation_rules WHERE rule_type = 'duplicate_check' AND deleted_at IS NULL
);

INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_at, updated_at)
SELECT 
    'location_validation',
    '{"allowed_locations": ["main_entrance", "side_entrance"]}',
    true,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM validation_rules WHERE rule_type = 'location_validation' AND deleted_at IS NULL
);

INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_at, updated_at)
SELECT 
    'time_window',
    '{"start_time": "09:00", "end_time": "23:00", "timezone": "Europe/Paris"}',
    true,
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM validation_rules WHERE rule_type = 'time_window' AND deleted_at IS NULL
);

INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_at, updated_at)
SELECT 
    'rate_limiting',
    '{"max_scans_per_minute": 10, "max_scans_per_hour": 100}',
    true,
    5,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM validation_rules WHERE rule_type = 'rate_limiting' AND deleted_at IS NULL
);

-- ========================================
-- Rapport d'intégrité (IDEMPOTENT)
-- ========================================
DO $$
DECLARE
    validation_record RECORD;
    total_issues INTEGER := 0;
    config_count INTEGER;
    operator_count INTEGER;
    rule_count INTEGER;
BEGIN
    -- Compter les configurations
    SELECT COUNT(*) INTO config_count FROM service_config;
    SELECT COUNT(*) INTO operator_count FROM scan_operators WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO rule_count FROM validation_rules WHERE deleted_at IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VALIDATION RÉFÉRENCES EXTERNES - scan-validation-service';
    RAISE NOTICE '══════════════════════════════════════════════════';
    RAISE NOTICE '📊 Analyse des références externes...';
    
    FOR validation_record IN SELECT * FROM validate_external_references() LOOP
        RAISE NOTICE '';
        RAISE NOTICE '📋 Table: %.%', validation_record.table_name, validation_record.column_name;
        RAISE NOTICE '   Total enregistrements: %', validation_record.total_records;
        RAISE NOTICE '   Avec référence: %', validation_record.with_reference;
        RAISE NOTICE '   Sans référence: %', validation_record.null_reference;
        RAISE NOTICE '   Statut intégrité: %', validation_record.integrity_status;
        
        IF validation_record.integrity_status IN ('PARTIAL_REFERENCES', 'NO_REFERENCES') 
           AND validation_record.total_records > 0 THEN
            total_issues := total_issues + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  Configurations système: %', config_count;
    RAISE NOTICE '👷 Opérateurs de scan: %', operator_count;
    RAISE NOTICE '📋 Règles de validation: %', rule_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 RÉSUMÉ VALIDATION';
    RAISE NOTICE '══════════════════════════════════════════════════';
    
    IF total_issues = 0 AND config_count >= 3 AND operator_count >= 2 AND rule_count >= 5 THEN
        RAISE NOTICE '✅ SUCCÈS : Service prêt à fonctionner';
        RAISE NOTICE '🔗 Références externes valides';
        RAISE NOTICE '⚙️  Configurations système initialisées';
        RAISE NOTICE '👷 Opérateurs de scan configurés';
        RAISE NOTICE '📋 Règles de validation actives';
    ELSE
        RAISE NOTICE '⚠️  ATTENTION : % problème(s) détecté(s)', total_issues;
        RAISE NOTICE '💡 Solution: Assurez-vous que les entités référencées existent';
        RAISE NOTICE '🔧 Les enregistrements avec références NULL seront ignorés';
    END IF;
    
    RAISE NOTICE '══════════════════════════════════════════════════';
END $$;
