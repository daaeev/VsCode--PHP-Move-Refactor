import * as vscode from 'vscode';
import { Engine } from 'php-parser';

export interface PhpFileInfo {
    namespace: { name: string, range: vscode.Range } | null;
    classDeclaration: { name: string, range: vscode.Range, nameRange: vscode.Range, type: string } | null;
    uses: Array<{ name: string, alias: string | null, range: vscode.Range }>;
    lastUseEndLine: number;
}

export class AstHelper {
    private parser: any;

    constructor() {
        this.parser = new Engine({
            parser: { extractDoc: true },
            ast: { withPositions: true }
        });
    }

    public parseFile(content: string): PhpFileInfo | null {
        try {
            const ast = this.parser.parseCode(content, '');
            return this.extractInfo(ast);
        } catch (e) {
            console.error('PHP Parse Error:', e);
            return null;
        }
    }

    private extractInfo(ast: any): PhpFileInfo {
        const info: PhpFileInfo = {
            namespace: null,
            classDeclaration: null,
            uses: [],
            lastUseEndLine: 0
        };

        let children = ast.children;
        const nsNode = children.find((c: any) => c.kind === 'namespace');
        
        if (nsNode) {
            const nsNameRange = nsNode.loc 
                ? new vscode.Range(
                    new vscode.Position(nsNode.loc.start.line - 1, nsNode.loc.start.column),
                    new vscode.Position(nsNode.loc.start.line - 1, nsNode.loc.end.column)
                  )
                : this.locToRange(nsNode.loc);

            info.namespace = {
                name: nsNode.name,
                range: nsNameRange
            };
            children = nsNode.children;
        }

        for (const node of children) {
            if (node.kind === 'usegroup') {
                info.lastUseEndLine = Math.max(info.lastUseEndLine, node.loc.end.line - 1);
                for (const item of node.items) {
                    info.uses.push({
                        name: item.name,
                        alias: item.alias ? item.alias.name : null,
                        range: this.locToRange(item.loc)
                    });
                }
            } else if (['class', 'interface', 'trait', 'enum'].includes(node.kind)) {
                const nameNode = node.name;
                
                if (nameNode && nameNode.loc) {
                    info.classDeclaration = {
                        name: typeof nameNode === 'string' ? nameNode : nameNode.name,
                        range: this.locToRange(node.loc),
                        nameRange: this.locToRange(nameNode.loc), 
                        type: node.kind
                    };
                }
            }
        }

        return info;
    }

    private locToRange(loc: any): vscode.Range {
        return new vscode.Range(
            new vscode.Position(loc.start.line - 1, loc.start.column),
            new vscode.Position(loc.end.line - 1, loc.end.column)
        );
    }
}