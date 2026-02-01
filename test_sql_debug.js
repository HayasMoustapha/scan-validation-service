#!/usr/bin/env node

// Test direct depuis le répertoire scan-validation-service
const { Pool } = require('pg');

async function testDirectSQL() {
  console.log('🔍 TEST SQL DIRECT: Vérification colonnes scan_logs');
  console.log('==================================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/event_planner_scan_validation'
  });

  try {
    // Test 1: Vérifier la structure de la table scan_logs
    console.log('\n📋 Structure table scan_logs:');
    const structureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scan_logs' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Test 2: Vérifier la structure de la table scan_sessions
    console.log('\n📋 Structure table scan_sessions:');
    const sessionsStructureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scan_sessions' 
      ORDER BY ordinal_position
    `;
    
    const sessionsResult = await pool.query(sessionsStructureQuery);
    sessionsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Test 3: Tester la requête getTicketLogs directement
    console.log('\n🎯 Test requête getTicketLogs:');
    const testQuery = `
      SELECT 
        sl.id,
        sl.uid,
        sl.scan_session_id,
        sl.ticket_id,
        sl.result,
        sl.scanned_at,
        sl.ticket_data,
        sl.validation_details,
        sl.fraud_flags,
        sl.location,
        sl.device_id,
        sl.created_by,
        sl.created_at,
        ss.uid as session_uid
      FROM scan_logs sl
      LEFT JOIN scan_sessions ss ON sl.scan_session_id = ss.id
      WHERE sl.ticket_id = $1
      ORDER BY sl.scanned_at DESC
      LIMIT 100
    `;

    const testResult = await pool.query(testQuery, [8426]);
    console.log('✅ Requête exécutée avec succès');
    console.log('Nombre de résultats:', testResult.rows.length);

    // Test 4: Insérer un log de test pour voir si l'insertion fonctionne
    console.log('\n➕ Test insertion log:');
    const insertQuery = `
      INSERT INTO scan_logs (
        uid, scan_session_id, scanned_at, result, location, device_id,
        ticket_id, ticket_data, validation_details, fraud_flags, created_by
      ) VALUES (
        gen_random_uuid(), NULL, NOW(), 'valid', 'Test Location', 'Test Device',
        8426, '{}', '{}', '[]', 1
      ) RETURNING id, uid, scanned_at, result, ticket_id
    `;

    const insertResult = await pool.query(insertQuery);
    console.log('✅ Insertion réussie');
    console.log('Log ID:', insertResult.rows[0].id);

    // Test 5: Tester la requête getTicketLogs après insertion
    console.log('\n🎯 Test requête getTicketLogs après insertion:');
    const finalResult = await pool.query(testQuery, [8426]);
    console.log('✅ Requête exécutée avec succès');
    console.log('Nombre de résultats:', finalResult.rows.length);
    
    if (finalResult.rows.length > 0) {
      console.log('Premier résultat:');
      const row = finalResult.rows[0];
      console.log(`  ID: ${row.id}`);
      console.log(`  Ticket ID: ${row.ticket_id}`);
      console.log(`  Result: ${row.result}`);
      console.log(`  Scan Time: ${row.scanned_at}`);
    }

  } catch (error) {
    console.error('❌ Erreur SQL:', error.message);
    console.error('Détails:', error.detail);
  } finally {
    await pool.end();
  }
}

testDirectSQL();
