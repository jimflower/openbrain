// Test script for Open Brain server
import db from './db.js';
import { generateEmbedding, testEmbeddingService } from './embeddings.js';
import { extractMetadata, testMetadataService } from './metadata.js';

console.log('🧠 Testing Open Brain Server Components\n');

async function runTests() {
  let allPassed = true;

  // Test 1: Database Connection
  console.log('Test 1: Database Connection');
  try {
    const dbTest = await db.testConnection();
    if (dbTest.success) {
      console.log('  ✓ Database connected');
      console.log(`    Timestamp: ${dbTest.timestamp}`);
    } else {
      console.log('  ✗ Database connection failed:', dbTest.error);
      allPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Database test error:', error.message);
    allPassed = false;
  }
  console.log();

  // Test 2: Embedding Service
  console.log('Test 2: Embedding Service');
  try {
    const embeddingTest = await testEmbeddingService();
    if (embeddingTest.success) {
      console.log('  ✓ Embeddings working');
      console.log(`    Mode: ${embeddingTest.mode}`);
      console.log(`    Model: ${embeddingTest.model}`);
      console.log(`    Dimensions: ${embeddingTest.dimensions}`);
    } else {
      console.log('  ✗ Embedding test failed:', embeddingTest.error);
      allPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Embedding test error:', error.message);
    allPassed = false;
  }
  console.log();

  // Test 3: Metadata Extraction
  console.log('Test 3: Metadata Extraction');
  try {
    const metadataTest = await testMetadataService();
    if (metadataTest.success) {
      console.log('  ✓ Metadata extraction working');
      console.log(`    Mode: ${metadataTest.mode}`);
      console.log(`    Model: ${metadataTest.model}`);
      console.log('    Sample metadata:', JSON.stringify(metadataTest.metadata, null, 2));
    } else {
      console.log('  ✗ Metadata test failed:', metadataTest.error);
      allPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Metadata test error:', error.message);
    allPassed = false;
  }
  console.log();

  // Test 4: Full Capture Flow
  console.log('Test 4: Full Capture Flow');
  try {
    const testContent = 'This is a test thought to verify the capture pipeline works correctly.';
    
    const embedding = await generateEmbedding(testContent);
    const metadata = await extractMetadata(testContent);
    const thought = await db.storeThought(testContent, embedding, metadata);
    
    console.log('  ✓ Thought captured successfully');
    console.log(`    ID: ${thought.id}`);
    console.log(`    Content: ${thought.content}`);
    console.log(`    Metadata: ${JSON.stringify(thought.metadata)}`);
  } catch (error) {
    console.log('  ✗ Capture flow failed:', error.message);
    allPassed = false;
  }
  console.log();

  // Test 5: Search
  console.log('Test 5: Semantic Search');
  try {
    const queryEmbedding = await generateEmbedding('test');
    const results = await db.searchThoughts(queryEmbedding, 0.1, 5);
    
    console.log('  ✓ Search completed');
    console.log(`    Found ${results.length} results`);
    if (results.length > 0) {
      console.log(`    Top result similarity: ${(results[0].similarity * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.log('  ✗ Search failed:', error.message);
    allPassed = false;
  }
  console.log();

  // Test 6: Stats
  console.log('Test 6: Statistics');
  try {
    const stats = await db.getStats();
    console.log('  ✓ Stats retrieved');
    console.log(`    Total thoughts: ${stats.total_thoughts || 0}`);
    console.log(`    This week: ${stats.this_week || 0}`);
    console.log(`    This month: ${stats.this_month || 0}`);
  } catch (error) {
    console.log('  ✗ Stats failed:', error.message);
    allPassed = false;
  }
  console.log();

  // Summary
  console.log('========================================');
  if (allPassed) {
    console.log('✓ All tests passed!');
    console.log('\nYour Open Brain is ready to use.');
    console.log('\nNext steps:');
    console.log('  1. Start the API server: npm start');
    console.log('  2. Start the MCP server: npm run mcp');
    console.log('  3. Test the CLI: brain test');
  } else {
    console.log('✗ Some tests failed');
    console.log('\nCheck the errors above and fix configuration issues.');
    console.log('Common issues:');
    console.log('  - Database: Check DATABASE_URL in .env');
    console.log('  - Embeddings: Make sure Ollama is running');
    console.log('  - Metadata: Check API keys or Ollama models');
  }
  console.log('========================================');

  // Close database connection
  await db.closePool();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
