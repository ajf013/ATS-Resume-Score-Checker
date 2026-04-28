import React, { useState, useCallback } from "react";
import { Button, Icon, Message, Segment, Header, Progress, Card, List, Label, Grid } from "semantic-ui-react";
import { useDropzone } from "react-dropzone";
import Footer from "./Footer/Footer";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const analyzeResume = async () => {
    if (!file) {
      setError("Please upload a file");
      return;
    }

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];

        const response = await fetch(
          "https://ajf-resume-analyzer-func.azurewebsites.net/api/analyze_resume",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ file: base64 }),
          }
        );

        if (!response.ok) {
          throw new Error("API failed");
        }

        const data = await response.json();
        setResult(data);
      } catch (err) {
        console.error(err);
        setError("Error analyzing resume");
      }

      setLoading(false);
    };
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "green";
    if (score >= 60) return "orange";
    return "red";
  };

  return (
    <div className="app-container">
      <div className="main-content" data-aos="fade-in">
        <Segment className="upload-card">
          <Header as="h1" className="header">
            <Icon name="file alternate outline" /> AI Resume Analyzer
          </Header>

          <div
            {...getRootProps()}
            className={`dropzone-area ${isDragActive ? "drag-active" : ""}`}
          >
            <input {...getInputProps()} />
            <Icon name="cloud upload" size="huge" color={isDragActive ? "orange" : "grey"} />
            <h3>
              {isDragActive
                ? "Drop the resume here..."
                : "Drag & Drop your resume here"}
            </h3>
            <p>or click to browse files (PDF, DOC, DOCX)</p>
            {file && (
              <div className="file-name-pill" onClick={(e) => e.stopPropagation()}>
                <Icon name="file text" /> {file.name}
              </div>
            )}
          </div>

          {error && <Message negative icon="warning sign" content={error} />}

          <div style={{ textAlign: "center", margin: "30px 0" }}>
            <Button
              className="analyze-btn"
              size="large"
              loading={loading}
              onClick={analyzeResume}
              disabled={!file}
            >
              Analyze Resume <Icon name="magic" />
            </Button>
          </div>

          {result && (
            <div className="result-container" data-aos="fade-up">
              <Header as="h2" textAlign="center" style={{ color: '#fff', marginBottom: '30px' }}>
                ATS Score Match
              </Header>
              
              <div style={{ padding: '0 20px 40px 20px' }}>
                <Progress
                  percent={result.ats_score || 0}
                  color={getScoreColor(result.ats_score || 0)}
                  active
                  progress
                  size="large"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                />
              </div>

              <Grid stackable columns={3}>
                <Grid.Row>
                  <Grid.Column>
                    <Card fluid className="result-card">
                      <Card.Content>
                        <Card.Header><Icon name="check circle" color="green" /> Skills Found</Card.Header>
                        <Card.Description>
                          <div className="labels-container">
                            {result.skills && result.skills.map((s, i) => (
                              <Label key={i} color="green">{s}</Label>
                            ))}
                          </div>
                        </Card.Description>
                      </Card.Content>
                    </Card>
                  </Grid.Column>
                  
                  <Grid.Column>
                    <Card fluid className="result-card">
                      <Card.Content>
                        <Card.Header><Icon name="exclamation triangle" color="orange" /> Missing Skills</Card.Header>
                        <Card.Description>
                          <div className="labels-container">
                            {result.missing_skills && result.missing_skills.map((s, i) => (
                              <Label key={i} color="orange">{s}</Label>
                            ))}
                          </div>
                        </Card.Description>
                      </Card.Content>
                    </Card>
                  </Grid.Column>

                  <Grid.Column>
                    <Card fluid className="result-card">
                      <Card.Content>
                        <Card.Header><Icon name="lightbulb" color="yellow" /> Suggestions</Card.Header>
                        <Card.Description>
                          <List bulleted style={{ color: '#fff', fontSize: '1.05rem', lineHeight: '1.6' }}>
                            {result.suggestions && result.suggestions.map((s, i) => (
                              <List.Item key={i}>{s}</List.Item>
                            ))}
                          </List>
                        </Card.Description>
                      </Card.Content>
                    </Card>
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </div>
          )}
        </Segment>
      </div>
      <Footer />
    </div>
  );
}

export default App;