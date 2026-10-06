import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(prefix="/api/workspaces", tags=["Multi-Tenant Workspaces"])

class CreateWorkspaceRequest(BaseModel):
    name: str
    description: Optional[str] = None

def seed_default_workspace(db: Session) -> Workspace:
    """Ensure at least one default workspace exists."""
    default_ws = db.query(Workspace).filter(Workspace.id == 1).first()
    if not default_ws:
        default_ws = Workspace(
            id=1,
            name="Default Workspace",
            slug="default-workspace",
            description="Primary organization workspace",
            created_at=datetime.utcnow()
        )
        db.add(default_ws)
        db.commit()
        db.refresh(default_ws)
    return default_ws

@router.get("")
def list_workspaces(db: Session = Depends(get_db)):
    """List all available workspaces."""
    seed_default_workspace(db)
    workspaces = db.query(Workspace).order_by(Workspace.created_at.asc()).all()
    results = []
    for ws in workspaces:
        member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
        results.append({
            "id": ws.id,
            "name": ws.name,
            "slug": ws.slug,
            "description": ws.description,
            "member_count": max(1, member_count),
            "created_at": ws.created_at
        })
    return results

@router.post("", status_code=status.HTTP_201_CREATED)
def create_workspace(req: CreateWorkspaceRequest, db: Session = Depends(get_db)):
    """Create a new isolated organization workspace."""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is required.")

    clean_name = req.name.strip()
    slug = re.sub(r'[^a-zA-Z0-9]', '-', clean_name.lower()).strip('-')
    if not slug:
        slug = f"ws-{int(datetime.utcnow().timestamp())}"

    # Check collision
    existing = db.query(Workspace).filter(Workspace.slug == slug).first()
    if existing:
        slug = f"{slug}-{int(datetime.utcnow().timestamp())}"

    ws = Workspace(
        name=clean_name,
        slug=slug,
        description=req.description,
        created_at=datetime.utcnow()
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)

    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "description": ws.description,
        "member_count": 1,
        "created_at": ws.created_at
    }

@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, db: Session = Depends(get_db)):
    """Delete an organization workspace (except primary default workspace)."""
    if workspace_id == 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete default primary workspace.")
    
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
        
    db.delete(ws)
    db.commit()
    return {"success": True, "message": f"Workspace '{ws.name}' deleted successfully."}

class AddMemberRequest(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: str = "analyst"

@router.get("/{workspace_id}/members")
def list_workspace_members(workspace_id: int, db: Session = Depends(get_db)):
    """List all members of a workspace."""
    from app.models.user import User
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    results = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        results.append({
            "id": m.id,
            "user_id": m.user_id,
            "username": user.username if user else "Unknown",
            "email": user.email if user else "",
            "full_name": user.full_name if user else "",
            "role": m.role,
            "joined_at": m.joined_at
        })
    return results

@router.post("/{workspace_id}/members", status_code=status.HTTP_201_CREATED)
def add_workspace_member(workspace_id: int, req: AddMemberRequest, db: Session = Depends(get_db)):
    """Add a user as a member of a workspace."""
    from app.models.user import User
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
        
    user = None
    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
    elif req.username:
        user = db.query(User).filter(User.username == req.username.strip()).first()
        
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
    # Check if already a member
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id
    ).first()
    if existing:
        existing.role = req.role
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "message": "Member role updated.", "user_id": user.id, "role": existing.role}
        
    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user.id,
        role=req.role or "analyst",
        joined_at=datetime.utcnow()
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "message": "Member added successfully.", "user_id": user.id, "role": member.role}

@router.delete("/{workspace_id}/members/{member_id}")
def remove_workspace_member(workspace_id: int, member_id: int, db: Session = Depends(get_db)):
    """Remove a user from workspace."""
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.id == member_id,
        WorkspaceMember.workspace_id == workspace_id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member record not found.")
    db.delete(member)
    db.commit()
    return {"success": True, "message": "Member removed from workspace."}

