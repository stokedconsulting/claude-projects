#!/bin/bash

# Issue Creation and Linking Script
# Project: Build MCP Interface for API and Extension Communication
# Repository: stokedconsulting/claude-projects
# Project Number: 72
# Project ID: PVT_kwDOBW_6Ns4BNEBg

set -e

REPO_OWNER="stokedconsulting"
REPO_NAME="claude-projects"
PROJECT_NUMBER=72
PROJECT_ID="PVT_kwDOBW_6Ns4BNEBg"
SLUG="build-mcp-interface-for-api-and-extension-communication"
PFB_PATH="./projects/${SLUG}/pfb.md"
PRD_PATH="./projects/${SLUG}/prd.md"
PROJECT_TITLE="Build MCP Interface for API and Extension Communication"

# Arrays to store issue numbers
declare -A MASTER_ISSUES
declare -A WORK_ITEM_ISSUES

# Function to add issue to project using GraphQL
add_issue_to_project() {
  local issue_number=$1
  local project_id=$2
  local repo_owner=$3
  local repo_name=$4

  echo "Linking issue #$issue_number to project..."

  # Get the issue node ID
  issue_id=$(gh api graphql -f query="
    query {
      repository(owner: \"$repo_owner\", name: \"$repo_name\") {
        issue(number: $issue_number) {
          id
        }
      }
    }
  " --jq '.data.repository.issue.id')

  # Add to project using GraphQL mutation
  gh api graphql -f query="
    mutation {
      addProjectV2ItemById(input: {
        projectId: \"$project_id\"
        contentId: \"$issue_id\"
      }) {
        item {
          id
        }
      }
    }
  " > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "  ✓ Linked #$issue_number"
    return 0
  else
    echo "  ✗ Failed to link #$issue_number"
    return 1
  fi
}

echo "========================================"
echo "Creating GitHub Issues for Project #72"
echo "========================================"
echo ""

# ========================================
# PHASE 1: Foundation & Infrastructure
# ========================================
echo "Creating Phase 1 Master Issue..."
PHASE_1_BODY=$(cat <<'EOF'
## Phase 1: Foundation & Infrastructure

**Purpose:** Establish the MCP server scaffold, API client integration, and basic tool infrastructure before implementing specific tools. This foundation ensures proper authentication, error handling, and communication patterns are established for all subsequent development.

**Part of Project:** Build MCP Interface for API and Extension Communication

**Related Documents:**
- Product Feature Brief: `./projects/build-mcp-interface-for-api-and-extension-communication/pfb.md`
- Product Requirements Document: `./projects/build-mcp-interface-for-api-and-extension-communication/prd.md` (Section: Phase 1)

**Work Items in this Phase:**
- [ ] 1.1 MCP Server Package Initialization
- [ ] 1.2 API Client Integration
- [ ] 1.3 MCP Tool Registration Framework
- [ ] 1.4 Configuration and Environment Setup
- [ ] 1.5 Basic Health Check Tool

**Completion Criteria:**
All work items in this phase must be complete before moving to Phase 2.

---

This is a MASTER issue for Phase 1. See child issues for specific work items.
EOF
)

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" --title "(Phase 1) - Foundation & Infrastructure - MASTER" --body "$PHASE_1_BODY")
MASTER_ISSUES[1]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created Master Issue #${MASTER_ISSUES[1]}"

# Phase 1 Work Items
echo "Creating Phase 1 Work Items..."

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 1.1) - MCP Server Package Initialization" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 1.1)

Parent issue: #${MASTER_ISSUES[1]}")
WORK_ITEM_ISSUES["1.1"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["1.1"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 1.2) - API Client Integration" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 1.2)

Parent issue: #${MASTER_ISSUES[1]}")
WORK_ITEM_ISSUES["1.2"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["1.2"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 1.3) - MCP Tool Registration Framework" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 1.3)

Parent issue: #${MASTER_ISSUES[1]}")
WORK_ITEM_ISSUES["1.3"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["1.3"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 1.4) - Configuration and Environment Setup" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 1.4)

Parent issue: #${MASTER_ISSUES[1]}")
WORK_ITEM_ISSUES["1.4"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["1.4"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 1.5) - Basic Health Check Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 1.5)

Parent issue: #${MASTER_ISSUES[1]}")
WORK_ITEM_ISSUES["1.5"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["1.5"]}"

# ========================================
# PHASE 2: Core Read Operations
# ========================================
echo ""
echo "Creating Phase 2 Master Issue..."
PHASE_2_BODY=$(cat <<'EOF'
## Phase 2: Core Read Operations

**Purpose:** Implement read-only tools that query state-tracking-api for project and issue information. These tools have no side effects and establish the patterns for tool implementation, error handling, and response formatting that write operations will follow.

**Part of Project:** Build MCP Interface for API and Extension Communication

**Related Documents:**
- Product Feature Brief: `./projects/build-mcp-interface-for-api-and-extension-communication/pfb.md`
- Product Requirements Document: `./projects/build-mcp-interface-for-api-and-extension-communication/prd.md` (Section: Phase 2)

**Work Items in this Phase:**
- [ ] 2.1 Read Project Tool
- [ ] 2.2 List Issues Tool
- [ ] 2.3 Get Project Phases Tool
- [ ] 2.4 Get Issue Details Tool

**Completion Criteria:**
All work items in this phase must be complete before moving to Phase 3.

---

This is a MASTER issue for Phase 2. See child issues for specific work items.
EOF
)

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" --title "(Phase 2) - Core Read Operations - MASTER" --body "$PHASE_2_BODY")
MASTER_ISSUES[2]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created Master Issue #${MASTER_ISSUES[2]}"

# Phase 2 Work Items
echo "Creating Phase 2 Work Items..."

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 2.1) - Read Project Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 2.1)

Parent issue: #${MASTER_ISSUES[2]}")
WORK_ITEM_ISSUES["2.1"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["2.1"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 2.2) - List Issues Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 2.2)

Parent issue: #${MASTER_ISSUES[2]}")
WORK_ITEM_ISSUES["2.2"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["2.2"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 2.3) - Get Project Phases Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 2.3)

Parent issue: #${MASTER_ISSUES[2]}")
WORK_ITEM_ISSUES["2.3"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["2.3"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 2.4) - Get Issue Details Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 2.4)

Parent issue: #${MASTER_ISSUES[2]}")
WORK_ITEM_ISSUES["2.4"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["2.4"]}"

# ========================================
# PHASE 3: Core Write Operations
# ========================================
echo ""
echo "Creating Phase 3 Master Issue..."
PHASE_3_BODY=$(cat <<'EOF'
## Phase 3: Core Write Operations

**Purpose:** Build tools that modify project and issue state through state-tracking-api. These operations require transaction handling, validation, and conflict resolution that read operations do not.

**Part of Project:** Build MCP Interface for API and Extension Communication

**Related Documents:**
- Product Feature Brief: `./projects/build-mcp-interface-for-api-and-extension-communication/pfb.md`
- Product Requirements Document: `./projects/build-mcp-interface-for-api-and-extension-communication/prd.md` (Section: Phase 3)

**Work Items in this Phase:**
- [ ] 3.1 Update Issue Status Tool
- [ ] 3.2 Update Issue Phase Tool
- [ ] 3.3 Create Issue Tool
- [ ] 3.4 Update Issue Details Tool

**Completion Criteria:**
All work items in this phase must be complete before moving to Phase 4.

---

This is a MASTER issue for Phase 3. See child issues for specific work items.
EOF
)

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" --title "(Phase 3) - Core Write Operations - MASTER" --body "$PHASE_3_BODY")
MASTER_ISSUES[3]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created Master Issue #${MASTER_ISSUES[3]}"

# Phase 3 Work Items
echo "Creating Phase 3 Work Items..."

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 3.1) - Update Issue Status Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 3.1)

Parent issue: #${MASTER_ISSUES[3]}")
WORK_ITEM_ISSUES["3.1"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["3.1"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 3.2) - Update Issue Phase Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 3.2)

Parent issue: #${MASTER_ISSUES[3]}")
WORK_ITEM_ISSUES["3.2"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["3.2"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 3.3) - Create Issue Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 3.3)

Parent issue: #${MASTER_ISSUES[3]}")
WORK_ITEM_ISSUES["3.3"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["3.3"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 3.4) - Update Issue Details Tool" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 3.4)

Parent issue: #${MASTER_ISSUES[3]}")
WORK_ITEM_ISSUES["3.4"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["3.4"]}"

# ========================================
# PHASE 4: Real-Time Notification System
# ========================================
echo ""
echo "Creating Phase 4 Master Issue..."
PHASE_4_BODY=$(cat <<'EOF'
## Phase 4: Real-Time Notification System

**Purpose:** Establish bidirectional communication between MCP server and VSCode extension to eliminate manual refreshes. This phase delivers the core user experience improvement.

**Part of Project:** Build MCP Interface for API and Extension Communication

**Related Documents:**
- Product Feature Brief: `./projects/build-mcp-interface-for-api-and-extension-communication/pfb.md`
- Product Requirements Document: `./projects/build-mcp-interface-for-api-and-extension-communication/prd.md` (Section: Phase 4)

**Work Items in this Phase:**
- [ ] 4.1 Notification Event Architecture
- [ ] 4.2 WebSocket Server Implementation
- [ ] 4.3 VSCode Extension WebSocket Client
- [ ] 4.4 Notification Reliability and Error Handling

**Completion Criteria:**
All work items in this phase must be complete before moving to Phase 5.

---

This is a MASTER issue for Phase 4. See child issues for specific work items.
EOF
)

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" --title "(Phase 4) - Real-Time Notification System - MASTER" --body "$PHASE_4_BODY")
MASTER_ISSUES[4]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created Master Issue #${MASTER_ISSUES[4]}"

# Phase 4 Work Items
echo "Creating Phase 4 Work Items..."

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 4.1) - Notification Event Architecture" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 4.1)

Parent issue: #${MASTER_ISSUES[4]}")
WORK_ITEM_ISSUES["4.1"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["4.1"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 4.2) - WebSocket Server Implementation" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 4.2)

Parent issue: #${MASTER_ISSUES[4]}")
WORK_ITEM_ISSUES["4.2"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["4.2"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 4.3) - VSCode Extension WebSocket Client" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 4.3)

Parent issue: #${MASTER_ISSUES[4]}")
WORK_ITEM_ISSUES["4.3"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["4.3"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 4.4) - Notification Reliability and Error Handling" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 4.4)

Parent issue: #${MASTER_ISSUES[4]}")
WORK_ITEM_ISSUES["4.4"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["4.4"]}"

# ========================================
# PHASE 5: Integration, Testing & Migration
# ========================================
echo ""
echo "Creating Phase 5 Master Issue..."
PHASE_5_BODY=$(cat <<'EOF'
## Phase 5: Integration, Testing & Migration

**Purpose:** Validate end-to-end functionality, document the system, and migrate from the legacy signal file approach to ensure production readiness.

**Part of Project:** Build MCP Interface for API and Extension Communication

**Related Documents:**
- Product Feature Brief: `./projects/build-mcp-interface-for-api-and-extension-communication/pfb.md`
- Product Requirements Document: `./projects/build-mcp-interface-for-api-and-extension-communication/prd.md` (Section: Phase 5)

**Work Items in this Phase:**
- [ ] 5.1 End-to-End Integration Testing
- [ ] 5.2 Migration from update-project.sh
- [ ] 5.3 Documentation and Examples
- [ ] 5.4 Production Readiness Validation
- [ ] 5.5 Claude Code Integration Validation

**Completion Criteria:**
All work items in this phase must be complete for project to be production-ready.

---

This is a MASTER issue for Phase 5. See child issues for specific work items.
EOF
)

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" --title "(Phase 5) - Integration, Testing & Migration - MASTER" --body "$PHASE_5_BODY")
MASTER_ISSUES[5]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created Master Issue #${MASTER_ISSUES[5]}"

# Phase 5 Work Items
echo "Creating Phase 5 Work Items..."

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 5.1) - End-to-End Integration Testing" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 5.1)

Parent issue: #${MASTER_ISSUES[5]}")
WORK_ITEM_ISSUES["5.1"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["5.1"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 5.2) - Migration from update-project.sh" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 5.2)

Parent issue: #${MASTER_ISSUES[5]}")
WORK_ITEM_ISSUES["5.2"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["5.2"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 5.3) - Documentation and Examples" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 5.3)

Parent issue: #${MASTER_ISSUES[5]}")
WORK_ITEM_ISSUES["5.3"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["5.3"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 5.4) - Production Readiness Validation" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 5.4)

Parent issue: #${MASTER_ISSUES[5]}")
WORK_ITEM_ISSUES["5.4"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["5.4"]}"

ISSUE_URL=$(gh issue create --repo "$REPO_OWNER/$REPO_NAME" \
  --title "(Phase 5.5) - Claude Code Integration Validation" \
  --body "See PRD: ./projects/${SLUG}/prd.md (Section 5.5)

Parent issue: #${MASTER_ISSUES[5]}")
WORK_ITEM_ISSUES["5.5"]=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "  ✓ Created #${WORK_ITEM_ISSUES["5.5"]}"

echo ""
echo "========================================"
echo "Linking All Issues to Project #72"
echo "========================================"
echo ""

# Link all master issues
echo "Linking Master Issues..."
for phase in 1 2 3 4 5; do
  add_issue_to_project "${MASTER_ISSUES[$phase]}" "$PROJECT_ID" "$REPO_OWNER" "$REPO_NAME"
done

# Link all work item issues
echo ""
echo "Linking Work Item Issues..."
for item in "1.1" "1.2" "1.3" "1.4" "1.5" "2.1" "2.2" "2.3" "2.4" "3.1" "3.2" "3.3" "3.4" "4.1" "4.2" "4.3" "4.4" "5.1" "5.2" "5.3" "5.4" "5.5"; do
  add_issue_to_project "${WORK_ITEM_ISSUES[$item]}" "$PROJECT_ID" "$REPO_OWNER" "$REPO_NAME"
done

echo ""
echo "========================================"
echo "Verifying Project Item Count"
echo "========================================"
echo ""

ITEM_COUNT=$(gh project item-list $PROJECT_NUMBER --owner "$REPO_OWNER" --format json --limit 100 | jq -r '.items | length')
EXPECTED_COUNT=27  # 5 master + 22 work items

if [ "$ITEM_COUNT" -eq "$EXPECTED_COUNT" ]; then
  echo "✅ All $ITEM_COUNT issues successfully linked to project"
else
  echo "⚠️  Warning: Expected $EXPECTED_COUNT items, but project has $ITEM_COUNT"
  echo "   Some issues may not have been linked. Check project board."
fi

echo ""
echo "========================================"
echo "Issue Creation Complete!"
echo "========================================"
echo ""
echo "Master Issues:"
for phase in 1 2 3 4 5; do
  echo "  Phase $phase: #${MASTER_ISSUES[$phase]}"
done

echo ""
echo "Project URL: https://github.com/orgs/stokedconsulting/projects/72"
echo ""
