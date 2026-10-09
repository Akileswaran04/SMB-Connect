#!/bin/bash
# Git Pre-Commit Hook for TECHNOVA Backend
# Prevents committing sensitive files and secrets
#
# Installation:
#   cp pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# To bypass (only in emergencies):
#   git commit --no-verify
#
# DO NOT disable this hook without understanding the security implications!

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

echo -e "${YELLOW}🔐 Running security pre-commit checks...${NC}"

# Check 1: Prevent committing .env files
echo -n "  [1/5] Checking for .env files... "
if git diff --cached --name-only | grep -E "\.env$" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC}"
    echo -e "${RED}    ❌ ERROR: Attempting to commit .env file!${NC}"
    echo -e "${RED}    .env contains production credentials and must not be committed.${NC}"
    echo -e "${RED}    Use .env.example as a template instead.${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ PASSED${NC}"
fi

# Check 2: Prevent committing secrets files
echo -n "  [2/5] Checking for secrets files... "
if git diff --cached --name-only | grep -iE "(secrets|credentials|aws|api.?key)" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC}"
    echo -e "${RED}    ❌ ERROR: Detected potential secrets file!${NC}"
    git diff --cached --name-only | grep -iE "(secrets|credentials|aws|api.?key)" | sed 's/^/    - /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ PASSED${NC}"
fi

# Check 3: Scan for common password patterns
echo -n "  [3/5] Scanning for hardcoded passwords... "
if git diff --cached -U0 | grep -E "password\s*=\s*['\"][^'\"]*['\"]|api_key\s*=|secret\s*=" > /dev/null 2>&1; then
    echo -e "${RED}✗ WARNING${NC}"
    echo -e "${YELLOW}    ⚠️  Detected potential hardcoded secrets in code!${NC}"
    echo -e "${YELLOW}    Review the following lines:${NC}"
    git diff --cached -U0 | grep -E "password\s*=\s*['\"][^'\"]*['\"]|api_key\s*=|secret\s*=" | sed 's/^/    - /'
    # Note: This is a warning, not an error. Developers may have false positives
    # (e.g., password hashing functions, placeholder values in .env.example)
else
    echo -e "${GREEN}✓ PASSED${NC}"
fi

# Check 4: Verify MongoDB connection string patterns
echo -n "  [4/5] Checking for hardcoded database URLs... "
if git diff --cached -U0 | grep -E "mongodb\+srv://[^:]+:[^@]+@|postgresql://[^:]+:[^@]+@" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC}"
    echo -e "${RED}    ❌ ERROR: Detected hardcoded database connection string!${NC}"
    echo -e "${RED}    Database credentials must be in .env, not in source code.${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ PASSED${NC}"
fi

# Check 5: Verify no AWS/Azure/GCP credentials
echo -n "  [5/5] Checking for cloud provider credentials... "
if git diff --cached -U0 | grep -iE "AKIA[0-9A-Z]{16}|aws_secret_access_key|ASRA|ghp_|sk_live_|pk_live_" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC}"
    echo -e "${RED}    ❌ ERROR: Detected cloud provider credentials!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ PASSED${NC}"
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo -e "${GREEN}Proceeding with commit...${NC}"
    exit 0
else
    echo -e "${RED}❌ Security check failed! ($ERRORS issue(s) found)${NC}"
    echo ""
    echo "To fix:"
    echo "  1. Remove sensitive files from staging: git reset HEAD <file>"
    echo "  2. Add to .gitignore if needed"
    echo "  3. Use .env.example as template for configuration"
    echo ""
    echo "To bypass (ONLY if you're absolutely sure): git commit --no-verify"
    echo ""
    exit 1
fi
