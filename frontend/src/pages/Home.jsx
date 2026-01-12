import React, { useState } from "react";
import "./Home.css";
import { Upload, Image as ImageIcon, FileText } from "lucide-react";

const Home = () => {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("Image");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  // ------------------------
  // Image upload
  // ------------------------
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // ------------------------
  // Generate handler (backend call)
  // ------------------------
  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage) {
      alert("Veuillez entrer un prompt ou uploader une image.");
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);
    setResults(null);

    try {
      const formData = new FormData();
      let response;

      if (selectedImage) {
        // Cas Image + Texte → /edit_image
        formData.append("file", selectedImage);
        formData.append("description", prompt);
        response = await fetch("http://localhost:8000/edit_image", {
          method: "POST",
          body: formData,
        });
      } else {
        // Cas Texte → /generate
        formData.append("text", prompt);
        response = await fetch("http://localhost:8000/generate", {
          method: "POST",
          body: formData,
        });
      }

      const data = await response.json();
      console.log("Réponse backend:", data); // ⚡ Debug

      // ⚡ Cas bloqué (texte ou image uploadée non éthique)
      if (data.status === "blocked") {
        setResults({
          ethicsText: data.ethics_text || "blocked",
          domain: data.domain,
          prompt: data.prompt,
          ethicsImage: null,
          ethicsImageScore: null,
          uploadedImageEthics: data.uploaded_image_ethics || null,
          uploadedImageEthicsScore: data.uploaded_image_ethics_score || null,
        });
        alert(data.message);
        setIsLoading(false);
        return;
      }

      // ⚡ Cas succès
      if (data.status === "success") {
        setGeneratedImage(data.image_url); // ⚡ image base64
        setResults({
          ethicsText: data.ethics_text,
          domain: data.domain,
          prompt: data.prompt,
          ethicsImage: data.ethics_image,
          ethicsImageScore: data.ethics_image_score,
          uploadedImageEthics: data.uploaded_image_ethics || null,
          uploadedImageEthicsScore: data.uploaded_image_ethics_score || null,
        });
      } else {
        console.error("Erreur:", data.message);
        alert("Erreur: " + data.message);
      }
    } catch (error) {
      console.error("Erreur requête:", error);
      alert("Erreur de requête: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------
  // Render
  // ------------------------
  return (
    <div className="home-container">
      <header className="header">
        <h1 className="title">Image generation</h1>
      </header>

      <main className="main-content">
        {/* Input Section */}
        <div className="input-section">
          <div className="input-container">
            <label htmlFor="prompt-input" className="input-label">
              Enter your prompt here...
            </label>
            <textarea
              id="prompt-input"
              className="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Décrivez ce que vous voulez générer..."
            />

            <div className="tools-container">
              {/* Image tools */}
              <div className="image-tools">
                <div className="tool-title">
                  <ImageIcon size={18} />
                  <span>Upload d'image</span>
                </div>
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="image-input"
                  />
                  <label htmlFor="image-upload" className="upload-button">
                    <Upload size={16} />
                    Choisir une image
                  </label>

                  {imagePreview && (
                    <div className="image-preview-container">
                      <div className="image-preview-header">
                        <span>Image sélectionnée:</span>
                        <button className="clear-image-btn" onClick={clearImage}>
                          ×
                        </button>
                      </div>
                      <img src={imagePreview} alt="Preview" className="image-preview" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs-container">
            <button
              className={`tab ${activeTab === "Text" ? "active" : ""}`}
              onClick={() => setActiveTab("Text")}
            >
              <FileText size={18} />
              Text
            </button>
            <button
              className={`tab ${activeTab === "Image" ? "active" : ""}`}
              onClick={() => setActiveTab("Image")}
            >
              <ImageIcon size={18} />
              Image
            </button>
          </div>
        </div>

        {/* Generate button */}
        <div className="generate-section">
          <button className="generate-button" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? "Génération en cours..." : "Generate"}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Génération de l'image... Cela peut prendre 30-60 secondes</p>
          </div>
        )}

        {/* Generated image */}
        {generatedImage && !isLoading && (
          <div className="generated-image-container">
            <h3>
              <ImageIcon size={20} />
              Image générée
            </h3>
            <img src={generatedImage} alt="Generated" className="generated-image" />
            <div
              style={{
                marginTop: "15px",
                fontSize: "0.9rem",
                color: "#6e6e73",
                textAlign: "center",
              }}
            >
              ✅ Génération terminée avec succès
            </div>
          </div>
        )}

        {/* Résultats du pipeline */}
        {results && (
          <div className="results-container">
            <h3>Résultats du pipeline :</h3>
            <ul>
              <li>🛡️ Éthique texte : {results.ethicsText}</li>
              <li>📂 Domaine : {results.domain}</li>
              <li>✨ Prompt utilisé : {results.prompt}</li>
              {results.uploadedImageEthics && (
                <li>
                  📤 Éthique image uploadée : {results.uploadedImageEthics}
                  {results.uploadedImageEthicsScore &&
                    ` (score: ${results.uploadedImageEthicsScore.toFixed(2)})`}
                </li>
              )}
              {results.ethicsImage && (
                <li>
                  🖼️ Éthique image générée : {results.ethicsImage}
                  {results.ethicsImageScore &&
                    ` (score: ${results.ethicsImageScore.toFixed(2)})`}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Current state */}
        {(selectedImage || prompt) && (
          <div className="current-state">
            <h3>Contenu prêt pour génération:</h3>
            <div className="state-items">
              {selectedImage && (
                <div className="state-item">
                  <ImageIcon size={14} />
                  <span>Image: {selectedImage.name}</span>
                </div>
              )}
              {prompt && (
                <div className="state-item">
                  <FileText size={14} />
                  <span>Texte: {prompt.length} caractères</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Interface de génération de contenu AI avec upload d'image</p>
      </footer>
    </div>
  );
};

export default Home;
