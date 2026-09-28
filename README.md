# PHP Move Refactor

**PHP Move Refactor** is a fast, reliable, and zero-config VS Code extension designed to automate PHP class renaming, file moving, and namespace adjustments based on **PSR-4** standards.

Powered by AST (Abstract Syntax Tree) parsing, it accurately updates class declarations, namespaces, and `use` imports across your entire project without broken imports or regex side effects.

## Features

* **Automatic PSR-4 Namespace Resolution**: Dynamically maps namespaces directly from your `composer.json` (`autoload` and `autoload-dev`).
* **Smart Class Renaming**: Automatically updates `class`, `interface`, `trait`, and `enum` declarations when a file is renamed.
* **Directory Refactoring**: Move a folder, and all nested PHP files will have their namespaces updated recursively.
* **Reference Updating**: Updates `use` statements and type-hint usages in dependent files using Intelephense reference lookup.
* **AST-Driven Precision**: Uses `php-parser` for exact token replacement, preventing false-positive text replacements.
* **Zero Configuration**: Works out of the box with intelligent namespace guessing fallbacks for projects without `composer.json`.

---

## Usage

Simply rename or drag-and-drop any PHP file or directory in VS Code's File Explorer (`F2` or Right Click -> Rename).

**PHP Smart Refactor** automatically intercepts the rename event, computes the target namespace/FQCN, and applies the refactoring edits seamlessly.

---

## Requirements

This extension requires **PHP Intelephense** to perform workspace-wide reference lookup:
* [PHP Intelephense](https://marketplace.visualstudio.com/items?itemName=bmewburn.vscode-intelephense-client) (`bmewburn.vscode-intelephense-client`)

---

## How It Works

1. **PSR-4 Mapping**: Reads `composer.json` to resolve directory structures to their corresponding PHP namespaces.
2. **AST Parsing**: Parses PHP files into AST nodes to pinpoint exact coordinates for namespace declarations, class names, and `use` groups.
3. **Reference Workspace Edit**: Leverages Intelephense language server to find external usages and safe-edits them simultaneously.

---

## License

[MIT](LICENSE)