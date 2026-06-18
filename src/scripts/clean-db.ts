import Database from 'better-sqlite3';
import { resolve } from 'path';

const dbPath = resolve(process.cwd(), 'dev.db');
const db = new Database(dbPath);

console.log('Cleaning shelfmind application tables...');

db.prepare('DELETE FROM duplicate_pairs').run();
db.prepare('DELETE FROM imdb_records').run();
db.prepare('DELETE FROM jobs').run();

console.log('Database cleaned successfully! Auth and organizations are preserved.');
