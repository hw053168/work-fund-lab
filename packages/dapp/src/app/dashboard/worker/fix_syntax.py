
import sys

file_path = 'page.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# The bad line we saw in grep
target_snippet = "const rawDecimals = fund.tokenData.decimals; decimals: typeof rawDecimals === 'bigint' ? Number(rawDecimals) : (rawDecimals ?? 18),"

if target_snippet in content:
    print("Found exact snippet match.")
    # We want to replace it with valid object property syntax.
    # We can just inline the logic to avoid moving lines around.
    replacement = "decimals: typeof fund.tokenData.decimals === 'bigint' ? Number(fund.tokenData.decimals) : (fund.tokenData.decimals ?? 18),"
    
    new_content = content.replace(target_snippet, replacement)
    
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Fixed successfully.")
else:
    print("Exact snippet not found. Searching line by line...")
    lines = content.split('\n')
    found = False
    for i, line in enumerate(lines):
        if "const rawDecimals = fund.tokenData.decimals; decimals:" in line:
            print(f"Found bad line at {i+1}: {line.strip()}")
            # Replace the line with the inline version, preserving indentation
            indent = line[:line.find("const")]
            lines[i] = indent + "decimals: typeof fund.tokenData.decimals === 'bigint' ? Number(fund.tokenData.decimals) : (fund.tokenData.decimals ?? 18),"
            found = True
            break
    
    if found:
        with open(file_path, 'w') as f:
            f.write('\n'.join(lines))
        print("Fixed via line replacement.")
    else:
        print("Could not find the bad line.")
