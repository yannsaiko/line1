import initSqlJs, { SqlJsStatic } from 'sql.js';
// Viteの機能を使ってwasmファイルのURLを取得
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      // WASMファイルをプロジェクトのビルド成果物から直接取得するように指定
      locateFile: () => sqlWasmUrl,
    });
  }
  return sqlPromise;
}

// ... 以降のパース関数群は既存のコードのまま
