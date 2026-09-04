import os, re, json

def find_emojis(folder, extensions):
    emojis_found = []
    emoji_pattern = re.compile(
        '[\U00010000-\U0010ffff]'
        '|[\u2600-\u27BF]'
        '|[\u2B50-\u2B55]'
        '|[\u203C-\u2049]'
        '|[\u25AA-\u25FE]'
        '|[★✓✕●⏱📍💬📸🍔👗📚💄👟🛠🛒😊🔥✨🎉💡👍❤💯]',
        flags=re.UNICODE
    )
    for root, dirs, files in os.walk(folder):
        if any(x in root for x in ['node_modules', '.git', 'dist', '__pycache__', 'venv', '.system_generated', 'brain']):
            continue
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for line_no, line in enumerate(f, 1):
                            matches = emoji_pattern.findall(line)
                            if matches:
                                emojis_found.append({
                                    "file": path.replace('\\', '/'),
                                    "line": line_no,
                                    "matches": [repr(m) for m in set(matches)],
                                    "snippet": line.strip()[:100]
                                })
                except Exception as e:
                    pass
    return emojis_found

results = find_emojis('..', ['.jsx', '.js', '.py'])
with open('emojis_report.json', 'w', encoding='utf-8') as out:
    json.dump(results, out, indent=2, ensure_ascii=False)
print(f"Total occurrences: {len(results)}")
