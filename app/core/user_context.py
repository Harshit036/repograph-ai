from contextvars import ContextVar

_user_id: ContextVar[str] = ContextVar("user_id", default="dev-user")


def set_user_id(uid: str) -> None:
    _user_id.set(uid)


def get_user_id() -> str:
    return _user_id.get()
