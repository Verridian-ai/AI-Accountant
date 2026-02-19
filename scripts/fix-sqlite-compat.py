#!/usr/bin/env python3
"""
TASK-047: Remove SQLite compat shims (.get() / .all() / db.run).

Transformations applied:
  1. chain.all()          -> chain        (remove .all() terminator)
  2. chain.get() inline   -> (chain)[0]   (single-line await...get())
  3. chain               -> (chain)[0]   (multi-line: .get() on own line)
     .get();
  4. db.run(sql`...`)    -> db.execute(sql`...`)

Does NOT touch:
  - schema/connection.ts  (modified separately)
  - db.get(sql...)        (handled by agents - complex SQL template case)
  - db.all(sql...)        (handled by agents - complex SQL template case)
  - Promise.all()         (not a DB call)
"""

import re
import os
import sys


def transform_lines(lines: list[str]) -> tuple[list[str], int]:
    """Transform a list of lines. Returns (new_lines, change_count)."""
    result = list(lines)
    changes = 0

    i = 0
    while i < len(result):
        line = result[i]

        # ----------------------------------------------------------------
        # Case 1: Remove .all() terminator
        # Match .all() that is NOT Promise.all() or .all(something)
        # Pattern: .all() at end of statement (before ; or end of line)
        # ----------------------------------------------------------------
        if re.search(r'\.all\(\)', line) and 'Promise.all(' not in line:
            new_line = re.sub(r'\.all\(\)', '', line)
            if new_line != line:
                result[i] = new_line
                changes += 1
                line = new_line

        # ----------------------------------------------------------------
        # Case 2: db.run( -> db.execute(
        # ----------------------------------------------------------------
        if 'db.run(' in line:
            new_line = line.replace('db.run(', 'db.execute(')
            if new_line != line:
                result[i] = new_line
                changes += 1
                line = new_line

        # ----------------------------------------------------------------
        # Case 3a: .get() alone on a line (multi-line chain)
        # e.g.:   .get();
        # -> Find the nearest 'await' above, add ( before await
        # -> Replace .get(); with )[0];
        # ----------------------------------------------------------------
        stripped = line.rstrip()
        if re.match(r'^\s*\.get\(\)\s*;?\s*$', stripped):
            # Find the nearest line above that has 'await'
            await_idx = None
            for j in range(i - 1, max(-1, i - 40), -1):
                if re.search(r'\bawait\b', result[j]):
                    await_idx = j
                    break

            if await_idx is not None:
                # Add ( before 'await' on the await line
                await_line = result[await_idx]
                new_await = re.sub(r'\bawait\b', '(await', await_line, count=1)
                if new_await != await_line:
                    result[await_idx] = new_await
                    changes += 1

                # Replace .get(); with )[0];
                indent = re.match(r'^(\s*)', stripped).group(1)
                has_semi = stripped.endswith(';')
                result[i] = indent + ')[0]' + (';' if has_semi else '') + '\n'
                changes += 1
                i += 1
                continue

        # ----------------------------------------------------------------
        # Case 3b: await expr.get() on a SINGLE line
        # e.g.: const x = await db.select().from(t).where(eq(t.id, id)).get();
        # -> const x = (await db.select().from(t).where(eq(t.id, id)))[0];
        # ----------------------------------------------------------------
        elif re.search(r'\bawait\b.+\.get\(\)\s*;?\s*$', stripped):
            new = re.sub(
                r'(\bawait\b.+?)\.get\(\)(\s*;?\s*)$',
                r'(\1)[0]\2',
                stripped,
            )
            if new != stripped:
                result[i] = new + '\n'
                changes += 1

        i += 1

    return result, changes


def process_file(filepath: str) -> int:
    """Process a single TypeScript file. Returns number of changes."""
    # Skip schema/connection.ts (handled separately)
    if filepath.replace('\\', '/').endswith('schema/connection.ts'):
        return 0

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f'  ERROR reading {filepath}: {e}', file=sys.stderr)
        return 0

    new_lines, changes = transform_lines(lines)

    if changes > 0:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
        except Exception as e:
            print(f'  ERROR writing {filepath}: {e}', file=sys.stderr)
            return 0

    return changes


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    total_changes = 0
    changed_files = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Skip non-source directories
        dirnames[:] = [
            d for d in dirnames
            if d not in ('node_modules', '.git', 'dist', 'build', '__pycache__')
        ]
        for fn in sorted(filenames):
            if fn.endswith('.ts') and not fn.endswith('.d.ts'):
                fp = os.path.join(dirpath, fn)
                n = process_file(fp)
                if n > 0:
                    total_changes += n
                    changed_files.append((fp, n))

    print(f'\nTotal: {total_changes} changes across {len(changed_files)} files\n')
    for fp, n in sorted(changed_files):
        rel = os.path.relpath(fp, root)
        print(f'  [{n:3d}] {rel}')


if __name__ == '__main__':
    main()
