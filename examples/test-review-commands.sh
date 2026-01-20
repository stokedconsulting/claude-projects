#!/bin/bash
#
# test-review-commands.sh - Test the review command installation
#

set -e

echo "=== Testing Review Commands Installation ==="
echo ""

# Check if commands directory exists
if [ -d ~/.claude/commands ]; then
    echo "✅ Commands directory exists: ~/.claude/commands"
else
    echo "❌ Commands directory not found"
    exit 1
fi

# Check if command files exist
commands=("review-item" "review-phase" "review-project")
for cmd in "${commands[@]}"; do
    if [ -f ~/.claude/commands/${cmd}.md ]; then
        echo "✅ Command found: ${cmd}.md"
    else
        echo "❌ Command not found: ${cmd}.md"
        exit 1
    fi
done

echo ""
echo "=== Command Details ==="
echo ""

for cmd in "${commands[@]}"; do
    echo "📄 ${cmd}.md:"
    head -n 5 ~/.claude/commands/${cmd}.md | sed 's/^/   /'
    echo ""
done

echo "=== Testing Command Recognition ==="
echo ""

echo "Try running:"
echo "  claude --help"
echo ""
echo "Look for a 'Skills' or 'Custom Commands' section"
echo ""

echo "To test the commands:"
echo "  claude /review-item 2"
echo "  claude /review-phase 70 1"
echo "  claude /review-project 70"
echo ""

echo "=== Installation Complete ==="
echo ""
echo "📚 Documentation: examples/REVIEW_COMMANDS.md"
echo ""
