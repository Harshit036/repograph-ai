from fastapi import APIRouter
from app.services.tree_service import build_tree

router = APIRouter()


@router.get("/repository-tree")
def repository_tree():
    return build_tree()
