import * as vscode from 'vscode';

export default class FilesHelper {
  public static getFilePath(name: string, exclude: string = "**/node_modules/**", total: number = 1): Thenable<string> {
    return vscode.workspace.findFiles(name, exclude, total).then((fileUris: vscode.Uri[]) => {
      if (fileUris && fileUris.length > 0) {
        return fileUris[0].path;
      }
      return null;
    });
  }

  public static readFile(path: string): Thenable<string> {
    if (path) {
      return vscode.workspace.openTextDocument(path).then((contents: vscode.TextDocument) => contents.getText());
    } else {
      return null;
    }
  }
}