# XML Path Colors

Color specific XML element **names** based on their **ancestor path**.

## Example
```jsonc
// settings.json
{
  "xmlPathColors.rules": [
    { "path": "App/HubDefs", "color": "#450000" },
    { "path": "App/HubDefs/HubDef.DirectiveSets", "color": "#950000" },
    { "path": "App/EntityDefs*", "color": "#0a7" }
  ]
}
```
Notes:
- Only tag **names** are colored (attributes/text unchanged).
- Use `*` as a **prefix** wildcard.

## Build & Package
```pwsh
npm.cmd install
npm.cmd run compile
npm.cmd run package
```
Then install the generated `.vsix` via **Extensions → … → Install from VSIX…**.
