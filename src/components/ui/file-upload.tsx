/**
 * FileUpload — Simple file input with 5MB limit, base64 conversion
 */

import { component$, useSignal, type QRL } from "@builder.io/qwik";
import { LuPaperclip, LuX } from "@qwikest/icons/lucide";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  data: string; // base64
}

interface FileUploadProps {
  maxSizeMB?: number;
  accept?: string;
  multiple?: boolean;
  value?: UploadedFile[];
  onChange$: QRL<(files: UploadedFile[]) => void>;
  label?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const FileUpload = component$<FileUploadProps>((props) => {
  const maxSize = (props.maxSizeMB || 5) * 1024 * 1024;
  const error = useSignal("");
  const files = props.value || [];

  return (
    <div>
      {props.label && (
        <label class="label">{props.label}</label>
      )}

      <div class="flex items-center gap-3">
        <label
          class="btn btn-secondary btn-sm"
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <LuPaperclip style={{ width: "14px", height: "14px" }} />
          Anexar arquivo
          <input
            type="file"
            accept={props.accept}
            multiple={props.multiple}
            style={{ display: "none" }}
            onChange$={async (e) => {
              const input = e.target as HTMLInputElement;
              if (!input.files?.length) return;

              const newFiles: UploadedFile[] = [...files];
              error.value = "";

              for (const file of Array.from(input.files)) {
                if (file.size > maxSize) {
                  error.value = `"${file.name}" excede o limite de ${props.maxSizeMB || 5}MB.`;
                  continue;
                }
                const data = await fileToBase64(file);
                newFiles.push({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  data,
                });
              }

              props.onChange$(newFiles);
              input.value = "";
            }}
          />
        </label>
        <span class="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Máx. {props.maxSizeMB || 5}MB por arquivo
        </span>
      </div>

      {error.value && (
        <p class="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
          {error.value}
        </p>
      )}

      {files.length > 0 && (
        <div class="mt-2 space-y-1">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              class="flex items-center justify-between rounded-md px-3 py-1.5 text-xs"
              style={{
                background: "var(--bg-hover)",
                color: "var(--text-secondary)",
              }}
            >
              <div class="flex items-center gap-2 overflow-hidden">
                <LuPaperclip style={{ width: "12px", height: "12px", flexShrink: 0 }} />
                <span class="truncate">{f.name}</span>
                <span style={{ color: "var(--text-tertiary)" }}>({formatBytes(f.size)})</span>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-icon"
                style={{ padding: "2px" }}
                onClick$={() => {
                  const updated = files.filter((_, idx) => idx !== i);
                  props.onChange$(updated);
                }}
              >
                <LuX style={{ width: "14px", height: "14px", color: "var(--color-danger)" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
