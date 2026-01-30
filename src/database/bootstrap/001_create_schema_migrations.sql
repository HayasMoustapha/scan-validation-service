-- Création de la table schema_migrations pour le suivi des migrations
-- Cette table est utilisée par le système de bootstrap pour suivre les migrations appliquées

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    checksum VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches de migrations
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schema_migrations_updated_at 
    BEFORE UPDATE ON schema_migrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE schema_migrations IS 'Table de suivi des migrations de base de données pour le Scan Validation Service';
COMMENT ON COLUMN schema_migrations.migration_name IS 'Nom du fichier de migration';
COMMENT ON COLUMN schema_migrations.checksum IS 'Checksum SHA256 du fichier de migration';
COMMENT ON COLUMN schema_migrations.file_size IS 'Taille du fichier de migration en octets';
COMMENT ON COLUMN schema_migrations.execution_time_ms IS 'Temps d''exécution de la migration en millisecondes';
