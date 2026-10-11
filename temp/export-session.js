#!/usr/bin/env node
/**
 * 导出 Claude Code 会话记录为可读 Markdown。
 *
 * 用法：
 *   node export-session.js                       # 列出当前项目的历史会话
 *   node export-session.js <会话ID|文件名|路径>    # 导出到默认文件名
 *   node export-session.js <会话ID|文件名|路径> <输出路径.md>
 *
 * 说明：
 *   - 会话原始文件位于 ~/.claude/projects/<项目目录>/<uuid>.jsonl
 *   - 项目目录名 = '-' + 项目根目录的绝对路径（把 '/' 替换为 '-'）
 *   - 导出时仅保留「用户提问」与「Claude 回答」文字，过滤内部推理、工具调用、技能输出与 hook 注入。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 把某个目录绝对路径转成 Claude Code 的项目目录名（绝对路径的 '/' 替换为 '-'，前导 '/' 即前导 '-'）
function projectSlug(dir) {
  return path.resolve(dir).replace(/\//g, '-');
}

// 候选项目目录：优先当前工作目录，其次向上找 .git 根目录
function findCandidateSlugs() {
  const slugs = [];
  slugs.push(projectSlug(process.cwd()));
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, '.git'))) {
      slugs.push(projectSlug(d));
      break;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return [...new Set(slugs)];
}

function sessionsDir(slug) {
  return path.join(os.homedir(), '.claude', 'projects', slug);
}

function listSessions(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      return { file: f, path: p, mtime: st.mtime, size: st.size };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function strip(s) {
  return String(s)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .trim();
}

function extractText(content) {
  if (typeof content === 'string') return strip(content);
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n\n')
      .split('\n')
      .map(strip)
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function convert(jsonlPath, sessionId) {
  const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
  const out = [];
  out.push('# 会话记录');
  out.push('');
  out.push(`> 会话 ID：\`${sessionId}\` · 生成时间：${new Date().toISOString().slice(0, 10)}`);
  out.push('>');
  out.push('> 本文件由会话原始 `.jsonl` 转录自动生成，仅保留「用户提问」与「Claude 回答」文字，已过滤内部推理、工具调用、技能输出与 hook 注入。');
  out.push('');

  let userCount = 0;
  let claudeCount = 0;
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (o.type === 'user' && o.origin && o.origin.kind === 'human') {
      const t = extractText(o.message && o.message.content);
      if (t) {
        out.push('---', '', '## 用户', '', t, '');
        userCount += 1;
      }
    } else if (o.type === 'assistant') {
      const t = extractText(o.message && o.message.content);
      if (t) {
        out.push('---', '', '## Claude', '', t, '');
        claudeCount += 1;
      }
    }
  }

  return { markdown: out.join('\n'), userCount, claudeCount };
}

function printUsage(dir) {
  console.log(`
用法：
  node export-session.js                       # 列出当前项目的历史会话
  node export-session.js <会话ID|文件名|路径>    # 导出到默认文件名
  node export-session.js <会话ID|文件名|路径> <输出路径.md>

会话目录：${dir}
`);
}

// ---- 主流程 ----
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
  printUsage(sessionsDir(findCandidateSlugs()[0]));
  process.exit(0);
}

// 选第一个实际存在且包含 .jsonl 的项目目录
let dir = null;
let sessions = [];
for (const slug of findCandidateSlugs()) {
  const d = sessionsDir(slug);
  const list = listSessions(d);
  if (list.length) {
    dir = d;
    sessions = list;
    break;
  }
}

if (!dir) {
  console.error('未找到当前项目的会话记录（~/.claude/projects/ 下无匹配目录）。');
  process.exit(1);
}

// 无参数：列出会话
if (!args.length) {
  console.log('当前项目的历史会话（按时间倒序）：\n');
  sessions.forEach((s, i) => {
    const date = s.mtime.toISOString().slice(0, 16).replace('T', ' ');
    const kb = (s.size / 1024).toFixed(1);
    console.log(`  ${i + 1}. ${s.file}   ${kb} KB   ${date}`);
  });
  console.log('\n导出示例：node export-session.js ' + sessions[0].file.replace(/\.jsonl$/, ''));
  process.exit(0);
}

// 解析会话文件
let sessionFile = args[0];
if (!path.isAbsolute(sessionFile)) {
  const base = path.basename(sessionFile);
  const name = base.endsWith('.jsonl') ? base : base + '.jsonl';
  const inProject = path.join(dir, name);
  if (fs.existsSync(inProject)) {
    sessionFile = inProject;
  } else if (fs.existsSync(sessionFile)) {
    sessionFile = path.resolve(sessionFile);
  } else {
    console.error('找不到会话文件：' + args[0]);
    console.error('可用会话：');
    sessions.forEach((s) => console.error('  - ' + s.file));
    process.exit(1);
  }
} else if (!fs.existsSync(sessionFile)) {
  console.error('找不到会话文件：' + sessionFile);
  process.exit(1);
}

const sessionId = path.basename(sessionFile).replace(/\.jsonl$/, '');

// 输出路径：未指定时写到当前目录 session-YYYY-MM-DD.md
const outPath = args[1] || 'session-' + new Date().toISOString().slice(0, 10) + '.md';

const { markdown, userCount, claudeCount } = convert(sessionFile, sessionId);
fs.writeFileSync(outPath, markdown);

console.log('已导出：' + outPath);
console.log('用户消息 ' + userCount + ' 条 / Claude 回复 ' + claudeCount + ' 条');
