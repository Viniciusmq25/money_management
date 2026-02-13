#!/usr/bin/env python3
"""
Script para gerar senha hasheada e chave de criptografia.
Execute este script para gerar os valores necessários para o .env
"""

from passlib.context import CryptContext
from cryptography.fernet import Fernet
import getpass

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main():
    print("=" * 60)
    print("Gerador de Segredos - Money Management")
    print("=" * 60)
    print()

    # Gerar senha hasheada
    print("1. Gerar senha hasheada")
    print("-" * 60)
    password = getpass.getpass("Digite a senha que deseja usar: ")
    password_confirm = getpass.getpass("Confirme a senha: ")

    if password != password_confirm:
        print("❌ Senhas não coincidem!")
        return

    if len(password) < 8:
        print("❌ Senha deve ter pelo menos 8 caracteres!")
        return

    password_hash = pwd_context.hash(password)
    print(f"✅ Hash da senha gerado com sucesso!")
    print()

    # Gerar chave de criptografia
    print("2. Gerar chave de criptografia")
    print("-" * 60)
    encryption_key = Fernet.generate_key().decode()
    print(f"✅ Chave de criptografia gerada com sucesso!")
    print()

    # Exibir valores para o .env
    print("=" * 60)
    print("ADICIONE AS SEGUINTES LINHAS NO SEU ARQUIVO .env:")
    print("=" * 60)
    print()
    print(f"APP_PASSWORD_HASH=\"{password_hash}\"")
    print(f"ENCRYPTION_KEY=\"{encryption_key}\"")
    print()
    print("=" * 60)
    print("⚠️  IMPORTANTE:")
    print("  - Guarde esses valores em local seguro")
    print("  - Não compartilhe essas informações")
    print("  - Se perder a ENCRYPTION_KEY, credenciais criptografadas")
    print("    (como API Binance) serão perdidas")
    print("=" * 60)

if __name__ == "__main__":
    main()
