source .venv/bin/activate
uvicorn main:app --reload --port 8001

curl http://localhost:8001/health

curl -X POST http://localhost:8001/ingest/pdf \
  -H "Content-Type: application/json" \
  -d '{"appCode":"demo","path":"/Users/zeeshansheikh/Documents/inspectionform.pdf","title":"Inspection Form"}'

  curl -X POST http://localhost:8001/generate/form-draft-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"demo",
    "query":"Inspection Form",
    "topK": 8,
    "title":"Inspection Form (AI Draft)",
    "formKey":"inspection_form"
  }'

  curl -X POST http://localhost:8000/generate/form-draft-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"demo",
    "query":"Inspection Form",
    "topK": 8,
    "title":"Inspection Form (AI Draft)",
    "formKey":"inspection_form"
  }'

PDF
 ↓
Text chunks
 ↓
Vector embeddings (pgvector)
 ↓
Semantic search
 ↓
Relevant chunks
 ↓
Schema inference
 ↓
Form Designer
---------
- Inspection Form Ingestion: 
Ingests PDF for an app:
  curl -X POST http://localhost:8000/ingest/pdf \
  -H "Content-Type: application/json" \
  -d '{"appCode":"DEMO01","path":"/Users/zeeshansheikh/Documents/inspectionform.pdf","title":"Inspection Form"}'

Create draft form for an app with the ingested document query:
curl -X POST http://localhost:8000/generate/form-draft-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"DEMO01",
    "query":"Inspection Form",
    "topK": 8,
    "title":"Inspection Form (AI Draft)",
    "formKey":"inspection_form"
  }'

  curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"DEMO01",
    "query":"Inspection Form",
    "topK": 50
  }'


  - Ingest Patient Assessment Form
Ingests PDF for an app:
  curl -X POST http://localhost:8000/ingest/pdf \
  -H "Content-Type: application/json" \
  -d '{"appCode":"DEMO01","path":"/Users/zeeshansheikh/Documents/Patient_Assessment_Form.pdf","title":"Patient Assessment Form"}'

Create draft form for an app with the ingested document query:
curl -X POST http://localhost:8000/generate/form-draft-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"DEMO01",
    "query":"Patient Assessment Form",
    "topK": 20,
    "title":"Patient Assessment Form (AI)",
    "formKey":"patient_assessment_form"
  }'

  curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "appCode":"DEMO01",
    "query":"Patient Assessment Form",
    "topK": 50
  }'
