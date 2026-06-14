import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const dbPath = resolve(process.cwd(), 'dev.db');
const db = new Database(dbPath);

console.log('Cleaning shelfmind application tables...');

db.run('DELETE FROM duplicate_pairs');
db.run('DELETE FROM imdb_records');
db.run('DELETE FROM jobs');

console.log('Database cleaned successfully! Auth and organizations are preserved.');
