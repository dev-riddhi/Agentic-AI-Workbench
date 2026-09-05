from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.features.chat import controller
from app.features.chat.schemas import (
    ChatCreateRequest,
    ConversationResponse,
    ConversationSummary,
    SendMessageRequest,
)
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/chat")


@router.get("/", response_model=list[ConversationSummary], status_code=status.HTTP_200_OK)
def list_conversations(
    model_id: UUID | None = Query(None, description="Filter conversations by AI Model UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.list_conversations_controller(
        db=db,
        user_id=current_user.id,
        model_id=model_id,
    )


@router.post("/", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: ChatCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.create_conversation_controller(
        db=db,
        user_id=current_user.id,
        req=req,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse, status_code=status.HTTP_200_OK)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_conversation_controller(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_200_OK)
def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.delete_conversation_controller(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )


@router.post("/{conversation_id}/messages", response_model=ConversationResponse, status_code=status.HTTP_200_OK)
def send_chat_message(
    conversation_id: UUID,
    req: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.send_message_controller(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
        req=req,
    )


@router.post("/{conversation_id}/stream")
def stream_chat_message(
    conversation_id: UUID,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
):
    event_gen = controller.stream_message_controller(
        user_id=current_user.id,
        conversation_id=conversation_id,
        req=req,
    )
    return StreamingResponse(
        event_gen,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
