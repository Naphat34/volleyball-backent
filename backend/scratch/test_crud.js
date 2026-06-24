// Set environment variables before any imports
process.env.DATABASE_URL = 'postgres://postgres:vb11421@localhost:5432/volleyball_db';

const { Client } = require('pg');
const matchController = require('../controllers/matchController');

const client = new Client({
  connectionString: 'postgres://postgres:vb11421@localhost:5432/volleyball_db',
  ssl: false
});

async function run() {
  try {
    await client.connect();

    // 1. Get a valid competition ID
    const compRes = await client.query('SELECT id FROM competitions LIMIT 1');
    if (compRes.rows.length === 0) {
      console.log('No competitions found in DB. Please create a competition first.');
      return;
    }
    const competitionId = compRes.rows[0].id;
    console.log('Using competition ID:', competitionId);

    // 2. Mock req and res for createMatch
    let responseObj = null;
    let statusVal = null;
    
    const mockRes = {
      status: function(s) { statusVal = s; return this; },
      json: function(data) { responseObj = data; }
    };
    
    const mockReqCreate = {
      body: {
        competition_id: competitionId,
        round_name: 'Test Round',
        match_number: 999,
        pool_name: 'Z',
        gender: 'Male',
        max_sets: 3,
        location: 'Test Stadium',
        city: 'Test City',
        country: 'TH',
        status: 'scheduled',
        rr_name: 'Test RR',
        rr_country: 'Thailand',
        rr_code: 'THA',
        has_challenge: true,
        category: 1,
        live_state: { test: 'live' },
        match_state: { test: 'match' }
      },
      app: {
        get: function(key) { return null; } // mock io
      }
    };
    
    console.log('Testing createMatch...');
    await matchController.createMatch(mockReqCreate, mockRes);
    
    if (statusVal) {
      console.error('Create match failed:', responseObj);
      return;
    }
    
    const createdMatch = responseObj;
    console.log('Successfully created match with ID:', createdMatch.id);
    console.log('Created match fields summary:', {
      id: createdMatch.id,
      competition_id: createdMatch.competition_id,
      match_number: createdMatch.match_number,
      pool_name: createdMatch.pool_name,
      rr_name: createdMatch.rr_name,
      has_challenge: createdMatch.has_challenge,
      live_state: createdMatch.live_state,
      match_state: createdMatch.match_state
    });

    // 3. Test updateMatch
    const mockReqUpdate = {
      params: { id: createdMatch.id },
      body: {
        round_name: 'Updated Test Round',
        match_number: 1000,
        has_challenge: false,
        city: 'Updated City',
        live_state: { test: 'updated_live' }
      },
      app: {
        get: function(key) { return null; }
      }
    };
    
    console.log('Testing updateMatch...');
    responseObj = null;
    statusVal = null;
    await matchController.updateMatch(mockReqUpdate, mockRes);
    
    if (statusVal) {
      console.error('Update match failed:', responseObj);
      return;
    }
    
    console.log('Successfully called updateMatch. Message:', responseObj.message);

    // Verify update in DB
    const verifyRes = await client.query('SELECT * FROM matches WHERE id = $1', [createdMatch.id]);
    const updatedMatch = verifyRes.rows[0];
    console.log('Verified updated fields from DB:', {
      id: updatedMatch.id,
      round_name: updatedMatch.round_name,
      match_number: updatedMatch.match_number,
      has_challenge: updatedMatch.has_challenge,
      city: updatedMatch.city,
      live_state: updatedMatch.live_state
    });

    // 4. Cleanup: Delete test match
    console.log('Cleaning up: deleting test match...');
    await client.query('DELETE FROM matches WHERE id = $1', [createdMatch.id]);
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await client.end();
  }
}

run();
