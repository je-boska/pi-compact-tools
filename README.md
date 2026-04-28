# pi-compact-tools

Compact built-in tool rendering for [pi](https://pi.dev).

This extension keeps tool execution and model context unchanged, but renders built-in tool calls/results in a compact terminal-friendly format.

```txt
󰈙 Read
  ╰ README.md · full file

󰷈 Write
  ╰ src/file.ts · 12 lines

󰆍 Execute
  ╰ pnpm tsc --noEmit · exit 0 · no output
```

## Features

- Compact renderers for `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls`
- No background blocks or large code/output excerpts in collapsed tool display
- Preserves original built-in tool execution behavior
- Preserves full tool results for pi/model context
- Nerd Font glyphs
- Toggle at runtime with `/compact-tools`

## Install

```bash
pi install git:git@github.com:je-boska/pi-compact-tools.git
```

Then restart pi or run:

```txt
/reload
```

## Usage

```txt
/compact-tools on
/compact-tools off
/compact-tools toggle
```

Default mode is `on`.

## Local development

```bash
pi -e ./extensions/index.ts
```

Or symlink it into pi's global extensions folder:

```bash
ln -sfn "$PWD/extensions/index.ts" ~/.pi/agent/extensions/compact-tools.ts
```

## Notes

- This extension intentionally does **not** modify assistant messages or reasoning/thinking display.
- Expanded/collapsed behavior remains controlled by pi.
- Requires a Nerd Font for icons to render correctly.
