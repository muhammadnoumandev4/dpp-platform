'use client';

import { ChangeEvent, DragEvent, ReactNode, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined';

export function DropZone({
  accept,
  hint,
  disabled,
  maxSizeBytes = 10 * 1024 * 1024,
  onFile,
  onFiles,
  multiple = false,
  children,
}: {
  accept: string;
  hint: string;
  disabled?: boolean;
  maxSizeBytes?: number;
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  children?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  function accepts(file: File) {
    const options = accept.split(',').map((item) => item.trim().toLowerCase());
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return options.some((option) => {
      if (option.startsWith('.')) return name.endsWith(option);
      if (option.endsWith('/*')) return mime.startsWith(option.slice(0, -1));
      return mime === option;
    });
  }

  function processFiles(fileList: FileList | File[]) {
    setRejection(null);
    const filesArray = Array.from(fileList);
    if (!filesArray.length) return;

    const validFiles: File[] = [];
    for (const file of filesArray) {
      if (file.size > maxSizeBytes) {
        setRejection(`One or more files exceed ${Math.round(maxSizeBytes / 1024 / 1024)} MB limit.`);
        continue;
      }
      if (!accepts(file)) {
        setRejection('One or more files have unsupported format.');
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    if (onFiles) {
      onFiles(validFiles);
    } else if (onFile && validFiles[0]) {
      onFile(validFiles[0]);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (event.dataTransfer.files.length > 1 && !multiple) {
      setRejection('Upload one file at a time.');
      return;
    }
    processFiles(event.dataTransfer.files);
  }

  function browse(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) processFiles(event.target.files);
    event.target.value = '';
  }

  return (
    <Box
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={drop}
      sx={{
        p: 2,
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        bgcolor: dragging ? 'primary.50' : 'transparent',
        borderRadius: 1,
        textAlign: 'center',
        transition: 'background-color 120ms, border-color 120ms',
      }}
    >
      <CloudUploadIcon color={dragging ? 'primary' : 'action'} />
      <Typography variant="body2">{children ?? (multiple ? 'Drag and drop files here' : 'Drag and drop a file here')}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{hint}</Typography>
      {rejection && (
        <Typography role="alert" variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          {rejection}
        </Typography>
      )}
      <Button component="label" size="small" variant="outlined" disabled={disabled}>
        Browse
        <input
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          onChange={browse}
        />
      </Button>
    </Box>
  );
}

