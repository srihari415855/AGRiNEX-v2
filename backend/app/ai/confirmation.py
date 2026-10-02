"""
Action Confirmation System for AGRiNEX AI Assistant
Safeguard mechanism for high-risk operations (e.g., pump actuation, bulk updates, data deletion).
Prevents accidental or unauthorized execution by requiring explicit two-step user confirmation.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid

# In-memory storage for active pending action tokens with TTL
# Keys: action_token (str) -> dict
_PENDING_ACTIONS: Dict[str, Dict[str, Any]] = {}

ACTION_TIMEOUT_MINUTES = 5

def create_action_token(
    action_type: str,
    description: str,
    params: Dict[str, Any],
    user_id: Optional[str] = None,
    farm_id: Optional[str] = None,
    risk_level: str = "HIGH"
) -> Dict[str, Any]:
    """Generate a secure, time-bound action token for a high-risk operation."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ACTION_TIMEOUT_MINUTES)
    token = f"act_{uuid.uuid4().hex[:16]}"
    
    action_record = {
        "action_token": token,
        "action_type": action_type,
        "description": description,
        "params": params,
        "user_id": user_id,
        "farm_id": farm_id,
        "risk_level": risk_level,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "PENDING"
    }
    
    _PENDING_ACTIONS[token] = action_record
    
    # Prune expired tokens periodically
    _prune_expired()
    
    return {
        "action_token": token,
        "action_type": action_type,
        "description": description,
        "risk_level": risk_level,
        "expires_in_seconds": ACTION_TIMEOUT_MINUTES * 60,
        "params_preview": {k: v for k, v in params.items() if not k.startswith("_")}
    }

def get_action(token: str) -> Optional[Dict[str, Any]]:
    """Retrieve action record by token."""
    _prune_expired()
    return _PENDING_ACTIONS.get(token)

def consume_action(token: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Validate, verify ownership, and consume an action token.
    Returns the action payload if valid; raises or returns None if invalid/expired.
    """
    _prune_expired()
    action = _PENDING_ACTIONS.get(token)
    if not action:
        return None
        
    if action["status"] != "PENDING":
        return None
        
    # Check expiry
    expires_at = datetime.fromisoformat(action["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        action["status"] = "EXPIRED"
        return None
        
    # If user_id was bound, verify caller is same user
    if action["user_id"] and user_id and action["user_id"] != user_id:
        return None
        
    action["status"] = "CONFIRMED"
    # Remove from pending pool once consumed
    del _PENDING_ACTIONS[token]
    return action

def cancel_action(token: str) -> bool:
    """Cancel a pending action."""
    if token in _PENDING_ACTIONS:
        _PENDING_ACTIONS[token]["status"] = "CANCELLED"
        del _PENDING_ACTIONS[token]
        return True
    return False

def _prune_expired():
    """Remove actions whose TTL has elapsed."""
    now = datetime.now(timezone.utc)
    to_delete = []
    for tok, act in _PENDING_ACTIONS.items():
        try:
            exp = datetime.fromisoformat(act["expires_at"])
            if now > exp:
                to_delete.append(tok)
        except Exception:
            to_delete.append(tok)
    for tok in to_delete:
        if tok in _PENDING_ACTIONS:
            del _PENDING_ACTIONS[tok]
