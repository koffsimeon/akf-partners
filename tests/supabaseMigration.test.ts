import fs from 'fs';
import path from 'path';

/**
 * Suite de tests automatisés : Vérification de l'intégrité du schéma Supabase PostgreSQL
 */
async function runSupabaseMigrationTests() {
  console.log('========================================================');
  console.log('🧪 DÉMARRAGE DES TESTS : MIGRATIONS SUPABASE & RLS');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ SUCCÈS : ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ ÉCHEC : ${testName}`);
      if (details) console.error(`    Détail : ${details}`);
      failed++;
    }
  }

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261104_init_akf_partners.sql');
  const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql');

  assert(fs.existsSync(migrationPath), '1. Le fichier de migration SQL existe');
  assert(fs.existsSync(seedPath), '2. Le fichier de seed SQL existe');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');

  // 3. Vérification des 9 tables obligatoires
  const expectedTables = [
    'public.profiles',
    'public.waves',
    'public.rank_thresholds',
    'public.products',
    'public.partners',
    'public.clients',
    'public.orders',
    'public.payments',
    'public.audit_logs',
  ];

  for (const table of expectedTables) {
    assert(
      migrationSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Table obligatoire présente : ${table}`
    );
  }

  // 4. Vérification de l'activation RLS sur les 9 tables
  for (const table of expectedTables) {
    assert(
      migrationSql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
      `RLS activé sur ${table}`
    );
  }

  // 5. Vérification des rôles RBAC (CONSULTATION, OPERATIONS, FINANCE, ADMIN, SUPER_ADMIN)
  const roles = ['CONSULTATION', 'OPERATIONS', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'];
  const allRolesPresent = roles.every((r) => migrationSql.includes(`'${r}'`));
  assert(allRolesPresent, '5 rôles RBAC configurés dans le type user_role');

  // 6. Vérification de la contrainte de paiement minimum (5 000 FCFA)
  assert(
    migrationSql.includes('CHECK (amount >= 5000)'),
    'Contrainte métier respectée : Minimum paiement >= 5 000 FCFA'
  );

  // 7. Vérification du produit Atō’lèçé et du calcul forfaitaire dans le seed
  assert(
    seedSql.includes('PRD-ATOLECE') && seedSql.includes('Forfaitaire') && seedSql.includes('150'),
    'Produit Atō’lèçé avec commission forfaitaire de 150 FCFA présent dans le seed'
  );

  // 8. Vérification des seuils Vague 1 dans le seed
  assert(
    seedSql.includes('Ambassador') && seedSql.includes('100000') && seedSql.includes('Excellence') && seedSql.includes('300000'),
    'Seuils officiels Vague 1 configurés dans le seed'
  );

  console.log('\n========================================================');
  console.log(`📊 RÉSULTAT : ${passed} test(s) réussi(s), ${failed} échec(s)`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runSupabaseMigrationTests().catch((err) => {
  console.error('Erreur inattendue dans le test:', err);
  process.exit(1);
});
