-- ============================================
-- SCAN VALIDATION SERVICE - Initial Schema
-- Diagram: /event-planner-documents/scan-validator-diagram.md
-- Aligné avec le code (scan.repository.js)
-- ============================================

-- Extension UUID pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Table des opérateurs de scan
-- ============================================
CREATE TABLE IF NOT EXISTS scan_operators (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    event_id BIGINT,
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

-- ============================================
-- Table des règles de validation
-- ============================================
CREATE TABLE IF NOT EXISTS validation_rules (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    event_id BIGINT NOT NULL,
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

-- ============================================
-- Table des sessions de scan
-- ============================================
CREATE TABLE IF NOT EXISTS scan_sessions (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    scan_operator_id BIGINT REFERENCES scan_operators(id) ON DELETE SET NULL,
    event_id BIGINT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    device_info JSONB,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT
);

-- ============================================
-- Table des logs de scan
-- ============================================
CREATE TABLE IF NOT EXISTS scan_logs (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL DEFAULT gen_random_uuid(),
    scan_session_id BIGINT REFERENCES scan_sessions(id) ON DELETE SET NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result VARCHAR(20) NOT NULL CHECK (result IN ('VALID', 'INVALID', 'ALREADY_USED', 'EXPIRED', 'FRAUD_DETECTED')),
    location VARCHAR(255),
    device_id VARCHAR(255),
    ticket_id BIGINT,
    ticket_data JSONB,
    validation_details JSONB,
    fraud_flags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT
);

-- ============================================
-- Table des tentatives de fraude
-- ============================================
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

-- ============================================
-- Table cache des tickets scannés
-- ============================================
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

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scan_operators_access_code ON scan_operators(access_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_operators_active ON scan_operators(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_operators_user_id ON scan_operators(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_operators_event_id ON scan_operators(event_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_validation_rules_event_id ON validation_rules(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(rule_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON validation_rules(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_validation_rules_priority ON validation_rules(priority) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scan_sessions_operator_id ON scan_sessions(scan_operator_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_sessions_event_id ON scan_sessions(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scan_sessions_started_at ON scan_sessions(started_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scan_logs_session_id ON scan_logs(scan_session_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_result ON scan_logs(result);
CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket_id ON scan_logs(ticket_id);

CREATE INDEX IF NOT EXISTS idx_fraud_attempts_type ON fraud_attempts(fraud_type);
CREATE INDEX IF NOT EXISTS idx_fraud_attempts_created_at ON fraud_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_attempts_blocked ON fraud_attempts(blocked);

CREATE INDEX IF NOT EXISTS idx_scanned_tickets_cache_ticket_id ON scanned_tickets_cache(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scanned_tickets_cache_blocked ON scanned_tickets_cache(is_blocked);

-- ============================================
-- Commentaires
-- ============================================
COMMENT ON TABLE scan_sessions IS 'Sessions de scan pour la validation de tickets';
COMMENT ON TABLE scan_logs IS 'Logs des scans de tickets avec détails de validation';
COMMENT ON TABLE scan_operators IS 'Opérateurs autorisés pour le scan';
COMMENT ON TABLE validation_rules IS 'Règles de validation des tickets';
COMMENT ON TABLE fraud_attempts IS 'Tentatives de fraude détectées';
COMMENT ON TABLE scanned_tickets_cache IS 'Cache des tickets scannés pour performance';
