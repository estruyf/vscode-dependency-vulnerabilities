'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import FilesHelper from './helpers/filesHelper';
import SecurityCheck, { LogType, IDependencyWarning } from './helpers/securityCheck';

const EXTENSION_NAME = "vscode-dependency-vulnerabilities";
export function activate(context: vscode.ExtensionContext) {
    console.log(`Extension "${EXTENSION_NAME}" is now active!`);
    VulnerabilityExtension.activation(context);
}

class VulnerabilityExtension {
    private static _outputChannel: vscode.OutputChannel;
    private static _diagnosticCollection: vscode.DiagnosticCollection;

    /**
     * Activate the extension
     * @param context 
     */
    public static activation(context: vscode.ExtensionContext) {
        // Create an output channel to send all the information at
        VulnerabilityExtension._outputChannel = vscode.window.createOutputChannel('Dependency vulnerabilities');
        VulnerabilityExtension._outputChannel.clear();

        // Create diagnosticCollection
        VulnerabilityExtension._diagnosticCollection = vscode.languages.createDiagnosticCollection('Dependency vulnerabilities');

        // On command
        let disposable = vscode.commands.registerCommand('extension.checkDependencies', this._completeDependencyCheck);

        // File listeners
        vscode.workspace.onDidOpenTextDocument(this._checkPackageFile);
        vscode.workspace.onDidSaveTextDocument(this._checkPackageFile);
        // vscode.workspace.onDidChangeTextDocument(this._doPackageFileCheck);
        vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            VulnerabilityExtension._diagnosticCollection.delete(document.uri);
        });

        // Dispose
        context.subscriptions.push(disposable);
    }

    /**
     * Do a complete vulnerabilities check on all files
     */
    private static _completeDependencyCheck = async () => {
        try {
            // Retrieve the required files: package.json / npm-shrinkwrap.json / package-lock.json
            const pkgFilePath = await FilesHelper.getFilePath('package.json');
            const shrinkwrapFilePath = await FilesHelper.getFilePath('npm-shrinkwrap.json');
            const pkgLockFilePath = await FilesHelper.getFilePath('package-lock.json');

            // Read file contents
            const pkgContents = await FilesHelper.readFile(pkgFilePath);
            const shrinkwrapContents = await FilesHelper.readFile(shrinkwrapFilePath);
            const pkgLockContents = await FilesHelper.readFile(pkgLockFilePath);

            // Do the security check
            const securityResult = await SecurityCheck.check(pkgContents, shrinkwrapContents, pkgLockContents) as string[];

            // Check how many vulnerabilities were found
            if (securityResult) {
                if (securityResult.length > 0) {
                    VulnerabilityExtension._outputChannel.appendLine(`${securityResult.length} ${securityResult.length === 1 ? 'vulnerability' : 'vulnerabilities'} found`);
                    securityResult.forEach(msg => {
                        VulnerabilityExtension._outputChannel.appendLine(msg);
                    })
                    VulnerabilityExtension._outputChannel.show();
                } else {
                    vscode.window.showInformationMessage("No known vulnerabilities found.");
                }
            }
        } catch (e) {
            vscode.window.showErrorMessage(e);
        }
    }

    /**
     * Check if the file need to be checked
     */
    // private static _doPackageFileCheck = (e: vscode.TextDocumentChangeEvent) => {
    //     VulnerabilityExtension._checkPackageFile(e.document);
    // }

    /**
     * Check package.json file for vulnerabilities
     */
    private static _checkPackageFile = async (document: vscode.TextDocument) => {
        // Check if it is the package.json file
        if (document.fileName.endsWith('package.json')) {
            VulnerabilityExtension._diagnosticCollection.clear();
            const pkgContents = document.getText();
            const securityResult = await SecurityCheck.check(pkgContents, null, null, LogType.minimal) as IDependencyWarning[];
            if (securityResult && securityResult.length > 0) {
                const diags = [];
                securityResult.forEach(warning => {
                    let diag = new vscode.Diagnostic(VulnerabilityExtension._findLineNumber(warning.name, pkgContents), warning.msg, vscode.DiagnosticSeverity.Warning);
                    diag.source = "Dependency vulnerabilities";
                    diags.push(diag);
                });
                VulnerabilityExtension._diagnosticCollection.set(document.uri, diags);
            }
        }
    }

    /** 
     * Find the line number of the dependency
     */
    private static _findLineNumber(name: string, pkgContents: string): vscode.Range {
        const lines = pkgContents.split('\n');
        // Find the module
        const idx = lines.findIndex(line => line.indexOf(`"${name}"`) !== -1);
        return new vscode.Range(idx, lines[idx].indexOf(`"${name}"`), idx, lines[idx].length);
    }

    /**
     * Clear and dispose the output channel + diagnostic collection
     */
    private deactivate() {
        VulnerabilityExtension._outputChannel.clear();
        VulnerabilityExtension._outputChannel.dispose();
        VulnerabilityExtension._diagnosticCollection.clear();
        VulnerabilityExtension._diagnosticCollection.dispose();
    }
}[]