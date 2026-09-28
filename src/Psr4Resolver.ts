import * as vscode from 'vscode';
import * as path from 'path';

export class Psr4Resolver {
    private mappings: { [dir: string]: string } = {};
    private rootPath: string = '';

    public async load(workspaceUri: vscode.Uri): Promise<void> {
        this.rootPath = workspaceUri.fsPath;
        const composerUri = vscode.Uri.file(path.join(this.rootPath, 'composer.json'));

        try {
            const content = await vscode.workspace.fs.readFile(composerUri);
            const json = JSON.parse(Buffer.from(content).toString('utf8'));
            
            const psr4 = {
                ...(json['autoload']?.['psr-4'] || {}),
                ...(json['autoload-dev']?.['psr-4'] || {})
            };

            this.mappings = {};
            for (const [prefix, dir] of Object.entries(psr4)) {
                const normalizedDir = Array.isArray(dir) ? dir[0] : dir;
                const cleanDir = normalizedDir.replace(/\\/g, '/').replace(/\/$/, '');
                this.mappings[cleanDir] = prefix;
            }
        } catch {
            this.mappings = {};
        }
    }

    public resolveNamespace(filePath: string): string | null {
        const relativePath = path.relative(this.rootPath, filePath);
        const dirPath = path.dirname(relativePath).replace(/\\/g, '/');

        for (const [dir, namespace] of Object.entries(this.mappings)) {
            if (dirPath === dir || dirPath.startsWith(dir + '/')) {
                const remainder = dirPath.substring(dir.length).replace(/^\//, '');
                let finalNamespace = namespace;
                if (remainder) {
                    finalNamespace += remainder.replace(/\//g, '\\') + '\\';
                }
                return finalNamespace.replace(/\\\\/g, '\\').replace(/\\$/, '');
            }
        }

        return this.guessNamespace(dirPath);
    }

    private guessNamespace(dirPath: string): string {
        const parts = dirPath.split('/').filter(Boolean);
        if (parts.length > 1 && ['src', 'app', 'lib'].includes(parts[0].toLowerCase())) {
            parts.shift();
        }

        return parts
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('\\');
    }

    public getFqcn(filePath: string, className: string): string {
        const ns = this.resolveNamespace(filePath);
        return ns ? `${ns}\\${className}` : className;
    }
}