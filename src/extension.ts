import * as vscode from 'vscode';
import { Psr4Resolver } from './Psr4Resolver';
import { RefactorEngine } from './RefactorEngine';

export function activate(context: vscode.ExtensionContext) {
    const psr4Resolver = new Psr4Resolver();
    
    if (vscode.workspace.workspaceFolders?.[0]) {
        psr4Resolver.load(vscode.workspace.workspaceFolders[0].uri);
    }

    const renameHook = vscode.workspace.onWillRenameFiles(event => {
        const engine = new RefactorEngine(psr4Resolver);
        const editPromise = engine.generateEditsForRename(event.files).catch(err => {
            throw err;
        });
        
        event.waitUntil(editPromise);
    });

    context.subscriptions.push(renameHook);
}

export function deactivate() {}