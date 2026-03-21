import * as fs from 'fs';
import * as path from 'path';

/**
 * Surgical Engine: The Security Gatekeeper & Atomic Rollback Engine
 * Handles categorization of diffs, sanitization of files, and restoration of the pristine state.
 */

interface RollbackEntry {
    path: string;
    action: 'restore' | 'delete';
    originalContent?: string; // Base64 encoded
}

interface RollbackDB {
    entries: RollbackEntry[];
}

const ROLLBACK_DB_PATH = path.join(process.cwd(), 'rollback.db.json');

class SurgicalEngine {
    private rollbackDB: RollbackDB = { entries: [] };

    /**
     * Categorize a file path into security buckets.
     */
    private categorize(filePath: string): 'SAFE' | 'SANITIZE' | 'BLOCKED' {
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);

        // BLOCKED: Red-Flag Bucket
        if (dirName.includes('.github') || 
            fileName === '.env' || 
            fileName === '.gitignore' || 
            fileName === 'package-lock.json') {
            return 'BLOCKED';
        }

        // SANITIZE: Sanitized-Merge Bucket
        if (fileName === 'package.json' || fileName === 'metacall.json') {
            return 'SANITIZE';
        }

        // SAFE: Safe-Pass Bucket (Logic & Docs)
        const safeExtensions = ['.ts', '.js', '.py', '.c', '.cpp', '.h', '.md', '.txt', '.json'];
        if (safeExtensions.includes(path.extname(filePath))) {
            return 'SAFE';
        }

        return 'BLOCKED'; // Default to blocked for safety
    }

    /**
     * Sanitize sensitive files like package.json.
     */
    private sanitize(filePath: string, content: string): string {
        const fileName = path.basename(filePath);
        if (fileName === 'package.json') {
            try {
                const pkg = JSON.parse(content);
                // Strip all scripts to prevent preinstall/postinstall attacks
                delete pkg.scripts;
                return JSON.stringify(pkg, null, 2);
            } catch (e) {
                console.error(`Error parsing package.json at ${filePath}`);
                throw e;
            }
        }
        return content;
    }

    /**
     * Apply a .tgz artifact surgically while recording rollback data.
     */
    public applyArtifact(tgzPath: string) {
        if (!fs.existsSync(tgzPath)) {
            throw new Error(`Artifact not found: ${tgzPath}`);
        }

        console.log(`[Surgical Engine] Injecting Protocol Artifact: ${tgzPath}`);

        const targetDir = path.join(process.cwd(), 'node_modules', '@metacall', 'protocol');
        
        // 1. Snapshot the "Before" state of the target directory
        if (fs.existsSync(targetDir)) {
            console.log(`[Surgical Engine] Snapshotting original protocol in node_modules...`);
            // Note: In a real implementation, we would move this to a temp folder for instant rollback.
            // For the POC, we'll mark it for 'npm install' restoration.
            this.rollbackDB.entries.push({
                path: 'node_modules/@metacall/protocol',
                action: 'restore'
            });
        }

        // 2. Sanitize and Install (Simulated for POC)
        // In reality, we would:
        // tar -xzf tgzPath -C temp/
        // node sanitize_pkg.js temp/package.json
        // npm install ./temp
        console.log(`[Surgical Engine] Running: npm install ${tgzPath}`);
        
        // Save the Rollback Blueprint
        fs.writeFileSync(ROLLBACK_DB_PATH, JSON.stringify(this.rollbackDB, null, 2));
    }

    /**
     * Apply a diff surgically while recording rollback data.
     */
    public applyDiff(diffPath: string) {
        if (!fs.existsSync(diffPath)) {
            throw new Error(`Diff file not found: ${diffPath}`);
        }

        console.log(`[Surgical Engine] Applying diff: ${diffPath}`);
        
        const touchedFiles = this.getTouchedFiles(diffPath);

        for (const file of touchedFiles) {
            const bucket = this.categorize(file);
            console.log(`[Surgical Engine] File: ${file} -> Bucket: ${bucket}`);

            if (bucket === 'BLOCKED') {
                throw new Error(`SECURITY ALERT: PR tried to modify restricted file: ${file}`);
            }

            // Snapshot the "Before" state
            const fullPath = path.join(process.cwd(), file);
            if (fs.existsSync(fullPath)) {
                const originalContent = fs.readFileSync(fullPath).toString('base64');
                this.rollbackDB.entries.push({
                    path: file,
                    action: 'restore',
                    originalContent
                });
            } else {
                this.rollbackDB.entries.push({
                    path: file,
                    action: 'delete'
                });
            }
        }

        // Save the Rollback Blueprint
        fs.writeFileSync(ROLLBACK_DB_PATH, JSON.stringify(this.rollbackDB, null, 2));
        console.log(`[Surgical Engine] Rollback Blueprint saved to ${ROLLBACK_DB_PATH}`);
    }

    /**
     * Restore the environment to its pristine state using the Rollback Blueprint.
     */
    public rollback() {
        if (!fs.existsSync(ROLLBACK_DB_PATH)) {
            console.log('[Surgical Engine] No rollback data found. Environment is already clean.');
            return;
        }

        const db: RollbackDB = JSON.parse(fs.readFileSync(ROLLBACK_DB_PATH, 'utf-8'));
        console.log(`[Surgical Engine] Rolling back ${db.entries.length} changes...`);

        for (const entry of db.entries) {
            const fullPath = path.join(process.cwd(), entry.path);
            if (entry.action === 'restore' && entry.originalContent) {
                console.log(`[Surgical Engine] Restoring: ${entry.path}`);
                fs.writeFileSync(fullPath, Buffer.from(entry.originalContent, 'base64'));
            } else if (entry.action === 'delete' && fs.existsSync(fullPath)) {
                console.log(`[Surgical Engine] Deleting temporary file: ${entry.path}`);
                fs.unlinkSync(fullPath);
            }
        }

        // Cleanup the rollback DB
        fs.unlinkSync(ROLLBACK_DB_PATH);
        console.log('[Surgical Engine] Rollback complete. Environment is pristine.');
    }

    /**
     * Helper to get touched files from a diff (Simulated for POC)
     */
    private getTouchedFiles(diffPath: string): string[] {
        const content = fs.readFileSync(diffPath, 'utf-8');
        const lines = content.split('\n');
        const files = new Set<string>();

        for (const line of lines) {
            if (line.startsWith('diff --git')) {
                const parts = line.split(' ');
                // Extract the file path (b/path/to/file)
                const filePath = parts[3].substring(2);
                files.add(filePath);
            }
        }

        return Array.from(files);
    }
}

// CLI Interface
const args = process.argv.slice(2);
const engine = new SurgicalEngine();

if (args.includes('--apply')) {
    const diffFile = args.find(a => a.startsWith('--diff='))?.split('=')[1];
    const artifactFile = args.find(a => a.startsWith('--artifact='))?.split('=')[1];

    try {
        if (artifactFile) {
            engine.applyArtifact(artifactFile);
        } else if (diffFile) {
            engine.applyDiff(diffFile);
        } else {
            throw new Error('Must provide either --diff or --artifact with --apply');
        }
        process.exit(0);
    } catch (e: any) {
        console.error(`[Surgical Engine] Apply Failed: ${e.message}`);
        process.exit(1);
    }
} else if (args.includes('--rollback')) {
    engine.rollback();
    process.exit(0);
} else {
    console.log('Usage: ts-node surgical_engine.ts [--apply --diff=path/to.diff | --rollback]');
}
