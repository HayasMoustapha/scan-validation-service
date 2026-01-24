-- ============================================
-- SCAN VALIDATION SERVICE - Initial Schema
-- Diagram: /event-planner-documents/scan-validation-diagram.md
-- ============================================

-- Créer la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS event_planner_scan_validation;

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des scans de tickets
CREATE TABLE IF NOT EXISTS ticket_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    ticket_code VARCHAR(255) NOT NULL,
    event_id UUID NOT NULL,
    scanner_id UUID,
    scan_status VARCHAR(20) DEFAULT 'valid' CHECK (scan_status IN ('valid', 'invalid', 'already_used', 'expired', 'cancelled')),
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scan_location VARCHAR(255),
    scanner_device VARCHAR(100),
    validation_result JSONB DEFAULT '{}',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des tickets (référence pour validation)
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    guest_id UUID,
    ticket_code VARCHAR(255) UNIQUE NOT NULL,
    qr_code_data TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    scan_count INTEGER DEFAULT 0,
    max_scans INTEGER DEFAULT 1,
    ticket_type_id UUID,
    metadata JSONB DEFAULT '{}'
);

-- Table des événements (référence)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    validation_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des scanners/appareils de validation
CREATE TABLE IF NOT EXISTS scanners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) DEFAULT 'mobile',
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    operator_id UUID,
    last_scan_time TIMESTAMP WITH TIME ZONE,
    total_scans INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des logs de validation
CREATE TABLE IF NOT EXISTS validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES ticket_scans(id) ON DELETE CASCADE,
    log_level VARCHAR(10) DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_code ON ticket_scans(ticket_code);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_id ON ticket_scans(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scan_time ON ticket_scans(scan_time);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scan_status ON ticket_scans(scan_status);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_scanners_status ON scanners(status);
CREATE INDEX IF NOT EXISTS idx_validation_logs_scan_id ON validation_logs(scan_id);
CREATE INDEX IF NOT EXISTS idx_validation_logs_created_at ON validation_logs(created_at);

-- Table de migration pour suivre les versions
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inscrire cette migration
INSERT INTO migration_history (filename) VALUES ('001_initial_schema.sql')
ON CONFLICT (filename) DO NOTHING;
