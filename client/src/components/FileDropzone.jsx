import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { UploadCloud, Image as ImageIcon, Music, Video, X } from "lucide-react";

const TYPE_ICON = { image: ImageIcon, music: Music, video: Video };
const TYPE_HINT = {
  image: "JPEG, PNG, or WebP, up to 8 MB.",
  music: "MP3 or WAV, up to 20 MB.",
  video: "MP4, WebM, or MOV, up to 60 MB.",
};

export default function FileDropzone({ contentType, accept, file, onChange, disabled }) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const Icon = TYPE_ICON[contentType] || UploadCloud;

  useEffect(() => {
    if (contentType === "image" && file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file, contentType]);

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  }

  return (
    <div
      className={`file-dropzone ${dragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        disabled={disabled}
        style={{ display: "none" }}
      />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            className="file-dropzone-preview"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="file-dropzone-thumb" />
            ) : (
              <span className="file-dropzone-icon"><Icon size={24} strokeWidth={2} /></span>
            )}
            <div className="file-dropzone-meta">
              <span className="mono-text">{file.name}</span>
              <span className="note">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button
              type="button"
              className="file-dropzone-remove"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              disabled={disabled}
              aria-label="Remove file"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="file-dropzone-empty"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="file-dropzone-icon"><UploadCloud size={22} strokeWidth={2} /></span>
            <p>Drag a file here, or click to browse</p>
            <p className="note">{TYPE_HINT[contentType]}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
