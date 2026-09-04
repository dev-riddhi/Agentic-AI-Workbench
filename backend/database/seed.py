import hashlib
import getpass
import os
import secrets

from sqlalchemy import select

from database.database import SessionLocal
from database.models.agent import Agent
from database.models.conversation import Conversation
from database.models.document import Document
from database.models.tool import Tool
from database.models.user import User


ADMIN_NAME = "Administrator"
ADMIN_EMAIL = "admin@example.com"


def hash_password(password: str) -> str:
	salt = secrets.token_bytes(16)
	password_hash = hashlib.pbkdf2_hmac(
		"sha256",
		password.encode("utf-8"),
		salt,
		600_000,
	)
	return f"pbkdf2_sha256$600000${salt.hex()}${password_hash.hex()}"


def seed_admin() -> None:
	password = os.getenv("ADMIN_PASSWORD") or getpass.getpass(
		"Admin password: "
	)
	if not password:
		raise RuntimeError("An admin password is required")

	with SessionLocal() as db:
		admin = db.scalar(select(User).where(User.email == ADMIN_EMAIL))

		if admin is None:
			admin = User(
				name=ADMIN_NAME,
				email=ADMIN_EMAIL,
				password_hash=hash_password(password),
			)
			db.add(admin)
			action = "Created"
		else:
			admin.name = ADMIN_NAME
			admin.password_hash = hash_password(password)
			action = "Updated"

		db.commit()
		print(f"{action} admin user: {ADMIN_EMAIL}")


if __name__ == "__main__":
	seed_admin()
