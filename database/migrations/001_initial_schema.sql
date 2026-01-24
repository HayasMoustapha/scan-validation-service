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
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    device_info JSONB,
    scan_operator_id BIGINT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des logs de scan
CREATE TABLE IF NOT EXISTS scan_logs (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    scan_session_id BIGINT REFERENCES scan_sessions(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result scan_result NOT NULL,
    location VARCHAR(255),
    device_id VARCHAR(255),
    ticket_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des opérateurs de scan
CREATE TABLE IF NOT EXISTS scan_operators (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    access_code VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des règles de validation
CREATE TABLE IF NOT EXISTS validation_rules (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_type VARCHAR(100) NOT NULL,
    parameters JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_scan_sessions_operator_id ON scan_sessions(scan_operator_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_session_id ON scan_logs(scan_session_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_result ON scan_logs(result);
CREATE INDEX IF NOT EXISTS idx_scan_operators_access_code ON scan_operators(access_code);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON validation_rules(is_active);

-- Commentaires pour documentation
COMMENT ON TABLE scan_sessions IS 'Sessions de scan pour la validation de tickets';
COMMENT ON TABLE scan_logs IS 'Logs des scans de tickets';
COMMENT ON TABLE scan_operators IS 'Opérateurs autorisés pour le scan';
COMMENT ON TABLE validation_rules IS 'Règles de validation des tickets';

-- Insertion d'un opérateur de scan par défaut
INSERT INTO scan_operators (access_code, permissions, is_active) VALUES 
('SCAN_001', '{"can_scan": true, "can_validate": true}', true)
ON CONFLICT (access_code) DO NOTHING;

-- Insertion d'une règle de validation par défaut
INSERT INTO validation_rules (rule_type, parameters, is_active) VALUES 
('ticket_expiry', '{"hours": 24, "grace_period": 1}', true),
('duplicate_check', '{"check_interval": 1000}', true)
ON CONFLICT DO NOTHING;
