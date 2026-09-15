import React, { useState, useRef } from 'react';

export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: isDragOver ? '2px dashed #06C755' : '2px dashed #cccccc',
        borderRadius: '12px',
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: isDragOver ? 'rgba(6, 199, 85, 0.05)' : '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        margin: '20px auto',
        maxWidth: '600px',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".sqlite,.db,.json"
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#333333' }}>
        Line.sqlite または JSON ファイルをドロップ
      </h3>
      <p style={{ margin: 0, fontSize: '14px', color: '#666666' }}>
        またはクリックしてファイルを選択してください
      </p>
      {isLoading && (
        <div style={{ marginTop: '16px', color: '#06C755', fontWeight: 'bold' }}>
          データベースを解析中...
        </div>
      )}
    </div>
  );
};

export default FileUploader;
