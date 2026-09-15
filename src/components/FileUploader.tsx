import React, { useState, useRef } from 'react';
import { findTargetFile } from '../utils/fileLoader';

export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

// フォルダがドロップされた際に配下のファイルを再帰的に取得
const scanFilesFromDataTransfer = async (dataTransfer: DataTransfer): Promise<File[]> => {
  const files: File[] = [];
  const items = Array.from(dataTransfer.items || []);

  const readEntry = async (entry: any): Promise<void> => {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file((file: File) => {
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        dirReader.readEntries((results: any[]) => resolve(results));
      });
      for (const subEntry of entries) {
        await readEntry(subEntry);
      }
    }
  };

  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      await readEntry(entry);
    } else if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length === 0 && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files);
  }

  return files;
};

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const files = await scanFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        const targetFile = findTargetFile(files);
        onFileSelect(targetFile);
      }
    } catch (err: any) {
      alert(err.message || 'ファイルの検出に失敗しました。');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      const targetFile = findTargetFile(fileList);
      onFileSelect(targetFile);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: isDragOver ? '2px dashed #06C755' : '2px dashed #cccccc',
        borderRadius: '16px',
        padding: '40px 24px',
        textAlign: 'center',
        backgroundColor: isDragOver ? 'rgba(6, 199, 85, 0.05)' : '#ffffff',
        transition: 'all 0.2s ease',
        margin: '20px auto',
        maxWidth: '600px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".sqlite,.db,.json"
        style={{ display: 'none' }}
      />

      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileChange}
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        style={{ display: 'none' }}
      />

      <div style={{ fontSize: '56px', marginBottom: '16px' }}>📁</div>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333333', fontWeight: 'bold' }}>
        フォルダまたはファイルをドロップ
      </h3>
      <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666666', lineHeight: '1.5' }}>
        LINEのバックアップフォルダや <code>Line.sqlite</code> / <code>JSON</code> ファイルをそのままドロップできます
      </p>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#06C755',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          📂 フォルダを選択
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f0f0f0',
            color: '#333333',
            border: '1px solid #cccccc',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          📄 ファイルを選択
        </button>
      </div>

      {isLoading && (
        <div style={{ marginTop: '20px', color: '#06C755', fontWeight: 'bold', fontSize: '15px' }}>
          ⏳ データベースを解析中...
        </div>
      )}
    </div>
  );
};

export default FileUploader;
