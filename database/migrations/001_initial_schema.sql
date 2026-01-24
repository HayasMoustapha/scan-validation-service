-- Scan Validation Service Database Schema
-- Based on scan-validator-diagram.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create scan-related enums
CREATE TYPE scan_result AS ENUM ('valid', 'invalid', 'already_used', 'expired', 'duplicate', 'error');
CREATE TYPE scan_session_status AS ENUM ('active', 'completed', 'aborted');
CREATE TYPE validation_rule_type AS ENUM ('time_window', 'location_based', 'ticket_type', 'event_access', 'custom');

-- Scan sessions table
CREATE TABLE scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    operator_id UUID,
    device_id VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    location VARCHAR(255),
    status scan_session_status DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_scans INTEGER DEFAULT 0,
    valid_scans INTEGER DEFAULT 0,
    invalid_scans INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan logs table
CREATE TABLE scan_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES scan_sessions(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL,
    ticket_code VARCHAR(255) NOT NULL,
    qr_code_data TEXT,
    scan_result scan_result NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(255),
    device_id VARCHAR(255),
    operator_id UUID,
    validation_details JSONB DEFAULT '{}',
    error_message TEXT,
    processing_time_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan operators table
CREATE TABLE scan_operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    access_code VARCHAR(255) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Validation rules table
CREATE TABLE validation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    rule_type validation_rule_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Offline cache table (for offline validation)
CREATE TABLE offline_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    ticket_code VARCHAR(255) NOT NULL,
    event_id UUID NOT NULL,
    qr_code_data TEXT NOT NULL,
    validation_status VARCHAR(50) DEFAULT 'valid',
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticket_id, ticket_code)
);

-- Scan statistics table (aggregated data)
CREATE TABLE scan_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    stat_date DATE NOT NULL,
    total_scans INTEGER DEFAULT 0,
    valid_scans INTEGER DEFAULT 0,
    invalid_scans INTEGER DEFAULT 0,
    unique_tickets INTEGER DEFAULT 0,
    scan_sessions INTEGER DEFAULT 0,
    peak_hour INTEGER,
    peak_location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, stat_date)
);

-- Validation attempts table (for retry and audit)
CREATE TABLE validation_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_log_id UUID REFERENCES scan_logs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    validation_result scan_result NOT NULL,
    processing_time_ms INTEGER,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan locations table
CREATE TABLE scan_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinates JSONB,
    is_active BOOLEAN DEFAULT true,
    max_concurrent_scanners INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Device registrations table
CREATE TABLE device_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    device_type VARCHAR(100),
    operator_id UUID,
    event_id UUID,
    location_id UUID REFERENCES scan_locations(id),
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    registration_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan audit log table
CREATE TABLE scan_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    user_id UUID,
    session_id UUID REFERENCES scan_sessions(id),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_scan_sessions_event_id ON scan_sessions(event_id);
CREATE INDEX idx_scan_sessions_operator_id ON scan_sessions(operator_id);
CREATE INDEX idx_scan_sessions_device_id ON scan_sessions(device_id);
CREATE INDEX idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX idx_scan_sessions_started_at ON scan_sessions(started_at);

CREATE INDEX idx_scan_logs_session_id ON scan_logs(session_id);
CREATE INDEX idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX idx_scan_logs_ticket_code ON scan_logs(ticket_code);
CREATE INDEX idx_scan_logs_scan_result ON scan_logs(scan_result);
CREATE INDEX idx_scan_logs_scanned_at ON scan_logs(scanned_at);
CREATE INDEX idx_scan_logs_device_id ON scan_logs(device_id);
CREATE INDEX idx_scan_logs_operator_id ON scan_logs(operator_id);

CREATE INDEX idx_scan_operators_user_id ON scan_operators(user_id);
CREATE INDEX idx_scan_operators_event_id ON scan_operators(event_id);
CREATE INDEX idx_scan_operators_access_code ON scan_operators(access_code);
CREATE INDEX idx_scan_operators_active ON scan_operators(is_active);

CREATE INDEX idx_validation_rules_event_id ON validation_rules(event_id);
CREATE INDEX idx_validation_rules_type ON validation_rules(rule_type);
CREATE INDEX idx_validation_rules_active ON validation_rules(is_active);
CREATE INDEX idx_validation_rules_priority ON validation_rules(priority);

CREATE INDEX idx_offline_cache_ticket_id ON offline_cache(ticket_id);
CREATE INDEX idx_offline_cache_event_id ON offline_cache(event_id);
CREATE INDEX idx_offline_cache_expires_at ON offline_cache(expires_at);
CREATE INDEX idx_offline_cache_sync_status ON offline_cache(sync_status);
CREATE INDEX idx_offline_cache_cached_at ON offline_cache(cached_at);

CREATE INDEX idx_scan_statistics_event_id ON scan_statistics(event_id);
CREATE INDEX idx_scan_statistics_date ON scan_statistics(stat_date);
CREATE INDEX idx_scan_statistics_total_scans ON scan_statistics(total_scans);

CREATE INDEX idx_validation_attempts_scan_log_id ON validation_attempts(scan_log_id);
CREATE INDEX idx_validation_attempts_result ON validation_attempts(validation_result);

CREATE INDEX idx_scan_locations_event_id ON scan_locations(event_id);
CREATE INDEX idx_scan_locations_active ON scan_locations(is_active);

CREATE INDEX idx_device_registrations_device_id ON device_registrations(device_id);
CREATE INDEX idx_device_registrations_operator_id ON device_registrations(operator_id);
CREATE INDEX idx_device_registrations_event_id ON device_registrations(event_id);
CREATE INDEX idx_device_registrations_active ON device_registrations(is_active);
CREATE INDEX idx_device_registrations_last_seen ON device_registrations(last_seen_at);

CREATE INDEX idx_scan_audit_logs_action ON scan_audit_logs(action);
CREATE INDEX idx_scan_audit_logs_resource_type ON scan_audit_logs(resource_type);
CREATE INDEX idx_scan_audit_logs_user_id ON scan_audit_logs(user_id);
CREATE INDEX idx_scan_audit_logs_session_id ON scan_audit_logs(session_id);
CREATE INDEX idx_scan_audit_logs_created_at ON scan_audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_scan_sessions_updated_at BEFORE UPDATE ON scan_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_operators_updated_at BEFORE UPDATE ON scan_operators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_rules_updated_at BEFORE UPDATE ON validation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offline_cache_updated_at BEFORE UPDATE ON offline_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_statistics_updated_at BEFORE UPDATE ON scan_statistics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_locations_updated_at BEFORE UPDATE ON scan_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_registrations_updated_at BEFORE UPDATE ON device_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default validation rules
INSERT INTO validation_rules (event_id, rule_type, name, description, parameters, priority) VALUES
('00000000-0000-0000-0000-000000000000', 'time_window', 'Event Time Window', 'Only allow scans during event hours', '{"start_time": "09:00", "end_time": "22:00", "timezone": "UTC"}', 1),
('00000000-0000-0000-0000-000000000000', 'location_based', 'Location Validation', 'Validate scan location matches event location', '{"allowed_locations": ["Entrance", "Main Hall"], "max_distance_meters": 100}', 2),
('00000000-0000-0000-0000-000000000000', 'ticket_type', 'Ticket Type Access', 'Check if ticket type allows access to current area', '{"restricted_areas": {"VIP": ["VIP Lounge", "Backstage"], "Standard": ["Main Hall"]}}', 3),
('00000000-0000-0000-0000-000000000000', 'event_access', 'Event Access Control', 'Basic event access validation', '{"require_active_event": true, "check_event_status": true}', 4);

-- Create view for scan session summary
CREATE VIEW scan_session_summary AS
SELECT 
    ss.id,
    ss.event_id,
    ss.device_id,
    ss.location,
    ss.status,
    ss.started_at,
    ss.ended_at,
    ss.total_scans,
    ss.valid_scans,
    ss.invalid_scans,
    CASE 
        WHEN ss.total_scans > 0 THEN ROUND((ss.valid_scans::FLOAT / ss.total_scans) * 100, 2)
        ELSE 0
    END as success_rate,
    so.user_id as operator_id,
    so.access_code as operator_access_code
FROM scan_sessions ss
LEFT JOIN scan_operators so ON ss.operator_id = so.id;

-- Create view for daily scan statistics
CREATE VIEW daily_scan_stats AS
SELECT 
    DATE(sl.scanned_at) as scan_date,
    sl.event_id,
    COUNT(*) as total_scans,
    COUNT(CASE WHEN sl.scan_result = 'valid' THEN 1 END) as valid_scans,
    COUNT(CASE WHEN sl.scan_result = 'invalid' THEN 1 END) as invalid_scans,
    COUNT(CASE WHEN sl.scan_result = 'already_used' THEN 1 END) as duplicate_scans,
    COUNT(DISTINCT sl.ticket_id) as unique_tickets,
    COUNT(DISTINCT sl.session_id) as active_sessions,
    COUNT(DISTINCT sl.device_id) as active_devices
FROM scan_logs sl
GROUP BY DATE(sl.scanned_at), sl.event_id
ORDER BY scan_date DESC, total_scans DESC;

-- Create view for operator performance
CREATE VIEW operator_performance AS
SELECT 
    so.user_id,
    so.event_id,
    COUNT(ss.id) as total_sessions,
    SUM(ss.total_scans) as total_scans,
    SUM(ss.valid_scans) as valid_scans,
    SUM(ss.invalid_scans) as invalid_scans,
    CASE 
        WHEN SUM(ss.total_scans) > 0 THEN ROUND((SUM(ss.valid_scans)::FLOAT / SUM(ss.total_scans)) * 100, 2)
        ELSE 0
    END as success_rate,
    AVG(ss.total_scans) as avg_scans_per_session,
    MAX(ss.total_scans) as max_scans_in_session
FROM scan_operators so
LEFT JOIN scan_sessions ss ON so.id = ss.operator_id
GROUP BY so.user_id, so.event_id;

-- Create function to generate scan statistics
CREATE OR REPLACE FUNCTION update_scan_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO scan_statistics (event_id, stat_date, total_scans, valid_scans, invalid_scans, unique_tickets, scan_sessions)
    VALUES (
        NEW.event_id,
        DATE(NEW.scanned_at),
        1,
        CASE WHEN NEW.scan_result = 'valid' THEN 1 ELSE 0 END,
        CASE WHEN NEW.scan_result != 'valid' THEN 1 ELSE 0 END,
        1,
        1
    )
    ON CONFLICT (event_id, stat_date) DO UPDATE SET
        total_scans = scan_statistics.total_scans + 1,
        valid_scans = scan_statistics.valid_scans + CASE WHEN NEW.scan_result = 'valid' THEN 1 ELSE 0 END,
        invalid_scans = scan_statistics.invalid_scans + CASE WHEN NEW.scan_result != 'valid' THEN 1 ELSE 0 END,
        unique_tickets = scan_statistics.unique_tickets + 1,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update statistics on scan
CREATE TRIGGER update_scan_statistics_trigger
    AFTER INSERT ON scan_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_statistics();

-- Create function to clean up old offline cache entries
CREATE OR REPLACE FUNCTION cleanup_offline_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM offline_cache 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate access codes for operators
CREATE OR REPLACE FUNCTION generate_operator_access_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    attempts INTEGER := 0;
    max_attempts INTEGER := 10;
BEGIN
    WHILE attempts < max_attempts LOOP
        code := 'SCAN-' || UPPER(substring(md5(random()::text), 1, 8));
        
        IF NOT EXISTS (SELECT 1 FROM scan_operators WHERE access_code = code) THEN
            RETURN code;
        END IF;
        
        attempts := attempts + 1;
    END LOOP;
    
    RAISE EXCEPTION 'Failed to generate unique access code after % attempts', max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate access codes
CREATE OR REPLACE FUNCTION set_operator_access_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
        NEW.access_code := generate_operator_access_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER operator_set_access_code BEFORE INSERT ON scan_operators
    FOR EACH ROW EXECUTE FUNCTION set_operator_access_code();
