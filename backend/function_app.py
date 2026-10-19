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
You are an elite ATS (Applicant Tracking System) evaluator, technical recruiter, and AI-content detection specialist.
Analyze this resume in detail{', specifically comparing it against the Target Job Description below' if job_desc else ''}.

{job_desc_section}

Resume Text:
{extracted_text}

CRITICAL AUDIT REQUIREMENTS:
1. ATS Evaluation: Compute realistic ats_score (0-100), executive summary, 4-pillar score_breakdown (keywords, formatting, impact_metrics, experience_fit), skills, missing_skills, prioritized suggestions, and bullet_rewrites (with reason and improved metrics).
2. AI-Generated Content & Detection Audit:
   - Many companies and recruiter ATS filters now screen and reject resumes written with AI tools (ChatGPT, etc.) because they sound robotic, inflated, and formulaic.
   - Scan the resume for AI hallmarks: overused AI buzzwords ('spearheaded', 'leveraged', 'pivotal', 'fostered synergy', 'testament to', 'cutting-edge', 'robust', 'seamless', 'delved'), uniform sentence cadence, significance inflation, and lack of authentic engineer voice.
   - Provide 'ai_detection' with:
     - 'ai_likelihood_score' (int 0-100: percentage likelihood of AI involvement)
     - 'risk_level' ('Low' if <30, 'Moderate' if 30-65, 'High' if >65)
     - 'verdict' (2-sentence recruiter assessment of AI vs authentic human practitioner phrasing)
     - 'flagged_ai_phrases' (list of 2-4 specific phrases from the resume that trigger AI screeners, why they trigger, and humanized practitioner replacements)
     - 'humanization_tips' (2-3 concrete tips to make the resume sound authentically written by an engineer)
3. Enhanced & Tailored Resume:
   - Generate a complete, polished, ATS-optimized version of the resume in 'enhanced_resume_markdown'.
   - Seamlessly integrate the missing skills/requirements into the candidate's actual job bullets and skills sections naturally, without awkward keyword stuffing.
   - Strip out AI buzzwords and rewrite bullets with authentic engineering specifics and quantifiable impacts (Google X-Y-Z formula).
   - Format cleanly in Markdown with standard headers (# Name, Contact, ## Summary, ## Technical Skills, ## Professional Experience, ## Education).

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
  "ai_detection": {{
    "ai_likelihood_score": 70,
    "risk_level": "High",
    "verdict": "2-sentence recruiter assessment of AI vs authentic human phrasing.",
    "flagged_ai_phrases": [
      {{
        "phrase": "Exact quoted phrase or sentence from resume",
        "reason": "Why automated AI filters or recruiters flag this",
        "humanized_replacement": "Direct, authentic human practitioner phrasing"
      }}
    ],
    "humanization_tips": [
      "Concrete rule 1 to humanize the resume and pass AI detectors",
      "Concrete rule 2"
    ]
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
    }}
  ],
  "enhanced_resume_markdown": "# Candidate Name\\nRole | Email | Phone\\n\\n## Summary\\n...\\n\\n## Technical Skills\\n...\\n\\n## Professional Experience\\n...\\n\\n## Education\\n..."
}}
"""

        response = ai_client.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": "You are an ATS evaluator, recruiter, and AI detection specialist. You always return strict JSON."},
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
            if "ai_detection" not in parsed:
                parsed["ai_detection"] = {
                    "ai_likelihood_score": 25,
                    "risk_level": "Low",
                    "verdict": "Authentic human phrasing detected with natural practitioner cadence.",
                    "flagged_ai_phrases": [],
                    "humanization_tips": ["Keep bullet points grounded with concrete project metrics."]
                }
            if "enhanced_resume_markdown" not in parsed:
                parsed["enhanced_resume_markdown"] = ""
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