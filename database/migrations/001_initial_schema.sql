-- Migration initiale pour Scan Validation Service
-- Basé sur scan-validator-diagram.md

-- Extension UUID pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés pour la validation
DO $$ BEGIN
    CREATE TYPE scan_result AS ENUM ('valid', 'invalid', 'already_used', 'expired');
    CREATE TYPE scan_status AS ENUM ('active', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table des sessions de scan
CREATE TABLE IF NOT EXISTS scan_sessions (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    device_info JSONB,
    scan_operator_id BIGINT,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- Table des logs de scan
CREATE TABLE IF NOT EXISTS scan_logs (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    scan_session_id BIGINT REFERENCES scan_sessions(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result scan_result NOT NULL,
    location VARCHAR(255),
    device_id VARCHAR(255),
    ticket_id BIGINT,
    ticket_data JSONB,
    validation_details JSONB,
    fraud_flags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT
);

-- Table des opérateurs de scan
CREATE TABLE IF NOT EXISTS scan_operators (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    access_code VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- Table des règles de validation
CREATE TABLE IF NOT EXISTS validation_rules (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_type VARCHAR(100) NOT NULL,
    parameters JSONB,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- Table des tentatives de fraude
CREATE TABLE IF NOT EXISTS fraud_attempts (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    scan_log_id BIGINT REFERENCES scan_logs(id) ON DELETE CASCADE,
    fraud_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT
);

-- Table des tickets scannés (cache pour performance)
CREATE TABLE IF NOT EXISTS scanned_tickets_cache (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT UNIQUE NOT NULL,
    first_scan_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_scan_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scan_count INTEGER DEFAULT 1,
    scan_locations JSONB,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_scan_sessions_operator_id ON scan_sessions(scan_operator_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(ended_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_sessions_started_at ON scan_sessions(started_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_logs_session_id ON scan_logs(scan_session_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_result ON scan_logs(result);
CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scan_operators_access_code ON scan_operators(access_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_operators_active ON scan_operators(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(rule_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON validation_rules(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_priority ON validation_rules(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_attempts_type ON fraud_attempts(fraud_type);
CREATE INDEX IF NOT EXISTS idx_fraud_attempts_created_at ON fraud_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_attempts_blocked ON fraud_attempts(blocked);
CREATE INDEX IF NOT EXISTS idx_scanned_tickets_cache_ticket_id ON scanned_tickets_cache(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scanned_tickets_cache_blocked ON scanned_tickets_cache(is_blocked);

-- Commentaires pour documentation
COMMENT ON TABLE scan_sessions IS 'Sessions de scan pour la validation de tickets';
COMMENT ON TABLE scan_logs IS 'Logs des scans de tickets avec détails de validation';
COMMENT ON TABLE scan_operators IS 'Opérateurs autorisés pour le scan';
COMMENT ON TABLE validation_rules IS 'Règles de validation des tickets';
COMMENT ON TABLE fraud_attempts IS 'Tentatives de fraude détectées';
COMMENT ON TABLE scanned_tickets_cache IS 'Cache des tickets scannés pour performance';

-- Insertion d'un opérateur de scan par défaut
INSERT INTO scan_operators (access_code, permissions, is_active, created_by) VALUES 
('SCAN_001', '{"can_scan": true, "can_validate": true, "can_view_stats": true}', true, 1)
ON CONFLICT (access_code) DO NOTHING;

-- Insertion de règles de validation par défaut
INSERT INTO validation_rules (rule_type, parameters, is_active, priority, created_by) VALUES 
('ticket_expiry', '{"hours": 24, "grace_period": 1}', true, 1, 1),
('duplicate_check', '{"check_interval": 1000, "max_scans": 5}', true, 2, 1),
('location_validation', '{"allowed_locations": ["main_entrance", "side_entrance"]}', true, 3, 1),
('time_window', '{"start_time": "09:00", "end_time": "23:00", "timezone": "Europe/Paris"}', true, 4, 1),
('rate_limiting', '{"max_scans_per_minute": 10, "max_scans_per_hour": 100}', true, 5, 1)
ON CONFLICT DO NOTHING;
