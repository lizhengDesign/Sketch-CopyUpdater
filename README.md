# Copy-Updater

A Sketch plugin that updates copy based on selected JSON

## Installation

- [Download](../../releases/latest/download/copy-updater.sketchplugin.zip) the latest release of the plugin
- Un-zip
- Double-click on copy-updater.sketchplugin

## How to use

For text: use @<key> as content

For symbol and nested symbol: use @<key> as its override value

### Examples:

JSON

```json
{
  "header": "This is a header",
  "intro1": {
    "title": "Intro 1",
    "body": "This is body copy for intro 1"
  },
  "intro2": {
    "title": "Intro 2",
    "body": "This is body copy for intro 2"
  }
}
```

Sketch File

```
Textlayer (text): @header
Intro Symbol 1 (override value): @intro1.title, @intro1.body
Intro Symbol 2 (override value): @intro2.title, @intro2.body
```
