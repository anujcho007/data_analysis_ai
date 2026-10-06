import re
from typing import Tuple, Set, Dict, Any

FORBIDDEN_KEYWORDS = {
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", 
    "REPLACE", "TRUNCATE", "ATTACH", "DETACH", "PRAGMA", 
    "EXEC", "VACUUM", "GRANT", "REVOKE", "INTO", "MERGE"
}

RESERVED_INTERNAL_TABLES = {
    "users", "dataset_metadata", "sqlite_master", 
    "sqlite_sequence", "sqlite_temp_master",
    "database_connections", "alert_rules", "alert_history",
    "workspaces", "workspace_members"
}

def validate_and_sanitize_sql(sql: str, allowed_tables: Set[str] = None) -> Tuple[bool, str, str, Dict[str, Any]]:
    """
    Multi-Layered Security Gatekeeper for AI-Generated and User-Supplied SQL:
    1. Single Statement Enforcement (blocks multi-statement injection)
    2. Read-Only Verification (must start with SELECT or WITH)
    3. Destructive Keyword Blacklist (DROP, DELETE, UPDATE, etc.)
    4. Internal System Table Cloaking (blocks users, sqlite_master)
    5. DoS Prevention (injects safe LIMIT 500 if missing)
    
    Returns: (is_safe, sanitized_sql, error_message, security_metadata)
    """
    clean_sql = sql.strip().rstrip(";")
    
    security_metadata = {
        "read_only": False,
        "single_statement": False,
        "limit_enforced": False,
        "forbidden_tokens_found": [],
        "system_tables_accessed": []
    }

    # 1. Enforce single statement
    if ";" in clean_sql:
        return False, "", "Security Violation: Multiple SQL statements are strictly forbidden.", security_metadata

    security_metadata["single_statement"] = True

    # 2. Enforce SELECT / WITH only
    upper_sql = clean_sql.upper()
    if not (upper_sql.startswith("SELECT") or upper_sql.startswith("WITH")):
        return False, "", "Security Violation: Only read-only SELECT or WITH queries are permitted.", security_metadata

    security_metadata["read_only"] = True

    # 3. Check for destructive keywords using word boundary regex
    tokens = set(re.findall(r'\b[A-Z]+\b', upper_sql))
    forbidden_found = tokens.intersection(FORBIDDEN_KEYWORDS)
    if forbidden_found:
        security_metadata["forbidden_tokens_found"] = list(forbidden_found)
        return False, "", f"Security Violation: Destructive SQL keyword detected: {', '.join(forbidden_found)}.", security_metadata

    # 4. Check internal table access
    accessed_internal = []
    for reserved in RESERVED_INTERNAL_TABLES:
        if re.search(rf'\b{reserved}\b', clean_sql, re.IGNORECASE):
            accessed_internal.append(reserved)

    if accessed_internal:
        security_metadata["system_tables_accessed"] = accessed_internal
        return False, "", f"Security Violation: Access to internal system table '{', '.join(accessed_internal)}' is blocked.", security_metadata

    # 5. Enforce safe LIMIT to prevent memory exhaustion
    limit_match = re.search(r'\bLIMIT\s+(\d+)\b', upper_sql)
    if not limit_match:
        clean_sql = f"{clean_sql} LIMIT 500"
        security_metadata["limit_enforced"] = True
    else:
        limit_val = int(limit_match.group(1))
        if limit_val > 1000:
            clean_sql = re.sub(r'\bLIMIT\s+\d+\b', 'LIMIT 1000', clean_sql, flags=re.IGNORECASE)
            security_metadata["limit_enforced"] = True

    return True, clean_sql, "", security_metadata
