import base64
import json
import logging
import os
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI

app = func.FunctionApp()
logger = logging.getLogger(__name__)

# Cache secrets across warm container instances to avoid Key Vault throttling and latency
_secrets_cache = {}

def get_secret(secret_name: str, client: SecretClient) -> str:
    # Check cache first
    if secret_name in _secrets_cache:
        return _secrets_cache[secret_name]
    
    # Check environment variable fallback (e.g. for local settings)
    env_name = secret_name.upper().replace("-", "_")
    if os.environ.get(env_name):
        _secrets_cache[secret_name] = os.environ[env_name]
        return _secrets_cache[secret_name]

    # Fetch from Key Vault
    val = client.get_secret(secret_name).value
    _secrets_cache[secret_name] = val
    return val

@app.route(route="analyze_resume", auth_level=func.AuthLevel.ANONYMOUS)
def analyze_resume(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # 📄 Parse request body
        try:
            body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid request body: expected JSON with 'file' or 'resume_text'"}),
                status_code=400,
                mimetype="application/json"
            )

        if not body or ('file' not in body and 'resume_text' not in body):
            return func.HttpResponse(
                json.dumps({"error": "No resume provided. Send 'file' (base64) or 'resume_text' (string)."}),
                status_code=400,
                mimetype="application/json"
            )

        extracted_text = ""

        # Option A: Direct text passed (e.g. demo mode or pre-extracted text)
        if 'resume_text' in body and body['resume_text'].strip():
            extracted_text = body['resume_text'].strip()
        elif 'file' in body and body['file']:
            base64_str = body['file']
            try:
                file_bytes = base64.b64decode(base64_str)
            except Exception as decode_err:
                return func.HttpResponse(
                    json.dumps({"error": f"Invalid base64 file data: {str(decode_err)}"}),
                    status_code=400,
                    mimetype="application/json"
                )

            # 🔐 Key Vault credentials
            kv_url = os.environ.get("KEY_VAULT_URL", "https://ajf-resume-kv.vault.azure.net/")
            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=kv_url, credential=credential)

            docintel_key = get_secret("docintel-key", client)
            docintel_endpoint = get_secret("docintel-endpoint", client)

            # 🧠 Extract text using Azure Document Intelligence
            doc_client = DocumentAnalysisClient(
                endpoint=docintel_endpoint,
                credential=AzureKeyCredential(docintel_key)
            )

            poller = doc_client.begin_analyze_document(
                "prebuilt-read",
                document=file_bytes
            )

            result = poller.result()

            extracted_text = " ".join(
                [line.content for page in result.pages for line in page.lines]
            )

        if not extracted_text.strip():
            return func.HttpResponse(
                json.dumps({"error": "Unable to extract readable text from document. Ensure it is a valid PDF or Word document."}),
                status_code=400,
                mimetype="application/json"
            )

        # 🔐 Key Vault credentials for OpenAI
        kv_url = os.environ.get("KEY_VAULT_URL", "https://ajf-resume-kv.vault.azure.net/")
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=kv_url, credential=credential)
        openai_key = get_secret("openai-key", client)
        openai_endpoint = get_secret("openai-endpoint", client)

        # Optional Job Description
        job_desc = body.get('job_description', '').strip()
        job_desc_section = f"\nTarget Job Description:\n{job_desc}\n" if job_desc else "\nTarget Role: General Software Engineering & Tech Industry ATS Standards\n"

        # 🤖 OpenAI analysis with enhanced prompt
        ai_client = AzureOpenAI(
            api_key=openai_key,
            azure_endpoint=openai_endpoint,
            api_version="2024-02-15-preview"
        )

        prompt = f"""
You are an elite ATS (Applicant Tracking System) evaluator and technical recruiter.
Analyze this resume in detail{', specifically comparing it against the Target Job Description below' if job_desc else ''}.

{job_desc_section}

Resume Text:
{extracted_text}

Return a valid JSON object matching this schema EXACTLY:
{{
  "ats_score": 82,
  "summary": "2-3 sentence executive assessment summarizing overall candidate suitability and ATS alignment.",
  "score_breakdown": {{
    "keywords": {{
      "score": 85,
      "label": "Keywords & Hard Skills",
      "feedback": "1-2 sentence feedback on technical terms and keyword density."
    }},
    "formatting": {{
      "score": 90,
      "label": "Formatting & Structure",
      "feedback": "Feedback on layout readability, section clarity, and parseability."
    }},
    "impact_metrics": {{
      "score": 65,
      "label": "Measurable Impact & Metrics",
      "feedback": "Feedback on quantifiable metrics, percentages, KPIs, and scale."
    }},
    "experience_fit": {{
      "score": 80,
      "label": "Role & Seniority Fit",
      "feedback": "Feedback on years of experience, leadership, and domain match."
    }}
  }},
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "missing_skills": ["Missing Skill 1", "Missing Skill 2", "Missing Skill 3", "Missing Skill 4"],
  "suggestions": [
    "Prioritized actionable suggestion 1",
    "Prioritized actionable suggestion 2",
    "Prioritized actionable suggestion 3"
  ],
  "bullet_rewrites": [
    {{
      "original": "Weak bullet point from the resume lacking quantifiable results",
      "improved": "Optimized bullet point with active power verb, specific context, and measurable metrics",
      "reason": "Why this rewrite scores higher with ATS algorithms"
    }},
    {{
      "original": "Second weak bullet point from the resume",
      "improved": "Optimized bullet point with metrics and action verbs",
      "reason": "Why this rewrite scores higher with ATS algorithms"
    }}
  ]
}}
"""

        response = ai_client.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": "You are an ATS evaluator. You always return strict JSON."},
                {"role": "user", "content": prompt}
            ]
        )

        content = response.choices[0].message.content or "{}"
        
        # Verify JSON validity and ensure backwards-compatible defaults
        try:
            parsed = json.loads(content)
            if "ats_score" not in parsed:
                parsed["ats_score"] = 75
            if "skills" not in parsed:
                parsed["skills"] = []
            if "missing_skills" not in parsed:
                parsed["missing_skills"] = []
            if "suggestions" not in parsed:
                parsed["suggestions"] = []
            content = json.dumps(parsed)
        except Exception:
            pass

        return func.HttpResponse(
            content,
            mimetype="application/json"
        )

    except Exception as e:
        logger.exception("Error analyzing resume")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )