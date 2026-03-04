#!/usr/bin/env node

// Open Brain CLI Tool
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config file location
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'open-brain');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default config
const DEFAULT_CONFIG = {
  server: 'http://localhost:3000',
  key: '',
};

/**
 * Load configuration
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading config:', error.message);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save configuration
 */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error.message);
    return false;
  }
}

/**
 * Make API request
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const config = loadConfig();
  const url = `${config.server}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (config.key) {
    options.headers['Authorization'] = `Bearer ${config.key}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server at', config.server);
      console.error('   Make sure the API server is running: npm start');
    } else {
      console.error('❌ Request failed:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Command: config
 */
async function configCommand(args) {
  const config = loadConfig();
  
  // Parse arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (flag === '--server') {
      config.server = value;
    } else if (flag === '--key') {
      config.key = value;
    }
  }
  
  if (saveConfig(config)) {
    console.log('✓ Configuration saved');
    console.log('  Server:', config.server);
    console.log('  Key:', config.key ? '***' + config.key.slice(-4) : 'not set');
  } else {
    console.error('❌ Failed to save configuration');
    process.exit(1);
  }
}

/**
 * Command: add (capture)
 */
async function addCommand(content) {
  if (!content) {
    console.error('Usage: brain add "your thought here"');
    process.exit(1);
  }
  
  console.log('Capturing...');
  const result = await apiRequest('/capture', 'POST', { content });
  
  if (result.success) {
    console.log('✓ Captured');
    console.log();
    console.log(`"${result.thought.content}"`);
    console.log();
    
    const meta = result.thought.metadata;
    if (meta && Object.keys(meta).length > 0) {
      if (meta.type) console.log(`Type: ${meta.type}`);
      if (meta.tags?.length) console.log(`Tags: ${meta.tags.join(', ')}`);
      if (meta.people?.length) console.log(`People: ${meta.people.join(', ')}`);
      if (meta.action_items?.length) {
        console.log('Action items:');
        meta.action_items.forEach(item => console.log(`  - ${item}`));
      }
    }
    
    console.log();
    console.log(`ID: ${result.thought.id}`);
  }
}

/**
 * Command: search
 */
async function searchCommand(query) {
  if (!query) {
    console.error('Usage: brain search "what to search for"');
    process.exit(1);
  }
  
  console.log('Searching...');
  const result = await apiRequest('/search', 'POST', { query });
  
  if (result.count === 0) {
    console.log(`No results found for "${query}"`);
    console.log('Try using different keywords or lowering the threshold');
  } else {
    console.log(`Found ${result.count} result${result.count === 1 ? '' : 's'}:\n`);
    
    result.results.forEach((thought, idx) => {
      const date = new Date(thought.created_at).toLocaleDateString();
      const similarity = (thought.similarity * 100).toFixed(0);
      
      console.log(`${idx + 1}. [${similarity}% match] ${date}`);
      console.log(`   ${thought.content}`);
      
      if (thought.metadata?.type) {
        console.log(`   [${thought.metadata.type}]`);
      }
      
      console.log();
    });
  }
}

/**
 * Command: recent
 */
async function recentCommand(limitArg) {
  const limit = parseInt(limitArg) || 20;
  
  const result = await apiRequest(`/recent?limit=${limit}`);
  
  if (result.count === 0) {
    console.log('No thoughts captured yet');
    console.log('Use: brain add "your first thought"');
  } else {
    console.log(`Your ${result.count} most recent thought${result.count === 1 ? '' : 's'}:\n`);
    
    result.thoughts.forEach((thought, idx) => {
      const date = new Date(thought.created_at).toLocaleDateString();
      const time = new Date(thought.created_at).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      console.log(`${idx + 1}. ${date} ${time}`);
      console.log(`   ${thought.content}`);
      
      if (thought.metadata?.type) {
        console.log(`   [${thought.metadata.type}]`);
      }
      
      console.log();
    });
  }
}

/**
 * Command: stats
 */
async function statsCommand() {
  const result = await apiRequest('/stats');
  const stats = result.stats;
  
  console.log('📊 Brain Statistics\n');
  console.log(`Total thoughts: ${stats.total_thoughts || 0}`);
  console.log(`This week: ${stats.this_week || 0}`);
  console.log(`This month: ${stats.this_month || 0}`);
  console.log();
  
  if (stats.first_thought) {
    const firstDate = new Date(stats.first_thought).toLocaleDateString();
    console.log(`First thought: ${firstDate}`);
  }
  
  if (stats.latest_thought) {
    const latestDate = new Date(stats.latest_thought).toLocaleDateString();
    const latestTime = new Date(stats.latest_thought).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log(`Latest thought: ${latestDate} ${latestTime}`);
  }
}

/**
 * Command: test
 */
async function testCommand() {
  console.log('Testing Open Brain connection...\n');
  
  const config = loadConfig();
  console.log('Configuration:');
  console.log(`  Server: ${config.server}`);
  console.log(`  Key: ${config.key ? '***' + config.key.slice(-4) : 'not set'}`);
  console.log();
  
  const result = await apiRequest('/test');
  
  console.log('Service Status:');
  console.log(`  Database: ${result.services.database.success ? '✓' : '✗'}`);
  console.log(`  Embeddings: ${result.services.embeddings.success ? '✓' : '✗'} (${result.services.embeddings.mode})`);
  console.log(`  Metadata: ${result.services.metadata.success ? '✓' : '✗'} (${result.services.metadata.mode})`);
  console.log();
  
  if (result.status === 'ok') {
    console.log('✓ All systems operational');
  } else {
    console.log('✗ Some services have issues');
    if (!result.services.database.success) {
      console.log('  Database:', result.services.database.error);
    }
    if (!result.services.embeddings.success) {
      console.log('  Embeddings:', result.services.embeddings.error);
    }
    if (!result.services.metadata.success) {
      console.log('  Metadata:', result.services.metadata.error);
    }
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Open Brain CLI

Usage:
  brain config --server URL --key KEY   Configure server connection
  brain add "your thought"              Capture a new thought
  brain search "query"                  Search your brain
  brain recent [limit]                  Show recent thoughts (default: 20)
  brain stats                           Show statistics
  brain test                            Test connection and services
  brain help                            Show this help

Examples:
  brain add "Met with Sarah about Q2 roadmap"
  brain search "roadmap"
  brain recent 10

Configuration:
  Config file: ${CONFIG_FILE}
  
  First-time setup:
    brain config --server http://your-server:3000 --key your-access-key
`);
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }
  
  switch (command) {
    case 'config':
      await configCommand(args.slice(1));
      break;
    
    case 'add':
    case 'capture':
      await addCommand(args.slice(1).join(' '));
      break;
    
    case 'search':
    case 'find':
      await searchCommand(args.slice(1).join(' '));
      break;
    
    case 'recent':
    case 'list':
      await recentCommand(args[1]);
      break;
    
    case 'stats':
    case 'status':
      await statsCommand();
      break;
    
    case 'test':
      await testCommand();
      break;
    
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "brain help" for usage information');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
