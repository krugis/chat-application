from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import requests
import logging
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    filename='log.txt',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
)

class GenerateRequest(BaseModel):
    message: str
    model: str = Field(
        default='gemini-1.5-flash',
        pattern='^(gemini-1.5-flash|gpt-4o-mini|deepseek)$',
        description="Supported models: gemini-1.5-flash, gpt-4o-mini, deepseek"
    )
    temperature: float = Field(default=0.1, ge=0.0, le=1.0)
    top_p: float = Field(default=0.1, ge=0.0, le=1.0)

def validate_api_keys():
    required_keys = {
        'GEMINI': os.environ.get("GEMINI_API_KEY"),
        'OPENAI': os.environ.get("OPENAI_API_KEY"),
        'DEEPSEEK': os.environ.get("DEEPSEEK_API_KEY")
    }
    
    missing = [k for k, v in required_keys.items() if not v]
    if missing:
        raise ValueError(f"Missing API keys: {', '.join(missing)}")

validate_api_keys()

def get_api_key(service: str) -> str:
    key = os.environ.get(f"{service}_API_KEY")
    if not key:
        raise HTTPException(500, detail=f"{service}_API_KEY not configured")
    return key

@app.post("/api/generate")
async def generate_text(request: GenerateRequest):
    try:
        user_message = request.message.strip()
        if not user_message:
            raise HTTPException(400, "Message cannot be empty")

        model_name = request.model
        temperature = request.temperature
        top_p = request.top_p

        logging.info(f"Processing request - Model: {model_name}, Temp: {temperature}, TopP: {top_p}")

        headers = {"Content-Type": "application/json"}
        request_body = {}
        
        if model_name == "gemini-1.5-flash":
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={get_api_key('GEMINI')}"
            request_body = {
                "contents": [{"parts": [{"text": user_message}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "topP": top_p
                }
            }
        elif model_name == "gpt-4o-mini":
            api_url = "https://api.openai.com/v1/chat/completions"
            headers["Authorization"] = f"Bearer {get_api_key('OPENAI')}"
            request_body = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": user_message}],
                "temperature": temperature
            }
        elif model_name == "deepseek":
            api_url = "https://api.deepseek.com/v1/chat/completions"
            headers["Authorization"] = f"Bearer {get_api_key('DEEPSEEK')}"
            request_body = {
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": user_message}],
                "temperature": temperature,
                "top_p": top_p
            }

        response = requests.post(api_url, headers=headers, json=request_body, timeout=30)
        response.raise_for_status()
        response_data = response.json()
        
        # Process response
        try:
            if model_name == "gemini-1.5-flash":
                # Debugging: Log raw response structure
                logging.debug(f"Raw Gemini response: {json.dumps(response_data, indent=2)}")
                
                # Check for content filtering
                if response_data.get('promptFeedback', {}).get('blockReason'):
                    reason = response_data['promptFeedback']['blockReason']
                    logging.warning(f"Content blocked by Gemini: {reason}")
                    raise HTTPException(400, f"Content blocked: {reason.replace('_', ' ').title()}")

                # Validate response structure
                candidates = response_data.get('candidates', [])
                if not candidates:
                    logging.error("No candidates in response")
                    raise HTTPException(500, "No response generated")

                first_candidate = candidates[0]
                content = first_candidate.get('content', {})
                parts = content.get('parts', [{}])
                
                # Handle multiple parts and different response types
                response_text = ""
                for part in parts:
                    if 'text' in part:
                        response_text += part['text'].strip() + "\n"
                    elif 'functionCall' in part:
                        response_text += f"[Function call: {part['functionCall']['name']}]"
                
                if not response_text.strip():
                    response_text = "Received an empty response. Please try rephrasing your question."

                # Clean up extra newlines
                response_text = response_text.strip()

            else:
                # Existing handling for other models
                if not response_data.get('choices'):
                    logging.error("No choices in response")
                    raise HTTPException(500, "No response generated")

                response_text = response_data['choices'][0]['message'].get('content', '')
                
                if not response_text.strip():
                    logging.warning("Received empty text from model")
                    response_text = "I didn't receive a valid response. Please try again."

            logging.info(f"Final response text: {response_text}")
            return {
                "status": "success",
                "data": {
                    "message": response_text
                }
            }

        except KeyError as e:
            logging.error(f"Missing key in response: {str(e)}")
            logging.error(f"Full response: {response_data}")
            raise HTTPException(500, "Invalid API response format") from e

    except requests.exceptions.HTTPError as e:
        error_content = e.response.text if e.response else "No response"
        logging.error(f"API request failed: {str(e)} - {error_content}")
        raise HTTPException(502, detail="Model API request failed")

    except HTTPException as he:
        raise he

    except Exception as e:
        logging.exception("Unexpected error occurred")
        raise HTTPException(500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)