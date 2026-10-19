import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Footer from "./Footer/Footer";
import "./App.css";

// 🌟 Realistic Sample Data for "Try Demo Resume"
const DEMO_RESUME_TEXT = `Alex Morgan
Senior Full Stack Engineer | alex.morgan@email.com | (555) 019-2834 | linkedin.com/in/alexmorgan | github.com/alexm

SUMMARY
Results-driven Senior Full Stack Engineer with 6+ years of experience architecting scalable cloud platforms, distributed microservices, and high-performance React applications. Proven track record of improving site speed by 40% and reducing cloud infrastructure costs.

TECHNICAL SKILLS
- Languages: Python, JavaScript (ES6+), TypeScript, SQL, HTML5, CSS3
- Frameworks & Libraries: React, Node.js, FastAPI, Next.js, Express, Redux Toolkit
- Cloud & DevOps: Microsoft Azure (Functions, App Services, Key Vault), Docker, CI/CD, Git, GitHub Actions
- Databases: PostgreSQL, MongoDB, Redis
- Testing & Methodologies: Jest, PyTest, RESTful APIs, Agile/Scrum

PROFESSIONAL EXPERIENCE
Senior Software Engineer | CloudScale Systems, San Francisco, CA (2022 - Present)
- Architected and deployed serverless microservices using Python and Azure Functions, handling 25M+ requests daily with 99.98% uptime.
- Led frontend modernization with React, TypeScript, and state management, increasing Core Web Vitals score by 42%.
- Built automated CI/CD pipelines with GitHub Actions, reducing release deployment cycle times from 2 days to 30 minutes.
- Mentored 6 mid-level and junior developers and spearheaded bi-weekly architectural design reviews.

Software Engineer | DataPulse Technologies, Austin, TX (2019 - 2022)
- Built customer-facing analytics dashboards in React and Redux, improving user retention by 28%.
- Developed high-throughput REST APIs using Python and FastAPI, interfacing with PostgreSQL and Redis cache layers.
- Reduced database query latency by 35% through indexing optimizations and connection pooling.
- Collaborated with product designers to implement responsive, accessible UI components adhering to WCAG 2.1 AA.

EDUCATION
Bachelor of Science in Computer Science | University of Texas at Austin (2015 - 2019)
`;

const DEMO_JOB_DESCRIPTION = `Senior Full Stack Engineer
We are seeking an experienced Senior Full Stack Engineer to lead the design and development of our cloud-based SaaS platform.

Requirements:
- 5+ years of software engineering experience in Python and modern React (Hooks, Context, TypeScript).
- Hands-on experience designing and operating cloud workloads on Microsoft Azure or AWS.
- Proficiency in designing clean RESTful and GraphQL APIs with PostgreSQL or MongoDB.
- Strong knowledge of containerization with Docker, Kubernetes, and automated CI/CD pipelines.
- Experience with unit and integration testing (Jest, PyTest) and performance profiling.
- Strong communication skills and experience mentoring engineers.
`;

function App() {
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJdInput, setShowJdInput] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("breakdown"); // breakdown, skills, rewrites, suggestions
  const [resumeViewMode, setResumeViewMode] = useState("formatted"); // "formatted" or "markdown"
  const [toastMessage, setToastMessage] = useState(null);

  // 🌓 Theme Management (Default to dark, persist in localStorage)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("ats_theme");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ats_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 📂 Dropzone Configuration
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResumeText("");
      setIsDemoActive(false);
      setError(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
  });

  // ⚡ Load Demo Resume
  const loadDemoResume = (e) => {
    if (e) e.stopPropagation();
    setFile(null);
    setResumeText(DEMO_RESUME_TEXT);
    setJobDescription(DEMO_JOB_DESCRIPTION);
    setShowJdInput(true);
    setIsDemoActive(true);
    setError(null);
    setResult(null);
    showToast("Loaded Alex Morgan's Demo Resume & Job Description!");
  };

  const clearSelection = (e) => {
    if (e) e.stopPropagation();
    setFile(null);
    setResumeText("");
    setIsDemoActive(false);
    setError(null);
  };

  // 🚀 Analyze Resume Request
  const analyzeResume = async () => {
    if (!file && !resumeText) {
      setError("Please upload a resume file or try the demo resume.");
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingStep(1);

    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    try {
      let payload = {
        job_description: jobDescription.trim(),
      };

      if (resumeText) {
        payload.resume_text = resumeText;
      } else if (file) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
        payload.file = base64;
      }

      const apiUrl = process.env.REACT_APP_API_URL || "https://ajf-resume-analyzer-flex.azurewebsites.net/api/analyze_resume";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMessage = "Server returned error status " + response.status;
        try {
          const errData = await response.json();
          if (errData && errData.error) errMessage = errData.error;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const data = await response.json();
      setResult(data);
      setActiveTab("breakdown");
      showToast("Analysis complete!");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error analyzing resume. Please ensure file is valid.");
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  };

  // 📋 Copy Full Report to Clipboard
  const copyReportToClipboard = () => {
    if (!result) return;
    const text = `
# ATS Resume Audit Report
Overall ATS Score: ${result.ats_score || 0}/100

Summary:
${result.summary || "N/A"}

## Score Breakdown:
- Keywords & Skills: ${result.score_breakdown?.keywords?.score || 0}/100 - ${result.score_breakdown?.keywords?.feedback || ""}
- Formatting: ${result.score_breakdown?.formatting?.score || 0}/100 - ${result.score_breakdown?.formatting?.feedback || ""}
- Quantifiable Metrics: ${result.score_breakdown?.impact_metrics?.score || 0}/100 - ${result.score_breakdown?.impact_metrics?.feedback || ""}
- Seniority Fit: ${result.score_breakdown?.experience_fit?.score || 0}/100 - ${result.score_breakdown?.experience_fit?.feedback || ""}

## AI Content & Authenticity Scan:
- AI Likelihood: ${result.ai_detection?.ai_likelihood_score || 0}% (${result.ai_detection?.risk_level || "N/A"})
- Verdict: ${result.ai_detection?.verdict || "N/A"}

## Skills Found:
${(result.skills || []).join(", ")}

## Missing / Recommended Skills:
${(result.missing_skills || []).join(", ")}

## Suggestions:
${(result.suggestions || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(text);
    showToast("Full report copied to clipboard!");
  };

  // 👤 Candidate Name Helper
  const getCandidateName = () => {
    if (!result?.enhanced_resume_markdown) return "Candidate";
    const match = result.enhanced_resume_markdown.match(/^#\s+([^\n\r]+)/m);
    return match ? match[1].replace(/[^\w\s-]/g, "").trim() : "Candidate";
  };

  // 📝 Convert Markdown into clean semantic HTML for Word export & Formatted View
  const convertMarkdownToHtml = (md) => {
    if (!md) return "";
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="resume-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="resume-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="resume-h1">$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullets
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="resume-li">$1</li>');
    html = html.replace(/(<li[\s\S]*?<\/li>)/gm, '<ul class="resume-ul">$1</ul>');
    html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');

    // Paragraphs / line breaks
    html = html.split('\n\n').map((p) => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<li')) return p;
      return `<p class="resume-p">${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    return html;
  };

  // 💾 Download Markdown Audit Report
  const downloadReport = () => {
    if (!result) return;
    const text = `# ATS Resume Score Report\n\nOverall Score: ${result.ats_score}/100\n\n${result.summary}\n\nAI Likelihood: ${result.ai_detection?.ai_likelihood_score || 0}% (${result.ai_detection?.risk_level || "N/A"})\n${result.ai_detection?.verdict || ""}\n\nGenerated by AI Resume Analyzer.`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ATS_Score_Report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded report as Markdown!");
  };

  // 📥 Download Auto-Updated Resume (.doc Word, .md, .txt)
  const downloadEnhancedResume = (format = "doc") => {
    if (!result || !result.enhanced_resume_markdown) {
      showToast("Updated resume is not ready yet.");
      return;
    }
    const candidateName = getCandidateName();
    const safeName = candidateName.replace(/\s+/g, "_");
    const rawText = result.enhanced_resume_markdown;

    if (format === "doc") {
      const htmlBody = convertMarkdownToHtml(rawText);
      const wordDocument = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${candidateName} - Updated Resume</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { margin: 0.8in; size: letter; }
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.45; color: #1e293b; background: #ffffff; }
    h1 { font-size: 20pt; color: #0f172a; margin-bottom: 4pt; font-weight: bold; border-bottom: 2pt solid #0f172a; padding-bottom: 4pt; }
    h2 { font-size: 13pt; color: #0284c7; margin-top: 14pt; margin-bottom: 4pt; text-transform: uppercase; border-bottom: 1pt solid #cbd5e1; padding-bottom: 2pt; font-weight: bold; }
    h3 { font-size: 11.5pt; color: #1e293b; margin-top: 8pt; margin-bottom: 2pt; font-weight: bold; }
    p { margin: 3pt 0; }
    ul { margin: 4pt 0 8pt 20pt; padding: 0; }
    li { margin-bottom: 3pt; }
    strong { font-weight: bold; color: #0f172a; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
      const blob = new Blob(['\ufeff' + wordDocument], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_Auto_Updated_Resume.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded Word Document (.doc) for ${candidateName}!`);
    } else if (format === "md") {
      const blob = new Blob([rawText], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_Auto_Updated_Resume.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded Markdown (.md) for ${candidateName}!`);
    } else if (format === "txt") {
      const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_Auto_Updated_Resume.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded Plain Text (.txt) for ${candidateName}!`);
    }
  };

  // 🖨️ Print / Save as PDF
  const printEnhancedResume = () => {
    if (!result || !result.enhanced_resume_markdown) {
      showToast("Updated resume is not ready yet.");
      return;
    }
    const candidateName = getCandidateName();
    const htmlBody = convertMarkdownToHtml(result.enhanced_resume_markdown);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Please allow popups to print/save as PDF");
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${candidateName} - Updated Resume</title>
  <style>
    @page { margin: 0.7in; size: letter; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111827; line-height: 1.45; font-size: 10.5pt; margin: 0; padding: 24px; background: #fff; }
    h1 { font-size: 20pt; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
    h2 { font-size: 12.5pt; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h3 { font-size: 11pt; font-weight: 600; color: #1e293b; margin: 10px 0 3px 0; }
    p { margin: 4px 0; }
    ul { margin: 4px 0 10px 20px; padding: 0; }
    li { margin-bottom: 4px; }
    strong { font-weight: 600; color: #0f172a; }
  </style>
</head>
<body>
  ${htmlBody}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
    showToast("Opened print preview (choose 'Save as PDF' to export PDF)!");
  };

  // 📋 Copy Enhanced Resume to Clipboard
  const copyEnhancedResume = () => {
    if (!result || !result.enhanced_resume_markdown) return;
    navigator.clipboard.writeText(result.enhanced_resume_markdown);
    showToast("Copied Auto-Updated Resume to clipboard!");
  };

  // 🎨 Score Colors & Helpers
  const getScoreColor = (score) => {
    if (score >= 80) return "var(--accent-success)";
    if (score >= 60) return "var(--accent-warning)";
    return "var(--accent-danger)";
  };

  const getScoreBadgeText = (score) => {
    if (score >= 85) return "Excellent ATS Match";
    if (score >= 70) return "Competitive Alignment";
    if (score >= 50) return "Moderate Gaps";
    return "Needs Significant Optimization";
  };

  const getAiRiskColor = (score) => {
    if (score < 35) return "var(--accent-success)";
    if (score < 65) return "var(--accent-warning)";
    return "var(--accent-danger)";
  };

  const getAiRiskBadge = (score) => {
    if (score < 35) return "Low AI Risk • Authentic Human Voice";
    if (score < 65) return "Moderate AI Risk • AI-Assisted Phrasing";
    return "High AI Risk • ATS Rejection Risk";
  };

  // Circular SVG Gauge values
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const currentScore = result ? result.ats_score || 0 : 0;
  const strokeDashoffset = circumference - (currentScore / 100) * circumference;

  return (
    <div className="app-wrapper">
      {/* 🧭 Sticky Minimalist Navbar */}
      <header className="app-navbar">
        <div className="brand-section">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h1 className="brand-name">ATS Resume Analyzer</h1>
          </div>
          <span className="brand-badge">GPT-4.1 Mini • Flex</span>
        </div>

        <div className="navbar-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle Light/Dark Theme"
            title="Toggle Light/Dark Theme"
          >
            {theme === "dark" ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Light
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Dark
              </>
            )}
          </button>
        </div>
      </header>

      {/* 🚀 Main App Body */}
      <main className="app-main">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-pill">
            <span className="hero-pill-indicator"></span>
            Automated ATS Parsing & Keyword Analysis
          </div>
          <h2 className="hero-title">
            Land more interviews with <span>AI Resume Optimization</span>
          </h2>
          <p className="hero-description">
            Evaluate your resume against real applicant tracking system filters. Detect missing skills, uncover formatting weaknesses, and get bullet point rewrites in seconds.
          </p>
        </div>

        {/* 📥 Upload & Input Card */}
        <section className="card-container">
          <div
            {...getRootProps()}
            className={`dropzone-container ${isDragActive ? "is-active" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="dropzone-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="dropzone-title">
              {isDragActive ? "Drop your resume file here" : "Drag and drop your resume file"}
            </h3>
            <p className="dropzone-subtitle">
              Supports PDF, DOC, and DOCX (up to 10MB) &bull;{" "}
              <button
                type="button"
                className="demo-btn-link"
                onClick={loadDemoResume}
              >
                ⚡ Try Demo Resume
              </button>
            </p>

            {/* Selected File / Demo Pill */}
            {(file || isDemoActive) && (
              <div className="selected-file-pill" onClick={(e) => e.stopPropagation()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{file ? file.name : "Loaded: Alex Morgan (Senior Full Stack Engineer)"}</span>
                <button
                  type="button"
                  className="file-clear-btn"
                  onClick={clearSelection}
                  title="Remove file"
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* 🎯 Target Job Description Accordion */}
          <div className="jd-section">
            <div
              className="jd-toggle-header"
              onClick={() => setShowJdInput(!showJdInput)}
            >
              <span>
                🎯 Target Job Description <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional &bull; Highly Recommended)</small>
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--accent-primary)" }}>
                {showJdInput ? "Hide ▲" : "Paste Job Description ▼"}
              </span>
            </div>

            {showJdInput && (
              <div className="jd-content-body">
                <textarea
                  className="jd-textarea"
                  placeholder="Paste the target job description or job posting here (e.g. Senior Software Engineer at Stripe, required skills: React, Python, Azure)..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                <div className="jd-hint">
                  <span>Enables exact keyword matching and custom skill gap calculation.</span>
                  <span>{jobDescription.length} characters</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="loading-box">
              <div className="spinner"></div>
              <div className="loading-text">
                {loadingStep === 1 && "Extracting text with Azure Document Intelligence..."}
                {loadingStep === 2 && "Auditing ATS keywords, formatting & metrics..."}
                {loadingStep >= 3 && "Synthesizing AI bullet point rewrites & recommendations..."}
              </div>
              <div className="loading-subtext">This typically takes 3 to 6 seconds.</div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="action-controls">
            <button
              className="btn-primary"
              disabled={loading || (!file && !resumeText)}
              onClick={analyzeResume}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {loading ? "Analyzing Resume..." : "Analyze Resume"}
            </button>

            {!file && !resumeText && (
              <button
                type="button"
                className="btn-secondary"
                onClick={loadDemoResume}
              >
                ⚡ Try Demo
              </button>
            )}
          </div>
        </section>

        {/* 📊 Results Dashboard */}
        {result && (
          <section className="results-card" id="results-view">
            {/* Top Overview Bar */}
            <div className="results-topbar">
              <div className="score-overview">
                {/* Circular Score Gauge */}
                <div className="gauge-circle">
                  <svg className="gauge-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} className="gauge-bg" />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="gauge-fill"
                      style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: strokeDashoffset,
                        stroke: getScoreColor(result.ats_score || 0),
                      }}
                    />
                  </svg>
                  <div className="gauge-text">
                    <div className="gauge-number">{result.ats_score || 0}</div>
                    <div className="gauge-label">ATS Score</div>
                  </div>
                </div>

                <div className="score-meta">
                  <span
                    className="score-badge"
                    style={{
                      backgroundColor: `${getScoreColor(result.ats_score || 0)}20`,
                      color: getScoreColor(result.ats_score || 0),
                      border: `1px solid ${getScoreColor(result.ats_score || 0)}`,
                    }}
                  >
                    {getScoreBadgeText(result.ats_score || 0)}
                  </span>
                  <h3 className="summary-heading">Executive Assessment</h3>
                  <p className="summary-text">{result.summary || "Evaluation completed."}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="results-action-btns">
                <button
                  className="btn-primary-action"
                  onClick={() => downloadEnhancedResume("doc")}
                  title="Download complete auto-updated resume as Microsoft Word document"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  📥 Download Updated Resume (.doc)
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => downloadEnhancedResume("md")}
                  title="Download complete auto-updated resume as Markdown"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  .md
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => downloadEnhancedResume("txt")}
                  title="Download complete auto-updated resume as Plain Text"
                >
                  .txt
                </button>

                <button
                  className="btn-secondary"
                  onClick={printEnhancedResume}
                  title="Print or Save as PDF"
                >
                  🖨️ PDF
                </button>

                <button
                  className="btn-secondary"
                  onClick={copyEnhancedResume}
                  title="Copy complete auto-updated resume text"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Resume
                </button>

                <button
                  className="btn-secondary"
                  onClick={downloadReport}
                  title="Download ATS Score Report (.md)"
                >
                  📊 Report .md
                </button>

                <button
                  className="btn-secondary"
                  onClick={copyReportToClipboard}
                  title="Copy ATS Score Audit Summary to clipboard"
                >
                  📋 Report
                </button>
              </div>
            </div>

            {/* ⚡ Auto-Updated Complete Resume Callout Banner */}
            {result.enhanced_resume_markdown && (
              <div className="updated-resume-callout-banner">
                <div className="callout-badge-row">
                  <span className="callout-pill">✨ Auto-Updated Resume Ready</span>
                  {result.missing_skills && result.missing_skills.length > 0 && (
                    <span className="callout-tag">
                      +{result.missing_skills.length} Missing Requirements Added
                    </span>
                  )}
                  <span className="callout-tag-humanized">
                    🛡️ AI Buzzwords Humanized
                  </span>
                </div>
                <div className="callout-main-flex">
                  <div className="callout-text">
                    <h4>Your Full Resume Has Been Auto-Updated with All Recommendations</h4>
                    <p>
                      We reconstructed your complete career history: strengthening weak bullets with measurable metrics, integrating your missing requirements{" "}
                      {result.missing_skills && result.missing_skills.length > 0 && (
                        <strong>({result.missing_skills.slice(0, 3).join(", ")}{result.missing_skills.length > 3 ? "..." : ""})</strong>
                      )}, and purging robotic AI cliches so recruiters and automated screeners greenlight your application.
                    </p>
                  </div>
                  <div className="callout-btn-group">
                    <button
                      className="callout-btn-primary"
                      onClick={() => downloadEnhancedResume("doc")}
                      title="Download as Microsoft Word document (.doc)"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download Word (.doc)
                    </button>
                    <button
                      className="callout-btn-secondary"
                      onClick={() => downloadEnhancedResume("md")}
                      title="Download Markdown resume"
                    >
                      Download .md
                    </button>
                    <button
                      className="callout-btn-secondary"
                      onClick={() => downloadEnhancedResume("txt")}
                      title="Download plain text resume"
                    >
                      Download .txt
                    </button>
                    <button
                      className="callout-btn-preview"
                      onClick={() => {
                        setActiveTab("enhanced_resume");
                        const tabEl = document.querySelector(".tabs-navigation");
                        if (tabEl) tabEl.scrollIntoView({ behavior: "smooth" });
                      }}
                      title="Preview full updated resume document"
                    >
                      👁️ Preview Full Resume ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Scorecard Metric Breakdown Cards */}
            {result.score_breakdown && (
              <div className="breakdown-grid">
                {Object.entries(result.score_breakdown).map(([key, item]) => (
                  <div key={key} className="breakdown-card">
                    <div className="breakdown-header">
                      <span className="breakdown-title">{item.label || key}</span>
                      <span
                        className="breakdown-score"
                        style={{ color: getScoreColor(item.score) }}
                      >
                        {item.score}/100
                      </span>
                    </div>
                    <div className="metric-bar-bg">
                      <div
                        className="metric-bar-fill"
                        style={{
                          width: `${item.score}%`,
                          backgroundColor: getScoreColor(item.score),
                        }}
                      />
                    </div>
                    <p className="breakdown-feedback">{item.feedback}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="tabs-navigation">
              <button
                className={`tab-btn ${activeTab === "breakdown" ? "is-active" : ""}`}
                onClick={() => setActiveTab("breakdown")}
              >
                <span>🎯</span> Skills & Keywords
              </button>
              <button
                className={`tab-btn ${activeTab === "ai_detector" ? "is-active" : ""}`}
                onClick={() => setActiveTab("ai_detector")}
              >
                <span>🛡️</span> AI Content & Authenticity Scan {result.ai_detection ? `(${result.ai_detection.ai_likelihood_score || 0}%)` : ""}
              </button>
              <button
                className={`tab-btn ${activeTab === "enhanced_resume" ? "is-active" : ""}`}
                onClick={() => setActiveTab("enhanced_resume")}
              >
                <span>📄</span> Auto-Updated Resume
              </button>
              <button
                className={`tab-btn ${activeTab === "rewrites" ? "is-active" : ""}`}
                onClick={() => setActiveTab("rewrites")}
              >
                <span>✨</span> Bullet Rewriter {result.bullet_rewrites?.length ? `(${result.bullet_rewrites.length})` : ""}
              </button>
              <button
                className={`tab-btn ${activeTab === "suggestions" ? "is-active" : ""}`}
                onClick={() => setActiveTab("suggestions")}
              >
                <span>💡</span> Actionable Checklist {result.suggestions?.length ? `(${result.suggestions.length})` : ""}
              </button>
            </div>

            {/* Tab 1: Skills Breakdown */}
            {activeTab === "breakdown" && (
              <div className="skills-tab-content">
                <div className="skills-column">
                  <h4 className="column-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Skills & Competencies Found ({result.skills?.length || 0})
                  </h4>
                  <div className="tag-list">
                    {result.skills && result.skills.length > 0 ? (
                      result.skills.map((skill, idx) => (
                        <span key={idx} className="tag-badge match">
                          ✓ {skill}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>No technical skills clearly detected.</span>
                    )}
                  </div>
                </div>

                <div className="skills-column">
                  <h4 className="column-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warning)" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Missing / Recommended Keywords ({result.missing_skills?.length || 0})
                  </h4>
                  <div className="tag-list">
                    {result.missing_skills && result.missing_skills.length > 0 ? (
                      result.missing_skills.map((skill, idx) => (
                        <span key={idx} className="tag-badge missing">
                          + {skill}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>No missing keywords detected.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: AI Content & Authenticity Scan */}
            {activeTab === "ai_detector" && (
              <div className="ai-detector-tab-content">
                <div className="ai-detector-hero-card">
                  <div className="ai-gauge-badge-row">
                    <div
                      className="ai-score-pill"
                      style={{
                        backgroundColor: `${getAiRiskColor(result.ai_detection?.ai_likelihood_score || 0)}18`,
                        color: getAiRiskColor(result.ai_detection?.ai_likelihood_score || 0),
                        border: `1px solid ${getAiRiskColor(result.ai_detection?.ai_likelihood_score || 0)}`,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>{result.ai_detection?.ai_likelihood_score || 0}% AI Likelihood</span>
                      <span className="ai-risk-tag">&bull; {getAiRiskBadge(result.ai_detection?.ai_likelihood_score || 0)}</span>
                    </div>
                  </div>

                  <h4 className="ai-verdict-title">Recruiter & ATS Screening Verdict</h4>
                  <p className="ai-verdict-text">
                    {result.ai_detection?.verdict || "Resume analyzed for AI hallmarks and machine-generated buzzwords."}
                  </p>

                  <div className="ai-progress-track">
                    <div
                      className="ai-progress-fill"
                      style={{
                        width: `${result.ai_detection?.ai_likelihood_score || 0}%`,
                        backgroundColor: getAiRiskColor(result.ai_detection?.ai_likelihood_score || 0),
                      }}
                    />
                  </div>
                  <div className="ai-track-labels">
                    <span>0% (Authentic Human Practitioner)</span>
                    <span>50% (Mixed / AI-Assisted)</span>
                    <span>100% (High AI Signature / Risk of Rejection)</span>
                  </div>
                </div>

                {/* Flagged AI Cliches */}
                <div className="ai-section-heading">
                  <h4>🚨 Flagged AI Cliches & Tells ({result.ai_detection?.flagged_ai_phrases?.length || 0})</h4>
                  <p>
                    Recruiters and enterprise ATS systems filter out resumes with generic AI buzzwords. Below are the specific phrases flagged in your resume along with authentic, human-sounding replacements:
                  </p>
                </div>

                <div className="ai-phrases-list">
                  {result.ai_detection?.flagged_ai_phrases && result.ai_detection.flagged_ai_phrases.length > 0 ? (
                    result.ai_detection.flagged_ai_phrases.map((item, idx) => (
                      <div key={idx} className="ai-phrase-card">
                        <div className="ai-phrase-comparison">
                          <div className="ai-phrase-col flagged">
                            <span className="col-sublabel">❌ Flagged in Resume (AI Tell)</span>
                            <p className="phrase-text">"{item.phrase}"</p>
                            <span className="phrase-reason">⚠️ {item.reason}</span>
                          </div>
                          <div className="ai-phrase-col humanized">
                            <div className="col-header-row">
                              <span className="col-sublabel">✅ Human Practitioner Alternative</span>
                              <button
                                className="copy-phrase-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.humanized_replacement);
                                  showToast("Copied humanized phrase!");
                                }}
                                title="Copy humanized phrase"
                              >
                                Copy
                              </button>
                            </div>
                            <p className="phrase-text human">{item.humanized_replacement}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="ai-clean-box">
                      <span>✓ No robotic AI cliches or overused ChatGPT patterns detected! Your resume reads like an authentic practitioner.</span>
                    </div>
                  )}
                </div>

                {/* Humanization Best Practices */}
                {result.ai_detection?.humanization_tips && result.ai_detection.humanization_tips.length > 0 && (
                  <div className="ai-tips-card">
                    <h4>💡 How to Beat Modern AI-Detection Resume Filters</h4>
                    <ul>
                      {result.ai_detection.humanization_tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Auto-Updated Complete Resume */}
            {activeTab === "enhanced_resume" && (
              <div className="enhanced-resume-tab-content">
                <div className="enhanced-resume-hero">
                  <div className="hero-text-content">
                    <div className="enhanced-badge">
                      <span>✨ 100% Complete Auto-Updated Resume</span>
                    </div>
                    <h4>Your Full Resume Auto-Updated with All Recommendations</h4>
                    <p>
                      We reconstructed your complete career history: strengthening weak bullets with quantifiable metrics, seamlessly integrating missing job requirements{" "}
                      {result.missing_skills && result.missing_skills.length > 0 && (
                        <span>
                          (<strong>{result.missing_skills.slice(0, 4).join(", ")}</strong>)
                        </span>
                      )}, and purging robotic AI buzzwords so your resume reads like a seasoned human practitioner.
                    </p>
                  </div>

                  <div className="enhanced-download-toolbar">
                    <button
                      className="btn-download-primary"
                      onClick={() => downloadEnhancedResume("doc")}
                      title="Download as Microsoft Word document (.doc)"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download Word (.doc)
                    </button>

                    <button
                      className="btn-download-secondary"
                      onClick={() => downloadEnhancedResume("md")}
                      title="Download Markdown resume"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Download .md
                    </button>

                    <button
                      className="btn-download-secondary"
                      onClick={() => downloadEnhancedResume("txt")}
                      title="Download plain text resume"
                    >
                      Download .txt
                    </button>

                    <button
                      className="btn-download-secondary"
                      onClick={printEnhancedResume}
                      title="Print or Save as PDF"
                    >
                      🖨️ Print / PDF
                    </button>

                    <button
                      className="btn-download-secondary"
                      onClick={copyEnhancedResume}
                      title="Copy full resume text"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Resume
                    </button>
                  </div>
                </div>

                {/* Incorporated Requirements Chips */}
                {result.missing_skills && result.missing_skills.length > 0 && (
                  <div className="incorporated-skills-bar">
                    <span className="skills-bar-label">Seamlessly Integrated Target Requirements:</span>
                    <div className="incorporated-chips">
                      {result.missing_skills.map((s, idx) => (
                        <span key={idx} className="chip-added">
                          + {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formatted vs Raw Markdown Toggle */}
                <div className="resume-preview-container">
                  <div className="preview-top-bar">
                    <div className="preview-indicator">
                      <span className="dot"></span>
                      <span>Auto-Updated Resume Preview ({resumeViewMode === "formatted" ? "Professional Paper View" : "Raw Markdown"})</span>
                    </div>

                    <div className="view-mode-toggle-group">
                      <button
                        className={`toggle-mode-btn ${resumeViewMode === "formatted" ? "active" : ""}`}
                        onClick={() => setResumeViewMode("formatted")}
                      >
                        📑 Formatted Document
                      </button>
                      <button
                        className={`toggle-mode-btn ${resumeViewMode === "markdown" ? "active" : ""}`}
                        onClick={() => setResumeViewMode("markdown")}
                      >
                        📝 Raw Markdown
                      </button>
                      <button className="copy-preview-btn" onClick={copyEnhancedResume} title="Copy resume text">
                        Copy
                      </button>
                    </div>
                  </div>

                  {resumeViewMode === "formatted" ? (
                    <div
                      className="paper-resume-document"
                      dangerouslySetInnerHTML={{
                        __html: convertMarkdownToHtml(result.enhanced_resume_markdown),
                      }}
                    />
                  ) : (
                    <pre className="resume-code-block">
                      {result.enhanced_resume_markdown || "Enhanced resume generating..."}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: AI Bullet Rewriter */}
            {activeTab === "rewrites" && (
              <div className="rewrites-tab-content">
                {result.bullet_rewrites && result.bullet_rewrites.length > 0 ? (
                  result.bullet_rewrites.map((item, idx) => (
                    <div key={idx} className="rewriter-item">
                      <div className="rewrite-diff-grid">
                        <div className="diff-box original">
                          <div className="diff-label original">
                            <span>❌ Original Bullet</span>
                          </div>
                          <div>{item.original}</div>
                        </div>

                        <div className="diff-box improved">
                          <div className="diff-label improved">
                            <span>✨ ATS-Optimized Rewrite</span>
                          </div>
                          <div style={{ fontWeight: 600 }}>{item.improved}</div>
                        </div>
                      </div>

                      <div className="rewrite-footer">
                        <span><strong>Why this works:</strong> {item.reason}</span>
                        <button
                          className="copy-bullet-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(item.improved);
                            showToast("Copied rewritten bullet to clipboard!");
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copy Rewrite
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No weak bullet points detected for rewrite.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Actionable Suggestions */}
            {activeTab === "suggestions" && (
              <div className="suggestions-tab-content">
                <ul className="suggestions-list">
                  {result.suggestions && result.suggestions.length > 0 ? (
                    result.suggestions.map((s, idx) => (
                      <li key={idx} className="suggestion-item">
                        <span className="suggestion-index">{idx + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))
                  ) : (
                    <li style={{ color: "var(--text-muted)" }}>No additional suggestions at this time.</li>
                  )}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      {/* 🍞 Toast Notice */}
      {toastMessage && (
        <div className="toast-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🔗 Footer */}
      <Footer />
    </div>
  );
}

export default App;