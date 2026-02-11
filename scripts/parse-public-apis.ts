
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ApiEntry {
    id: string;
    name: string;
    url: string;
    category: string;
    description: string;
    authType: string;
    https: boolean;
    cors: string;
    source: string;
    lastUpdated: string;
    protocols?: string[];
}

interface ApiRegistry {
    version: string;
    lastUpdated: string;
    source: string;
    entries: ApiEntry[];
}

class PublicApiParser {
    private readmePath: string;

    constructor(readmePath: string) {
        this.readmePath = readmePath;
    }

    parse(): ApiRegistry {
        const content = readFileSync(this.readmePath, 'utf-8');
        const lines = content.split('\n');
        const entries: ApiEntry[] = [];
        let currentCategory = '';

        // Regex for markdown table row
        // | Name | Description | Auth | HTTPS | CORS |
        // Name can be [Name](url) or just Name
        const rowRegex = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect Category Header (### Category)
            if (line.startsWith('### ')) {
                currentCategory = line.substring(4).trim();
                continue;
            }

            // Skip table structure lines
            if (line.startsWith('|---')) continue;
            if (line.startsWith('API | Description')) continue;

            // Parse Table Row
            const match = line.match(rowRegex);
            if (match && currentCategory) {
                const [_, nameCol, descCol, authCol, httpsCol, corsCol] = match;

                // Extract Name and URL
                const linkMatch = nameCol.match(/\[(.*?)\]\((.*?)\)/);
                const name = linkMatch ? linkMatch[1] : nameCol;
                const url = linkMatch ? linkMatch[2] : '';

                if (!name || !url) continue;

                // Auth normalization
                let authType = authCol.trim();
                if (authType.toLowerCase() === 'no') authType = 'none';
                if (authType.includes('apiKey')) authType = 'apiKey';
                if (authType.includes('OAuth')) authType = 'OAuth';

                // HTTPS normalization
                const https = httpsCol.toLowerCase() === 'yes';

                // CORS normalization
                const cors = corsCol.trim().toLowerCase();

                const id = this.slugify(name);

                entries.push({
                    id,
                    name: name.trim(),
                    url: url.trim(),
                    category: currentCategory,
                    description: descCol.trim(),
                    authType,
                    https,
                    cors,
                    source: 'public-apis',
                    lastUpdated: new Date().toISOString(),
                    protocols: ['REST'] // Default assumption
                });
            }
        }

        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            source: 'public-apis',
            entries
        };
    }

    private slugify(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')     // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-')   // Replace multiple - with single -
            .replace(/^-+/, '')       // Trim - from start of text
            .replace(/-+$/, '');      // Trim - from end of text
    }
}

async function main() {
    console.log('🔍 Parsing Public APIs catalog...\n');

    const readmePath = join(process.cwd(), '.data', 'public_api', 'README.md');
    const outputPath = join(process.cwd(), 'data', 'api-registry.json');

    try {
        const parser = new PublicApiParser(readmePath);
        const registry = parser.parse();

        // Write registry
        writeFileSync(outputPath, JSON.stringify(registry, null, 2));

        // Statistics
        const categories = new Set(registry.entries.map(e => e.category));

        console.log('✅ Registry generated successfully!\n');
        console.log(`📊 Statistics:`);
        console.log(`   Total APIs: ${registry.entries.length}`);
        console.log(`   Categories: ${categories.size}`);
        console.log(`\n📁 Output: ${outputPath}`);

    } catch (error) {
        console.error('❌ Error parsing registry:', error);
        process.exit(1);
    }
}

main();
