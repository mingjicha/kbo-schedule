# -*- coding: utf-8 -*-
import io, re, glob, os
from collections import defaultdict

def parse_rules(text):
    """(media_context, selector, body, line) 목록을 뽑는다"""
    rules = []
    media_stack = []
    i = 0
    line = 1
    buf = ''
    while i < len(text):
        ch = text[i]
        if ch == '\n':
            line += 1
        if ch == '{':
            head = buf.strip()
            buf = ''
            if head.startswith('@media') or head.startswith('@supports'):
                media_stack.append(head)
                i += 1
                continue
            # 규칙 본문 읽기
            depth = 1
            body = ''
            start_line = line
            i += 1
            while i < len(text) and depth > 0:
                c = text[i]
                if c == '\n':
                    line += 1
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        break
                body += c
                i += 1
            ctx = ' | '.join(media_stack)
            for sel in head.split(','):
                sel = sel.strip()
                if sel and not sel.startswith('@'):
                    rules.append((ctx, sel, body.strip(), start_line))
            i += 1
            continue
        if ch == '}':
            if media_stack:
                media_stack.pop()
            buf = ''
            i += 1
            continue
        buf += ch
        i += 1
    return rules

def norm_body(body):
    """선언을 정규화해 비교 가능하게"""
    decls = []
    for d in body.split(';'):
        d = re.sub(r'/\*.*?\*/', '', d, flags=re.S).strip()
        if not d or ':' not in d:
            continue
        k, v = d.split(':', 1)
        decls.append((k.strip().lower(), ' '.join(v.split())))
    return decls

print('=' * 70)
print('1. 같은 파일에서 같은 셀렉터가 여러 번 정의된 경우')
print('=' * 70)
for path in sorted(glob.glob('public/styles/*.css')):
    if path.endswith('index.css'):
        continue
    text = io.open(path, encoding='utf-8').read()
    rules = parse_rules(text)
    seen = defaultdict(list)
    for ctx, sel, body, ln in rules:
        seen[(ctx, sel)].append((ln, body))
    dups = {k: v for k, v in seen.items() if len(v) > 1}
    if dups:
        print(f'\n[{os.path.basename(path)}]')
        for (ctx, sel), occurrences in dups.items():
            lines = ', '.join(str(ln) for ln, _ in occurrences)
            ctx_label = f'  ({ctx})' if ctx else ''
            print(f'  {sel}{ctx_label}')
            print(f'    -> {len(occurrences)}번: {lines}행')
            # 겹치는 속성 찾기
            prop_lines = defaultdict(list)
            for ln, body in occurrences:
                for k, v in norm_body(body):
                    prop_lines[k].append((ln, v))
            for k, vals in prop_lines.items():
                if len(vals) > 1:
                    detail = ', '.join(f'{ln}행:{v}' for ln, v in vals)
                    print(f'       [겹침] {k} -> {detail}')
