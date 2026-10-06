import time
import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)

def test_password_hashing_and_verification():
    raw_pw = "SuperSecretPassword2026!"
    hashed = hash_password(raw_pw)
    assert "$" in hashed
    parts = hashed.split("$")
    assert len(parts) == 2
    assert len(parts[0]) == 32  # 16-byte hex salt

    assert verify_password(raw_pw, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False

def test_password_salt_uniqueness():
    pw = "same_password"
    hash1 = hash_password(pw)
    hash2 = hash_password(pw)
    assert hash1 != hash2  # Unique salt per hash
    assert verify_password(pw, hash1) is True
    assert verify_password(pw, hash2) is True

def test_access_token_creation_and_decoding():
    payload = {"sub": "analyst_jane", "role": "analyst"}
    token = create_access_token(payload, expires_in_seconds=3600)
    assert isinstance(token, str)
    assert "." in token

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "analyst_jane"
    assert decoded["role"] == "analyst"
    assert "exp" in decoded

def test_access_token_tamper_rejection():
    payload = {"sub": "analyst_jane", "role": "analyst"}
    token = create_access_token(payload, expires_in_seconds=3600)
    parts = token.split(".")
    
    # Tamper with signature
    tampered_sig = parts[0] + "." + parts[1][:-2] + "xx"
    assert decode_access_token(tampered_sig) is None

    # Tamper with payload
    tampered_payload = "eyJzdWIiOiAiYWRtaW4ifQ." + parts[1]
    assert decode_access_token(tampered_payload) is None

def test_access_token_expiration_rejection():
    payload = {"sub": "expired_user", "role": "viewer"}
    # Token already expired 10 seconds ago
    token = create_access_token(payload, expires_in_seconds=-10)
    decoded = decode_access_token(token)
    assert decoded is None
