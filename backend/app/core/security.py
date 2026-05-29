"""Encryption utilities for securing uploaded files and sensitive data."""
from cryptography.fernet import Fernet
from app.core.config import get_settings


def get_cipher() -> Fernet:
    key = get_settings().FILE_ENCRYPTION_KEY
    if not key:
        raise RuntimeError("FILE_ENCRYPTION_KEY not set. Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_bytes(data: bytes) -> bytes:
    return get_cipher().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return get_cipher().decrypt(token)

