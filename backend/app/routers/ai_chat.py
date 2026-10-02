"""
AGRiNEX Production AI Assistant Router
Exposes REST and SSE Streaming endpoints for conversational AI, multi-turn history,
controlled tool execution, and high-risk action confirmation.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import json
import uuid

from .. import schemas, models
from ..database import get_db, SessionLocal
from .auth import get_current_user_optional, get_current_user
from ..ai.orchestrator import orchestrate_chat_turn, orchestrate_stream_generator
from ..ai.confirmation import consume_action, cancel_action
from ..ai.tools import execute_tool

router = APIRouter(prefix="/ai", tags=["ai_assistant"])

@router.post("/chat", response_model=schemas.AIChatResponse)
def ai_chat_endpoint(
    req: schemas.AIChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    Standard Non-Streaming Chat Endpoint
    Persists message in conversation, manages context, and executes tools.
    """
    user_id = current_user.id if current_user else None

    # 1. Resolve or create conversation
    conv = None
    if req.conversation_id:
        conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
        
    if not conv:
        # Generate initial title from first 6 words of message
        title_words = req.message.strip().split()[:6]
        title = " ".join(title_words) or "New Agronomic Inquiry"
        conv = models.Conversation(
            user_id=user_id,
            farm_id=req.farm_id,
            title=title
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 2. Save user message
    user_msg_record = models.ChatMessage(
        conversation_id=conv.id,
        role="user",
        content=req.message,
        metadata_json={"page_context": req.page_context} if req.page_context else None
    )
    db.add(user_msg_record)
    db.commit()

    # 3. Build history from DB messages or request
    past_messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_id == conv.id
    ).order_by(models.ChatMessage.created_at.asc()).all()

    history_payload = []
    for pm in past_messages[:-1]: # exclude the newly added user message
        history_payload.append({"role": pm.role, "content": pm.content})

    # 4. Orchestrate chat turn
    turn_res = orchestrate_chat_turn(
        message=req.message,
        db=db,
        user_id=user_id,
        farm_id=req.farm_id or conv.farm_id,
        language=req.language or "en",
        history=history_payload,
        page_context=req.page_context,
        attachment=req.attachment,
        voice_mode=req.voice_mode or False
    )

    # 5. Save assistant reply
    assistant_msg_record = models.ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=turn_res.get("answer", ""),
        tool_calls=turn_res.get("tool_calls"),
        metadata_json={
            "citations": turn_res.get("citations"),
            "confirmation_required": turn_res.get("confirmation_required")
        }
    )
    db.add(assistant_msg_record)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "conversation_id": conv.id,
        "reply": turn_res.get("answer", ""),
        "answer": turn_res.get("answer", ""),
        "tool_calls": turn_res.get("tool_calls"),
        "citations": turn_res.get("citations"),
        "confirmation_required": turn_res.get("confirmation_required"),
        "suggested_questions": [
            "How does this compare to local mandi benchmarks?",
            "What precision irrigation schedule do you recommend?",
            "Can you simulate a 3-day dry spell scenario?"
        ]
    }


@router.post("/chat/stream")
def ai_chat_stream_endpoint(
    req: schemas.AIChatRequest,
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    Real-Time Server-Sent Events (SSE) Streaming Endpoint
    Yields progressive tokens, tool status indicators, and citations.
    """
    user_id = current_user.id if current_user else None

    # Resolve or create conversation
    db = SessionLocal()
    try:
        conv = None
        if req.conversation_id:
            conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
        if not conv:
            title_words = req.message.strip().split()[:6]
            title = " ".join(title_words) or "New Agronomic Inquiry"
            conv = models.Conversation(
                user_id=user_id,
                farm_id=req.farm_id,
                title=title
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)

        # Record user message
        user_msg = models.ChatMessage(
            conversation_id=conv.id,
            role="user",
            content=req.message,
            metadata_json={"page_context": req.page_context} if req.page_context else None
        )
        db.add(user_msg)
        db.commit()

        # Build past history
        past_msgs = db.query(models.ChatMessage).filter(
            models.ChatMessage.conversation_id == conv.id
        ).order_by(models.ChatMessage.created_at.asc()).all()

        history_payload = []
        for pm in past_msgs[:-1]:
            history_payload.append({"role": pm.role, "content": pm.content})

        conv_id = conv.id
        active_farm_id = req.farm_id or conv.farm_id
    finally:
        db.close()

    def sse_event_stream():
        stream_db = SessionLocal()
        accumulated_text = []
        try:
            # Yield conversation ID first
            yield f"event: init\ndata: {json.dumps({'conversation_id': conv_id})}\n\n"

            generator = orchestrate_stream_generator(
                message=req.message,
                db=stream_db,
                user_id=user_id,
                farm_id=active_farm_id,
                language=req.language or "en",
                history=history_payload,
                page_context=req.page_context,
                attachment=req.attachment,
                voice_mode=req.voice_mode or False
            )

            for event_chunk in generator:
                # Accumulate delta text for recording in DB upon stream completion
                if "event: delta" in event_chunk:
                    try:
                        data_part = event_chunk.split("data: ")[1].strip()
                        payload = json.loads(data_part)
                        if "chunk" in payload:
                            accumulated_text.append(payload["chunk"])
                    except Exception:
                        pass
                yield event_chunk

            # Save completed assistant reply to database
            full_reply = "".join(accumulated_text).strip()
            if full_reply:
                asst_msg = models.ChatMessage(
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_reply
                )
                stream_db.add(asst_msg)
                stream_db.commit()

        except Exception as e:
            err_msg = f"Streaming connection interrupted: {str(e)}"
            yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
        finally:
            stream_db.close()

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/action/confirm", response_model=schemas.ActionConfirmResponse)
def confirm_action_endpoint(
    req: schemas.ActionConfirmRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    Two-Step Action Confirmation Handler
    Validates signed action token and executes confirmed operation.
    """
    user_id = current_user.id if current_user else None

    if not req.confirmed:
        cancelled = cancel_action(req.action_token)
        return {
            "success": False,
            "message": "Action cancelled by user. No physical changes were made.",
            "result": None
        }

    # Consume and validate token
    action = consume_action(req.action_token, user_id=user_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action token is invalid, expired, or unauthorized. Please re-initiate the action."
        )

    action_type = action["action_type"]
    params = action["params"]

    if action_type == "trigger_smart_irrigation":
        res = execute_tool(
            name="trigger_smart_irrigation",
            args=params,
            db=db,
            user_id=user_id,
            farm_id=action.get("farm_id"),
            is_confirmed=True
        )
        return {
            "success": True,
            "message": res.get("message", "Smart irrigation pump successfully activated."),
            "result": res
        }

    return {
        "success": True,
        "message": f"Action '{action_type}' executed successfully.",
        "result": params
    }


@router.get("/conversations", response_model=List[schemas.ConversationResponse])
def get_conversations(
    farm_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Retrieve conversation history list for authenticated user or active farm."""
    query = db.query(models.Conversation)
    if current_user:
        query = query.filter(models.Conversation.user_id == current_user.id)
    elif farm_id:
        query = query.filter(models.Conversation.farm_id == farm_id)
        
    conversations = query.order_by(models.Conversation.updated_at.desc()).limit(30).all()
    return conversations


@router.post("/conversations", response_model=schemas.ConversationResponse)
def create_conversation(
    title: Optional[str] = "New Conversation",
    farm_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Create a new empty conversation thread."""
    user_id = current_user.id if current_user else None
    conv = models.Conversation(
        user_id=user_id,
        farm_id=farm_id,
        title=title or "New Conversation"
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations/{conversation_id}", response_model=schemas.ConversationResponse)
def get_conversation_details(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Retrieve a single conversation with all its historical messages."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Check authorization if bound to a user
    if conv.user_id and current_user and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this conversation")

    return conv


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Delete a conversation and all its messages."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.user_id and current_user and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to delete this conversation")

    db.delete(conv)
    db.commit()
    return {"status": "success", "message": "Conversation deleted successfully"}
