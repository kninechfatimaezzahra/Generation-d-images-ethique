import React, { useState, useRef } from 'react';
import './Home.css';
import { Mic, Square, Upload, Image as ImageIcon, FileText, Music } from 'lucide-react';
import React, { useState } from "react";
import { FileText, Music, Image as ImageIcon, Upload, Mic, Square } from "react-feather";

const Home = () => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState('Image');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Gestion de l'enregistrement audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        setPrompt(prev => prev + " [Audio enregistré]");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Erreur d'accès au microphone:", error);
      alert("Impossible d'accéder au microphone. Vérifiez vos permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // Gestion de l'upload d'image
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.match('image.*')) {
        alert('Veuillez sélectionner un fichier image valide.');
        return;
      }
      setSelectedImage(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setPrompt(prev => prev + ` [Image: ${file.name}]`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Génération du contenu
  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage && !audioBlob) {
      alert('Veuillez entrer un prompt, enregistrer un audio ou uploader une image.');
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    console.log('📤 Envoi de la requête à l\'API...');

    const formData = new FormData();
    formData.append('text', prompt);
    if (selectedImage) formData.append('image', selectedImage);
    if (audioBlob) formData.append('audio', audioBlob, 'recording.wav');

    try {
      const response = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      console.log('📥 Réponse API:', data);

      // Récupérer l'image
      if (data.image_generation && data.image_generation.image_url) {
        setGeneratedImage(data.image_generation.image_url);
        console.log('🖼️ Image générée reçue');
      } 
      else if (data.image_url) {
        setGeneratedImage(data.image_url);
        console.log('🖼️ Image reçue (format racine)');
      }
      else if (data.image_generation && data.image_generation.placeholder) {
        setGeneratedImage(data.image_generation.placeholder);
        console.log('⚠️ Image placeholder (SDXL en cours)');
      }
      else {
        setGeneratedImage(null);
        console.log('❌ Aucune image dans la réponse');
      }

      // Informations
      const ethics = data.ethics_check?.status || data.ethics || 'inconnu';
      const domain = data.domain_classification?.domain || data.domain || 'inconnu';
      const enhancedPrompt = data.prompt_generation?.enhanced || data.prompt || prompt;
      
      alert(`✅ Génération terminée!\n\n📊 Résultats:\n• Éthique: ${ethics}\n• Domaine: ${domain}\n• Prompt amélioré: ${enhancedPrompt}\n\n⏱️ Temps: ${data.total_processing_time_seconds || '?'} secondes`);

    } catch (error) {
      console.error('❌ Erreur API:', error);
      alert('Erreur lors de la génération: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Réinitialiser l'audio
  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  // Réinitialiser l'image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };


const Home = () => {
  const [prompt, setPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeTab, setActiveTab] = useState("Text");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  // ------------------------
  // Audio recording handlers
  // ------------------------
  const startRecording = () => {
    setIsRecording(true);
    // TODO: implémenter la logique d’enregistrement audio si nécessaire
  };

  const stopRecording = () => {
    setIsRecording(false);
    // TODO: implémenter la logique de fin d’enregistrement
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  // ------------------------
  // Image upload handlers
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
    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const formData = new FormData();

      if (selectedImage) {
        // Cas Image + Texte → Image
        formData.append("file", selectedImage);
        formData.append("description", prompt);

        const response = await fetch("http://localhost:8000/edit_image", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.status === "success") {
          setGeneratedImage(data.image_url);
        } else {
          console.error("Erreur:", data.message);
        }
      } else {
        // Cas Texte → Image
        formData.append("text", prompt);

        const response = await fetch("http://localhost:8000/generate", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.status === "success") {
          setGeneratedImage(data.image_url);
        } else {
          console.error("Erreur:", data.message);
        }
      }
    } catch (error) {
      console.error("Erreur de requête:", error);
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
              {/* Audio tools */}
              <div className="audio-tools">
                <div className="tool-title">
                  <Music size={18} />
                  <span>Enregistrement audio</span>
                </div>
                <div className="audio-buttons">
                  {!isRecording ? (
                    <button
                      className="audio-button record"
                      onClick={startRecording}
                    >
                      <Mic size={16} />
                      Enregistrer
                    </button>
                  ) : (
                    <button
                      className="audio-button stop"
                      onClick={stopRecording}
                    >
                      <Square size={16} />
                      Arrêter
                    </button>
                  )}

                  {audioUrl && (
                    <>
                      <audio src={audioUrl} controls className="audio-player" />
                      <button
                        className="audio-button clear"
                        onClick={clearAudio}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>

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
                        <button
                          className="clear-image-btn"
                          onClick={clearImage}
                        >
                          ×
                        </button>
                      </div>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="image-preview"
                      />
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
              className={`tab ${activeTab === "Audio" ? "active" : ""}`}
              onClick={() => setActiveTab("Audio")}
            >
              <Music size={18} />
              Audio
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
          <button
            className="generate-button"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? "Génération en cours..." : "Generate"}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Génération de l'image... Cela peut prendre 30-60 secondes</p>
            <p style={{ fontSize: "0.9rem", color: "#6e6e73" }}>
              ⚡ Backend FastAPI en CPU-only
            </p>
          </div>
        )}

        {/* Generated image */}
        {generatedImage && !isLoading && (
          <div className="generated-image-container">
            <h3>
              <ImageIcon size={20} />
              Image générée
            </h3>
            <img
              src={generatedImage}
              alt="Generated"
              className="generated-image"
            />
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

        {/* Current state */}
        {(selectedImage || audioBlob || prompt) && (
          <div className="current-state">
            <h3>Contenu prêt pour génération:</h3>
            <div className="state-items">
              {selectedImage && (
                <div className="state-item">
                  <ImageIcon size={14} />
                  <span>Image: {selectedImage.name}</span>
                </div>
              )}
              {audioBlob && (
                <div className="state-item">
                  <Music size={14} />
                  <span>Audio: {Math.round(audioBlob.size / 1024)} KB</span>
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
        <p>Interface de génération de contenu AI avec audio et upload d'image</p>
      </footer>
    </div>
  );
};
}
export default Home;
