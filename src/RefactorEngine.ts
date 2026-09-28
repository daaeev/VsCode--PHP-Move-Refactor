import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Psr4Resolver } from './Psr4Resolver';
import { AstHelper, PhpFileInfo } from './AstHelper';

export class RefactorEngine {
    private astHelper = new AstHelper();
    private edit = new vscode.WorkspaceEdit();

    constructor(private psr4Resolver: Psr4Resolver) {}

    public async generateEditsForRename(files: ReadonlyArray<{ oldUri: vscode.Uri, newUri: vscode.Uri }>): Promise<vscode.WorkspaceEdit> {
        for (const file of files) {
            await this.processRename(file.oldUri, file.newUri);
        }
        return this.edit;
    }

    private async processRename(oldUri: vscode.Uri, newUri: vscode.Uri) {
        const stat = fs.statSync(oldUri.fsPath);
        
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(oldUri.fsPath);
            for (const entry of entries) {
                const childOldUri = vscode.Uri.file(path.join(oldUri.fsPath, entry));
                const childNewUri = vscode.Uri.file(path.join(newUri.fsPath, entry));
                await this.processRename(childOldUri, childNewUri);
            }
        } else if (oldUri.fsPath.endsWith('.php')) {
            await this.processPhpFile(oldUri, newUri);
        }
    }

    private async processPhpFile(oldUri: vscode.Uri, newUri: vscode.Uri) {
        const doc = await vscode.workspace.openTextDocument(oldUri);
        const oldContent = doc.getText();
        const astInfo = this.astHelper.parseFile(oldContent);

        if (!astInfo || !astInfo.classDeclaration) {
            return;
        }

        const oldClassName = astInfo.classDeclaration.name;
        const newClassName = path.basename(newUri.fsPath, '.php');
        const oldNamespace = astInfo.namespace?.name || '';
        const newNamespace = this.psr4Resolver.resolveNamespace(newUri.fsPath) || oldNamespace;
        
        const oldFqcn = oldNamespace ? `${oldNamespace}\\${oldClassName}` : oldClassName;
        const newFqcn = newNamespace ? `${newNamespace}\\${newClassName}` : newClassName;

        if (newNamespace !== oldNamespace && astInfo.namespace) {
            const nsLine = astInfo.namespace.range.start.line;
            const lineRange = doc.lineAt(nsLine).range;
            this.edit.replace(oldUri, lineRange, `namespace ${newNamespace};`);
        }
        if (newClassName !== oldClassName) {
            this.edit.replace(oldUri, astInfo.classDeclaration.nameRange, newClassName);
        }

        const position = astInfo.classDeclaration.nameRange.start;
        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            oldUri,
            position
        );

        if (!references) return;

        const refsByFile = new Map<string, vscode.Location[]>();
        for (const ref of references) {
            if (ref.uri.fsPath === oldUri.fsPath) continue; 
            
            const arr = refsByFile.get(ref.uri.fsPath) || [];
            arr.push(ref);
            refsByFile.set(ref.uri.fsPath, arr);
        }

        for (const [fsPath, locations] of refsByFile.entries()) {
            await this.updateReferencedFile(vscode.Uri.file(fsPath), locations, oldFqcn, newFqcn, newClassName, newNamespace);
        }
    }

    private async updateReferencedFile(
        uri: vscode.Uri, 
        locations: vscode.Location[], 
        oldFqcn: string, 
        newFqcn: string, 
        newClassName: string, 
        newNamespace: string
    ) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const content = doc.getText();
        const astInfo = this.astHelper.parseFile(content);
        
        if (!astInfo) return;

        let hadExplicitUse = false;
        
        for (const useItem of astInfo.uses) {
            if (useItem.name === oldFqcn) {
                hadExplicitUse = true;
                if (astInfo.namespace?.name === newNamespace) {
                    this.edit.delete(uri, new vscode.Range(
                        new vscode.Position(useItem.range.start.line, 0),
                        new vscode.Position(useItem.range.end.line + 1, 0)
                    ));
                } else if (oldFqcn !== newFqcn) {
                    this.edit.replace(uri, useItem.range, newFqcn);
                }
            }
        }

        if (!hadExplicitUse && astInfo.namespace?.name !== newNamespace && newNamespace !== '') {
            const insertLine = astInfo.lastUseEndLine > 0 
                ? astInfo.lastUseEndLine + 1 
                : (astInfo.namespace ? astInfo.namespace.range.end.line + 2 : 1);
            
            const insertPos = new vscode.Position(insertLine, 0);
            this.edit.insert(uri, insertPos, `use ${newFqcn};\n`);
        }

        const oldShortName = oldFqcn.split('\\').pop() as string;
        if (oldShortName !== newClassName) {
            for (const loc of locations) {
                const isInsideUse = astInfo.uses.some(useItem => 
                    loc.range.start.line >= useItem.range.start.line && 
                    loc.range.end.line <= useItem.range.end.line
                );

                const isInsideNs = astInfo.namespace && 
                    loc.range.start.line === astInfo.namespace.range.start.line;

                if (!isInsideUse && !isInsideNs) {
                    this.edit.replace(uri, loc.range, newClassName);
                }
            }
        }
    }
}