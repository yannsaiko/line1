import React, { useRef } from 'react';

interface FileUploaderProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isLoading?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0' }}>
      {/* 単一・複数ファイル選択ボタン */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept=".sqlite,.sqlite3,.db,.txt"
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        style={{
          padding: '10px 18px',
          backgroundColor: '#06C755',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        ファイルを選択
      </button>

      {/* フォルダー丸ごと選択ボタン */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        style={{ display: 'none' }}
      />
      <button
        onClick={() => folderInputRef.current?.click()}
        disabled={isLoading}
        style={{
          padding: '10px 18px',
          backgroundColor: '#1E90FF',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        フォルダーを選択
      </button>
    </div>
  );
};

export default FileUploader;
