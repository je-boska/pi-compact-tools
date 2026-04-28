import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type BashToolDetails,
	type EditToolDetails,
	type FindToolDetails,
	type GrepToolDetails,
	type LsToolDetails,
	type ReadToolDetails,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { homedir } from "node:os";

const STATE_TYPE = "compact-tools-state";

type Mode = "on" | "off";
let mode: Mode = "on";

function shortPath(value: string | undefined): string {
	if (!value) return "...";
	const home = homedir();
	return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
}

function firstText(result: { content?: Array<{ type: string; text?: string }> }): string {
	return result.content?.find((item) => item.type === "text")?.text ?? "";
}

function isErrorText(text: string): boolean {
	return /(^|\n)(error|failed|not found|permission denied)[:\s]/i.test(text);
}

function lineCount(text: string): number {
	if (!text) return 0;
	return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function nonEmptyLineCount(text: string): number {
	return text.split("\n").filter((line) => line.trim().length > 0).length;
}

function truncateMiddle(text: string, max = 110): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	if (oneLine.length <= max) return oneLine;
	const keep = Math.max(10, Math.floor((max - 1) / 2));
	return `${oneLine.slice(0, keep)}…${oneLine.slice(-keep)}`;
}

function diffStats(diff: string | undefined): { added: number; deleted: number } {
	let added = 0;
	let deleted = 0;
	for (const line of (diff ?? "").split("\n")) {
		if (line.startsWith("+") && !line.startsWith("+++")) added++;
		if (line.startsWith("-") && !line.startsWith("---")) deleted++;
	}
	return { added, deleted };
}

function bullet(theme: any, text: string): string {
	return `${theme.fg("muted", "  ╰ ")}${text}`;
}

function iconLabel(label: string): string {
	const icons: Record<string, string> = {
		Read: "󰈙 Read",
		Write: "󰷈 Write",
		Edit: "󰷈 Edit",
		Execute: "󰆍 Execute",
		Search: " Search",
		Find: " Find",
		List: "󰙅 List",
	};
	return icons[label] ?? label;
}

function header(theme: any, label: string): Text {
	return new Text(theme.fg("toolTitle", theme.bold(iconLabel(label))), 0, 0);
}

function compact(theme: any, _label: string, detail: string): Text {
	return new Text(bullet(theme, detail), 0, 0);
}

function delegateRender(original: any, slot: "renderCall" | "renderResult", args: any[]) {
	const renderer = original?.[slot];
	if (typeof renderer === "function") return renderer(...args);
	return new Text("", 0, 0);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_TYPE && entry.data?.mode) {
				mode = entry.data.mode === "off" ? "off" : "on";
			}
		}
	});

	pi.registerCommand("compact-tools", {
		description: "Toggle compact built-in tool rendering: /compact-tools [on|off|toggle]",
		handler: async (args, ctx) => {
			const value = args.trim().toLowerCase();
			if (value === "on" || value === "off") mode = value;
			else if (value === "" || value === "toggle") mode = mode === "on" ? "off" : "on";
			else {
				ctx.ui.notify("Usage: /compact-tools [on|off|toggle]", "warning");
				return;
			}
			pi.appendEntry(STATE_TYPE, { mode });
			ctx.ui.notify(`compact-tools ${mode}`, "info");
		},
	});

	const cwd = process.cwd();
	const read = createReadToolDefinition(cwd);
	const write = createWriteToolDefinition(cwd);
	const edit = createEditToolDefinition(cwd);
	const bash = createBashToolDefinition(cwd);
	const grep = createGrepToolDefinition(cwd);
	const find = createFindToolDefinition(cwd);
	const ls = createLsToolDefinition(cwd);

	pi.registerTool({
		...read,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return read.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(read, "renderCall", [args, theme, context]);
			return header(theme, "Read");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(read, "renderResult", [result, options, theme, context]);
			if (options.isPartial) return compact(theme, "Read", `${shortPath(context.args.path)} · reading…`);
			const text = firstText(result);
			const details = result.details as ReadToolDetails | undefined;
			const path = theme.fg("accent", shortPath(context.args.path));
			if (result.content?.some((item: any) => item.type === "image")) return compact(theme, "Read", `${path} · image`);
			if (isErrorText(text)) return compact(theme, "Read", `${path} · ${theme.fg("error", truncateMiddle(text, 90))}`);
			const count = lineCount(text);
			const range = context.args.offset || context.args.limit ? `${count} lines` : "full file";
			const suffix = details?.truncation?.truncated ? ` · ${theme.fg("warning", "truncated")}` : "";
			return compact(theme, "Read", `${path} · ${range}${suffix}`);
		},
	});

	pi.registerTool({
		...write,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return write.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(write, "renderCall", [args, theme, context]);
			return header(theme, "Write");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(write, "renderResult", [result, options, theme, context]);
			const path = theme.fg("accent", shortPath(context.args.path));
			if (options.isPartial) return compact(theme, "Write", `${path} · writing…`);
			const text = firstText(result);
			if (isErrorText(text)) return compact(theme, "Write", `${path} · ${theme.fg("error", truncateMiddle(text, 90))}`);
			return compact(theme, "Write", `${path} · ${lineCount(context.args.content ?? "")} lines`);
		},
	});

	pi.registerTool({
		...edit,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return edit.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(edit, "renderCall", [args, theme, context]);
			return header(theme, "Edit");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(edit, "renderResult", [result, options, theme, context]);
			const path = theme.fg("accent", shortPath(context.args.path));
			if (options.isPartial) return compact(theme, "Edit", `${path} · editing…`);
			const text = firstText(result);
			if (isErrorText(text)) return compact(theme, "Edit", `${path} · ${theme.fg("error", truncateMiddle(text, 90))}`);
			const stats = diffStats((result.details as EditToolDetails | undefined)?.diff);
			return compact(theme, "Edit", `${path} · ${theme.fg("success", `+${stats.added}`)} ${theme.fg("error", `-${stats.deleted}`)}`);
		},
	});

	pi.registerTool({
		...bash,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return bash.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(bash, "renderCall", [args, theme, context]);
			return header(theme, "Execute");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(bash, "renderResult", [result, options, theme, context]);
			const command = theme.fg("accent", truncateMiddle(context.args.command ?? "..."));
			if (options.isPartial) return compact(theme, "Execute", `${command} · running…`);
			const details = result.details as BashToolDetails | undefined;
			const output = firstText(result).trim();
			const exitMatch = output.match(/exit code:\s*(\d+)/i);
			const exitCode = exitMatch?.[1] ?? "0";
			const parts = [`exit ${exitCode}`];
			const lines = nonEmptyLineCount(output.replace(/exit code:\s*\d+/i, ""));
			parts.push(lines === 0 ? "no output" : `${lines} output lines`);
			if (details?.truncation?.truncated) parts.push(theme.fg("warning", "truncated"));
			return compact(theme, "Execute", `${command} · ${parts.join(" · ")}`);
		},
	});

	pi.registerTool({
		...grep,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return grep.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(grep, "renderCall", [args, theme, context]);
			return header(theme, "Search");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(grep, "renderResult", [result, options, theme, context]);
			const details = result.details as GrepToolDetails | undefined;
			const count = nonEmptyLineCount(firstText(result));
			const path = shortPath(context.args.path || ".");
			const glob = context.args.glob ? ` · ${context.args.glob}` : "";
			const truncated = details?.truncation?.truncated ? ` · ${theme.fg("warning", "truncated")}` : "";
			return compact(theme, "Search", `${theme.fg("accent", `/${context.args.pattern ?? ""}/`)} · ${path}${glob} · ${count} matches${truncated}`);
		},
	});

	pi.registerTool({
		...find,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return find.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(find, "renderCall", [args, theme, context]);
			return header(theme, "Find");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(find, "renderResult", [result, options, theme, context]);
			const details = result.details as FindToolDetails | undefined;
			const count = nonEmptyLineCount(firstText(result));
			const truncated = details?.truncation?.truncated ? ` · ${theme.fg("warning", "truncated")}` : "";
			return compact(theme, "Find", `${theme.fg("accent", context.args.pattern ?? "*")} · ${shortPath(context.args.path || ".")} · ${count} files${truncated}`);
		},
	});

	pi.registerTool({
		...ls,
		renderShell: "self",
		execute(toolCallId, params, signal, onUpdate, ctx) {
			return ls.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme, context) {
			if (mode === "off") return delegateRender(ls, "renderCall", [args, theme, context]);
			return header(theme, "List");
		},
		renderResult(result, options, theme, context) {
			if (mode === "off") return delegateRender(ls, "renderResult", [result, options, theme, context]);
			const details = result.details as LsToolDetails | undefined;
			const count = nonEmptyLineCount(firstText(result));
			const truncated = details?.truncation?.truncated ? ` · ${theme.fg("warning", "truncated")}` : "";
			return compact(theme, "List", `${theme.fg("accent", shortPath(context.args.path || "."))} · ${count} entries${truncated}`);
		},
	});
}
