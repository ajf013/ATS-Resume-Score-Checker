import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import cgi
import io

app = func.FunctionApp()

@app.route(route="analyze_resume", auth_level=func.AuthLevel.ANONYMOUS)
def analyze_resume(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # 🔐 Key Vault
        kv_url = "https://ajf-resume-kv.vault.azure.net/"
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=kv_url, credential=credential)

        openai_key = client.get_secret("openai-key").value
        openai_endpoint = client.get_secret("openai-endpoint").value
        docintel_key = client.get_secret("docintel-key").value
        docintel_endpoint = client.get_secret("docintel-endpoint").value

        # 📄 Parse file from request (FIXED)
        import base64
        body = req.get_json()
        
        if 'file' not in body:
            return func.HttpResponse("No file uploaded", status_code=400)
            
        base64_str = body['file']
        file_bytes = base64.b64decode(base64_str)

        # 🧠 Extract text
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

        # 🤖 OpenAI
        ai_client = AzureOpenAI(
            api_key=openai_key,
            azure_endpoint=openai_endpoint,
            api_version="2024-02-15-preview"
        )

        prompt = f"""
        Analyze this resume and return JSON exactly in this format:
        {{
            "ats_score": 85,
            "skills": ["Python", "React"],
            "missing_skills": ["Docker", "AWS"],
            "suggestions": ["Add more quantifiable achievements"]
        }}

        Resume:
        {extracted_text}
        """

        response = ai_client.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": "You are an ATS evaluator. You always return JSON."},
                {"role": "user", "content": prompt}
            ]
        )

        return func.HttpResponse(
            response.choices[0].message.content,
            mimetype="application/json"
        )

    except Exception as e:
        return func.HttpResponse(str(e), status_code=500)