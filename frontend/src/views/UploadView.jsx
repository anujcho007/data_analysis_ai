import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Settings2, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  Database,
  Sliders,
  Layers,
  Loader2,
  Zap,
  Clock,
  Activity,
  Globe
} from 'lucide-react';
import { uploadFiles, uploadChunk, completeChunkedUpload } from '../api/client';

const ApiDataFetcher = React.lazy(() => import('../components/ApiDataFetcher'));
const DatabaseConnector = React.lazy(() => import('../components/DatabaseConnector'));

const CLEANING_STAGES = [
  {
    step: 1,
    title: 'Ingestion & Stream',
    short: 'Ingesting',
    desc: 'Reading CSV bytes, parsing encodings & delimiters',
    icon: UploadCloud
  },
  {
    step: 2,
    title: 'Schema & Type Inference',
    short: 'Schema Types',
    desc: 'Normalizing headers to snake_case & mapping datatypes',
    icon: Sliders
  },
  {
    step: 3,
    title: 'Deduplication & Quality Purge',
    short: 'Deduplicating',
    desc: 'Purging duplicate records & cleaning whitespace noise',
    icon: Sparkles
  },
  {
    step: 4,
    title: 'Missing Value Imputation',
    short: 'Null Imputation',
    desc: 'Filling numeric (median/mean) & text (mode) gaps',
    icon: Database
  },
  {
    step: 5,
    title: 'Star Schema & DB Indexing',
    short: 'Star Schema & DB',
    desc: 'Classifying Fact/Dim tables & indexing SQLite warehouse',
    icon: Layers
  }
];

export default function UploadView({ onUploadComplete, onUploadStateChange, setActiveTab }) {
  const [ingestionTab, setIngestionTab] = useState('csv'); // 'csv' | 'api'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [fileStatuses, setFileStatuses] = useState({});
  const [fileProgresses, setFileProgresses] = useState({});
  const [fileStageTexts, setFileStageTexts] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(1);
  const [stageStatusText, setStageStatusText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [processedDatasets, setProcessedDatasets] = useState([]);
  const [finalSummary, setFinalSummary] = useState(null);
  const fileInputRef = useRef(null);

  // Notify parent of background upload status changes
  useEffect(() => {
    if (onUploadStateChange) {
      const statuses = Object.values(fileStatuses);
      const completed = statuses.filter(s => s === 'done').length;

      onUploadStateChange({
        isUploading,
        completedFiles: completed,
        totalFiles: selectedFiles.length,
        progressPct: overallProgress,
        currentStageIndex,
        stageStatusText,
        statusText: isUploading
          ? `${overallProgress}% • ${stageStatusText || 'Processing datasets...'}`
          : ''
      });
    }
  }, [isUploading, fileStatuses, selectedFiles.length, overallProgress, currentStageIndex, stageStatusText]);

  // Cleaning Settings State
  const [clearExisting, setClearExisting] = useState(true);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [fillNulls, setFillNulls] = useState(true);
  const [numericStrategy, setNumericStrategy] = useState('median');
  const [categoricalStrategy, setCategoricalStrategy] = useState('mode');
  const [standardizeColumns, setStandardizeColumns] = useState(true);
  const [standardizeDates, setStandardizeDates] = useState(true);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.txt'));
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleProcessUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    setProcessedDatasets([]);
    setFinalSummary(null);
    setOverallProgress(5);
    setCurrentStageIndex(1);
    setStageStatusText('Initializing stream and preparing payload...');
    setElapsedSeconds(0);

    const initialStatuses = {};
    const initialProgresses = {};
    const initialStages = {};
    selectedFiles.forEach((f) => {
      initialStatuses[f.name] = 'pending';
      initialProgresses[f.name] = 5;
      initialStages[f.name] = 'Queued';
    });
    setFileStatuses(initialStatuses);
    setFileProgresses(initialProgresses);
    setFileStageTexts(initialStages);

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB chunks
    const anyLargeFile = selectedFiles.some(f => f.size > CHUNK_SIZE);
    let stageTimer = null;

    try {
      if (!anyLargeFile) {
        // Fast path: All files are small (<= 20MB) -> transmit in parallel batch
        selectedFiles.forEach((f) => {
          setFileStatuses(prev => ({ ...prev, [f.name]: 'processing' }));
          setFileStageTexts(prev => ({ ...prev, [f.name]: 'Uploading...' }));
        });

        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('clear_existing', clearExisting ? 'true' : 'false');
        formData.append('drop_duplicates', dropDuplicates);
        formData.append('fill_nulls', fillNulls);
        formData.append('numeric_strategy', numericStrategy);
        formData.append('categorical_strategy', categoricalStrategy);
        formData.append('standardize_columns', standardizeColumns);
        formData.append('standardize_dates', standardizeDates);

        // Upload with real XHR progress
        const uploadPromise = uploadFiles(formData, (percent) => {
          const mapped = Math.min(35, Math.round(5 + (percent * 0.3)));
          setOverallProgress(mapped);
          selectedFiles.forEach(f => {
            setFileProgresses(prev => ({ ...prev, [f.name]: mapped }));
            setFileStageTexts(prev => ({ ...prev, [f.name]: `Uploading (${percent}%)...` }));
          });
          setStageStatusText(`Transferring files to server (${percent}%)...`);
        });

        // Once network upload completes, advance smoothly across cleaning stages while server computes
        let simPct = 35;
        stageTimer = setInterval(() => {
          simPct += 3;
          if (simPct >= 96) {
            simPct = 96;
            clearInterval(stageTimer);
          }
          setOverallProgress(simPct);
          selectedFiles.forEach(f => {
            setFileProgresses(prev => ({ ...prev, [f.name]: simPct }));
          });

          if (simPct < 52) {
            setCurrentStageIndex(2);
            setStageStatusText('Normalizing column headers to snake_case & inferring datatypes...');
            selectedFiles.forEach(f => {
              setFileStageTexts(prev => ({ ...prev, [f.name]: 'Schema & Type Inference' }));
            });
          } else if (simPct < 70) {
            setCurrentStageIndex(3);
            setStageStatusText(dropDuplicates 
              ? 'Scanning records & purging duplicate rows in memory...' 
              : 'Verifying data integrity & cleaning column noise...');
            selectedFiles.forEach(f => {
              setFileStageTexts(prev => ({ ...prev, [f.name]: 'Deduplicating Records' }));
            });
          } else if (simPct < 88) {
            setCurrentStageIndex(4);
            setStageStatusText(fillNulls 
              ? `Imputing null values (${numericStrategy} for numeric, ${categoricalStrategy} for categorical)...` 
              : 'Formatting dates & data types...');
            selectedFiles.forEach(f => {
              setFileStageTexts(prev => ({ ...prev, [f.name]: 'Imputing Null Values' }));
            });
          } else {
            setCurrentStageIndex(5);
            setStageStatusText('Deriving Star Schema Fact/Dim relationships & indexing SQLite warehouse...');
            selectedFiles.forEach(f => {
              setFileStageTexts(prev => ({ ...prev, [f.name]: 'Indexing Star Schema' }));
            });
          }
        }, 280);

        const result = await uploadPromise;
        if (stageTimer) clearInterval(stageTimer);

        setOverallProgress(100);
        setCurrentStageIndex(5);
        setStageStatusText('All datasets cleaned, transformed, and ingested into Star Schema warehouse!');

        if (result.datasets && result.datasets.length > 0) {
          setProcessedDatasets(result.datasets);
          const doneStatuses = {};
          const doneProgresses = {};
          const doneStages = {};
          selectedFiles.forEach((f) => {
            doneStatuses[f.name] = 'done';
            doneProgresses[f.name] = 100;
            doneStages[f.name] = 'Ingested';
          });
          setFileStatuses(doneStatuses);
          setFileProgresses(doneProgresses);
          setFileStageTexts(doneStages);
        }

        if (result.overall_summary) {
          setFinalSummary(result.overall_summary);
        }
      } else {
        // Distributed Chunked Pipeline: Handles 1GB - 50GB+ files seamlessly
        let allDatasets = [];
        let totalInitial = 0;
        let totalFinal = 0;
        let totalDuplicates = 0;
        let totalNulls = 0;

        for (let fileIdx = 0; fileIdx < selectedFiles.length; fileIdx++) {
          const file = selectedFiles[fileIdx];
          const isFirstFile = fileIdx === 0;

          if (file.size > CHUNK_SIZE) {
            // Slice into 20MB chunks and stream to backend
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
              const start = chunkIdx * CHUNK_SIZE;
              const end = Math.min(file.size, start + CHUNK_SIZE);
              const chunkBlob = file.slice(start, end);
              const chunkPct = Math.round(((chunkIdx + 1) / totalChunks) * 100);
              const overallChunkPct = Math.round(
                ((fileIdx * 100) + (chunkPct * 0.65)) / selectedFiles.length
              );

              setOverallProgress(overallChunkPct);
              setCurrentStageIndex(1);
              setStageStatusText(`Streaming ${file.name} chunk ${chunkIdx + 1}/${totalChunks} (${chunkPct}%)...`);

              setFileStatuses(prev => ({
                ...prev,
                [file.name]: `Uploading part ${chunkIdx + 1}/${totalChunks} (${chunkPct}%)...`
              }));
              setFileProgresses(prev => ({ ...prev, [file.name]: Math.round(chunkPct * 0.65) }));
              setFileStageTexts(prev => ({ ...prev, [file.name]: `Chunk ${chunkIdx + 1}/${totalChunks}` }));

              const chunkForm = new FormData();
              chunkForm.append('upload_id', uploadId);
              chunkForm.append('chunk_index', chunkIdx);
              chunkForm.append('total_chunks', totalChunks);
              chunkForm.append('filename', file.name);
              chunkForm.append('chunk', chunkBlob, file.name);

              // Auto-retry up to 3 times per chunk
              let chunkAttempts = 0;
              let chunkUploaded = false;
              while (chunkAttempts < 3 && !chunkUploaded) {
                try {
                  await uploadChunk(chunkForm);
                  chunkUploaded = true;
                } catch (chunkErr) {
                  chunkAttempts++;
                  if (chunkAttempts >= 3) {
                    throw new Error(`Failed to upload chunk ${chunkIdx + 1} of ${file.name}: ${chunkErr.message}`);
                  }
                  await new Promise(res => setTimeout(res, 1000));
                }
              }
            }

            // All chunks transmitted -> stream clean directly into warehouse
            setCurrentStageIndex(2);
            setStageStatusText(`Server streaming & cleaning ${file.name} directly into warehouse...`);
            setFileStatuses(prev => ({
              ...prev,
              [file.name]: 'Streaming to warehouse...'
            }));
            setFileStageTexts(prev => ({ ...prev, [file.name]: 'Cleaning & Ingesting...' }));

            let secondsElapsed = 0;
            const chunkCleanTimer = setInterval(() => {
              secondsElapsed++;
              const calculatedPct = Math.min(95, Math.round(65 + (30 * (1 - Math.exp(-secondsElapsed / 45)))));
              setFileProgresses(prev => ({ ...prev, [file.name]: calculatedPct }));
              setOverallProgress(calculatedPct);

              if (secondsElapsed < 12) {
                setCurrentStageIndex(2);
                setStageStatusText(`Assembling chunks & normalizing schema for ${file.name} (${secondsElapsed}s)...`);
                setFileStageTexts(prev => ({ ...prev, [file.name]: 'Schema Normalization' }));
              } else if (secondsElapsed < 35) {
                setCurrentStageIndex(3);
                setStageStatusText(`Vectorized cleaning & streaming records into warehouse (${secondsElapsed}s, large files take ~45-90s)...`);
                setFileStageTexts(prev => ({ ...prev, [file.name]: 'Ingesting Rows' }));
              } else if (secondsElapsed < 65) {
                setCurrentStageIndex(4);
                setStageStatusText(`Imputing null values & deduplicating records (${secondsElapsed}s, please wait)...`);
                setFileStageTexts(prev => ({ ...prev, [file.name]: 'Deduplicating' }));
              } else {
                setCurrentStageIndex(5);
                setStageStatusText(`Building high-speed B-Tree indexes on warehouse (${secondsElapsed}s, finalizing)...`);
                setFileStageTexts(prev => ({ ...prev, [file.name]: 'Indexing Warehouse' }));
              }
            }, 1000);

            const completeResult = await completeChunkedUpload({
              upload_id: uploadId,
              filename: file.name,
              clear_existing: isFirstFile && clearExisting,
              drop_duplicates: dropDuplicates,
              fill_nulls: fillNulls,
              numeric_strategy: numericStrategy,
              categorical_strategy: categoricalStrategy,
              standardize_columns: standardizeColumns,
              standardize_dates: standardizeDates
            });

            clearInterval(chunkCleanTimer);

            if (completeResult.datasets) {
              allDatasets.push(...completeResult.datasets);
            }
            if (completeResult.overall_summary) {
              totalInitial += completeResult.overall_summary.total_initial_rows || 0;
              totalFinal += completeResult.overall_summary.total_final_rows || 0;
              totalDuplicates += completeResult.overall_summary.total_duplicates_removed || 0;
              totalNulls += completeResult.overall_summary.total_nulls_filled || 0;
            }

            setFileStatuses(prev => ({
              ...prev,
              [file.name]: 'done'
            }));
            setFileProgresses(prev => ({ ...prev, [file.name]: 100 }));
            setFileStageTexts(prev => ({ ...prev, [file.name]: 'Ingested' }));
          } else {
            // Small file in mixed upload batch
            setFileStatuses(prev => ({ ...prev, [file.name]: 'processing' }));
            setFileStageTexts(prev => ({ ...prev, [file.name]: 'Processing...' }));
            const formData = new FormData();
            formData.append('files', file);
            formData.append('clear_existing', (isFirstFile && clearExisting) ? 'true' : 'false');
            formData.append('drop_duplicates', dropDuplicates);
            formData.append('fill_nulls', fillNulls);
            formData.append('numeric_strategy', numericStrategy);
            formData.append('categorical_strategy', categoricalStrategy);
            formData.append('standardize_columns', standardizeColumns);
            formData.append('standardize_dates', standardizeDates);

            const result = await uploadFiles(formData, (percent) => {
              setFileProgresses(prev => ({ ...prev, [file.name]: Math.round(percent * 0.4) }));
            });

            if (result.datasets) {
              allDatasets.push(...result.datasets);
            }
            if (result.overall_summary) {
              totalInitial += result.overall_summary.total_initial_rows || 0;
              totalFinal += result.overall_summary.total_final_rows || 0;
              totalDuplicates += result.overall_summary.total_duplicates_removed || 0;
              totalNulls += result.overall_summary.total_nulls_filled || 0;
            }
            setFileStatuses(prev => ({ ...prev, [file.name]: 'done' }));
            setFileProgresses(prev => ({ ...prev, [file.name]: 100 }));
            setFileStageTexts(prev => ({ ...prev, [file.name]: 'Ingested' }));
          }
        }

        setOverallProgress(100);
        setCurrentStageIndex(5);
        setStageStatusText('All files cleaned, transformed, and ingested into Star Schema warehouse!');
        setProcessedDatasets(allDatasets);
        setFinalSummary({
          total_initial_rows: totalInitial,
          total_final_rows: totalFinal,
          total_duplicates_removed: totalDuplicates,
          total_nulls_filled: totalNulls
        });
      }

      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      if (stageTimer) clearInterval(stageTimer);
      setFileStatuses(prev => {
        const updated = { ...prev };
        selectedFiles.forEach((f) => {
          if (updated[f.name] !== 'done') {
            updated[f.name] = 'error';
          }
        });
        return updated;
      });
      setUploadError(`Error processing files: ${err.message}`);
    } finally {
      clearInterval(timerInterval);
      if (stageTimer) clearInterval(stageTimer);
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Title */}
      <div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 14px',
          background: '#e0e7ff',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          color: '#4338ca',
          fontWeight: '600',
          marginBottom: '10px'
        }}>
          <Zap size={14} color="#4f46e5" />
          <span>High-Speed Parallel Processing Engine</span>
        </div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', color: '#0f172a' }}>
          Dynamic Multi-CSV Ingestion & Cleaning
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Upload your CSV datasets or fetch live records from any REST API. The system will first read and thoroughly clean the data (purging duplicates and imputing missing values), 
          and then dynamically create the database schema and Star Schema relationships tailored to your exact files.
        </p>
      </div>

      {/* Ingestion Source Switcher Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '14px'
      }}>
        <button
          type="button"
          onClick={() => setIngestionTab('csv')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: ingestionTab === 'csv' ? 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)' : '#f1f5f9',
            color: ingestionTab === 'csv' ? '#ffffff' : '#64748b',
            boxShadow: ingestionTab === 'csv' ? '0 2px 10px rgba(79, 70, 229, 0.25)' : 'none'
          }}
        >
          <UploadCloud size={17} />
          <span>Upload CSV Files</span>
        </button>

        <button
          type="button"
          onClick={() => setIngestionTab('api')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: ingestionTab === 'api' ? 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)' : '#f1f5f9',
            color: ingestionTab === 'api' ? '#ffffff' : '#64748b',
            boxShadow: ingestionTab === 'api' ? '0 2px 10px rgba(79, 70, 229, 0.25)' : 'none'
          }}
        >
          <Globe size={17} />
          <span>Fetch from REST API</span>
        </button>

        <button
          type="button"
          onClick={() => setIngestionTab('sql')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: ingestionTab === 'sql' ? 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)' : '#f1f5f9',
            color: ingestionTab === 'sql' ? '#ffffff' : '#64748b',
            boxShadow: ingestionTab === 'sql' ? '0 2px 10px rgba(79, 70, 229, 0.25)' : 'none'
          }}
        >
          <Database size={17} />
          <span>Connect SQL Database</span>
        </button>
      </div>

      <React.Suspense fallback={
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>
          Loading connection interface...
        </div>
      }>
        {ingestionTab === 'api' ? (
          <ApiDataFetcher onIngestionComplete={onUploadComplete} setActiveTab={setActiveTab} />
        ) : ingestionTab === 'sql' ? (
          <DatabaseConnector onSyncSuccess={onUploadComplete} />
        ) : null}
      </React.Suspense>
      {ingestionTab === 'csv' && (
        <>
      {/* Pipeline Progress Visualizer Card (active during upload or shown on 100% completion) */}
      {(isUploading || overallProgress > 0) && (
        <div className="glass-panel" style={{
          padding: '24px',
          border: isUploading ? '1.5px solid #818cf8' : '1px solid #86efac',
          borderRadius: 'var(--radius-lg)',
          boxShadow: isUploading ? '0 10px 30px -4px rgba(79, 70, 229, 0.15)' : 'var(--shadow-md)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'slideUp 0.3s ease'
        }}>
          {/* Top Bar: Title, Elapsed Time, & Prominent Percentage */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: isUploading 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)' 
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: isUploading ? '0 6px 20px rgba(79, 70, 229, 0.35)' : '0 6px 20px rgba(16, 185, 129, 0.3)'
              }}>
                {isUploading ? <Activity size={24} className="pulsing-dot" /> : <CheckCircle2 size={24} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: '800' }}>
                    {isUploading ? 'Cleaning & Ingestion Pipeline Active' : 'Pipeline Execution Complete'}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: isUploading ? '#e0e7ff' : '#dcfce7',
                    color: isUploading ? '#4338ca' : '#15803d'
                  }}>
                    {isUploading ? `Stage ${currentStageIndex} of 5` : 'All 5 Stages Completed'}
                  </span>
                </div>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Automated snake_casing, duplicate record purging, null imputation, and Star Schema warehouse indexing
                </p>
              </div>
            </div>

            {/* Percentage & Elapsed Time Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Clock size={16} />
                <span>Elapsed: <strong>{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}</strong></span>
              </div>

              <div style={{
                padding: '6px 18px',
                borderRadius: '14px',
                background: isUploading ? '#f5f3ff' : '#f0fdf4',
                border: isUploading ? '1.5px solid #c7d2fe' : '1.5px solid #bbf7d0',
                display: 'flex',
                alignItems: 'baseline',
                gap: '2px',
                boxShadow: isUploading ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none'
              }}>
                <span style={{ fontSize: '2rem', fontWeight: '900', color: isUploading ? '#4f46e5' : '#059669', lineHeight: 1 }}>
                  {overallProgress}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: isUploading ? '#4f46e5' : '#059669' }}>%</span>
              </div>
            </div>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div>
            <div style={{
              position: 'relative',
              width: '100%',
              height: '14px',
              borderRadius: '9999px',
              background: '#e2e8f0',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div
                className={isUploading ? "shimmer-progress" : ""}
                style={{
                  width: `${overallProgress}%`,
                  height: '100%',
                  background: isUploading 
                    ? undefined 
                    : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  borderRadius: '9999px',
                  transition: 'width 0.3s ease-out'
                }}
              />
            </div>

            {/* Live Status Text Under Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              fontSize: '0.825rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '600' }}>
                {isUploading && (
                  <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%' }} />
                )}
                <span>{stageStatusText}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {Object.values(fileStatuses).filter(s => s === 'done').length} of {selectedFiles.length} files processed
              </div>
            </div>
          </div>

          {/* 5-Stage Stepper Visualization */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginTop: '4px'
          }}>
            {CLEANING_STAGES.map((st) => {
              const Icon = st.icon;
              const isDone = overallProgress === 100 || currentStageIndex > st.step;
              const isActive = isUploading && currentStageIndex === st.step;
              const isQueued = !isDone && !isActive;

              return (
                <div
                  key={st.step}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: isActive 
                      ? '2px solid #6366f1' 
                      : isDone 
                        ? '1px solid #86efac' 
                        : '1px solid #e2e8f0',
                    background: isActive 
                      ? '#eef2ff' 
                      : isDone 
                        ? '#f0fdf4' 
                        : '#f8fafc',
                    boxShadow: isActive ? '0 0 0 3px rgba(99, 102, 241, 0.18)' : 'none',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: isActive ? '#4f46e5' : isDone ? '#10b981' : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isQueued ? '#64748b' : '#ffffff'
                    }}>
                      <Icon size={15} />
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      background: isActive ? '#e0e7ff' : isDone ? '#dcfce7' : '#f1f5f9',
                      color: isActive ? '#4338ca' : isDone ? '#15803d' : '#94a3b8'
                    }}>
                      {isDone ? 'Completed' : isActive ? 'Active' : `Step ${st.step}`}
                    </span>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.8125rem',
                      fontWeight: '700',
                      color: isActive ? '#312e81' : isDone ? '#065f46' : '#64748b'
                    }}>
                      {st.title}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: isActive ? '#4338ca' : isDone ? '#047857' : 'var(--text-muted)',
                      lineHeight: 1.3,
                      marginTop: '2px'
                    }}>
                      {st.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Upload Dropzone & Staged Files */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '44px 24px',
              border: '2px dashed #a5b4fc',
              borderRadius: 'var(--radius-lg)',
              background: '#f8fafc',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4f46e5';
              e.currentTarget.style.background = '#eef2ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#a5b4fc';
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#4f46e5'
            }}>
              <UploadCloud size={28} />
            </div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', color: '#0f172a' }}>
              Drag & Drop your CSV files here
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Select single or multiple CSVs (e.g. food, menu, order_items, customers, etc.)
            </p>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '4px 12px',
              borderRadius: '9999px'
            }}>
              Dynamic Schema Generation • Auto-drops index columns
            </span>
          </div>

          {/* Staged Files List */}
          {selectedFiles.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', color: '#0f172a' }}>
                  Staged Files ({selectedFiles.length})
                </h4>
                {!isUploading && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setSelectedFiles([])}
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedFiles.map((file, idx) => {
                  const status = fileStatuses[file.name] || 'pending';
                  const pct = fileProgresses[file.name] || 0;
                  const stageText = fileStageTexts[file.name] || (status === 'done' ? 'Ingested' : 'Ready');

                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      background: '#ffffff',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={18} color="#4f46e5" />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>{file.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {(file.size / (1024 * 1024) > 1) 
                                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
                                : `${(file.size / 1024).toFixed(1)} KB`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {status === 'pending' && !isUploading && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready</span>
                          )}
                          {status === 'done' && (
                            <span style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
                              <CheckCircle2 size={15} color="#059669" />
                              Ingested (100%)
                            </span>
                          )}
                          {status === 'error' && (
                            <span style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: '700' }}>Failed</span>
                          )}
                          {isUploading && status !== 'done' && status !== 'error' && (
                            <span style={{
                              fontSize: '0.72rem',
                              color: '#4338ca',
                              background: '#e0e7ff',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span className="spinner" style={{ width: '10px', height: '10px', border: '1.5px solid #4338ca', borderTopColor: 'transparent', borderRadius: '50%' }} />
                              <span>{stageText}</span>
                              <span>({pct}%)</span>
                            </span>
                          )}

                          {!isUploading && (
                            <button
                              onClick={() => removeFile(idx)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mini progress bar per file when uploading or processing */}
                      {isUploading && (
                        <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
                            borderRadius: '9999px',
                            transition: 'width 0.25s ease'
                          }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cleaning Pipeline Configuration Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Sliders size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.15rem' }}>Automated Cleaning Rules</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Fresh Database On Re-upload (Drop Previous Tables) */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: 'pointer',
              padding: '10px 12px',
              background: clearExisting ? '#eef2ff' : 'transparent',
              border: `1px solid ${clearExisting ? '#c7d2fe' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              transition: 'all 0.2s ease'
            }}>
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                style={{ marginTop: '4px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: clearExisting ? '#4338ca' : 'var(--text-primary)' }}>
                  Fresh Database on Re-upload (Drop Previous Tables)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Automatically drops previous database tables so the warehouse contains strictly the newly uploaded CSV(s).
                </div>
              </div>
            </label>

            {/* Drop Duplicates */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dropDuplicates}
                onChange={(e) => setDropDuplicates(e.target.checked)}
                style={{ marginTop: '4px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Drop Duplicate Rows</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Purges redundant records before schema generation.
                </div>
              </div>
            </label>

            {/* Fill Null Values */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={fillNulls}
                onChange={(e) => setFillNulls(e.target.checked)}
                style={{ marginTop: '4px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Impute Missing Values</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Repairs null cells using statistical strategies.
                </div>
              </div>
            </label>

            {/* Imputation Strategy Dropdowns */}
            {fillNulls && (
              <div style={{
                padding: '14px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Numeric Columns Strategy</label>
                  <select
                    className="form-select"
                    value={numericStrategy}
                    onChange={(e) => setNumericStrategy(e.target.value)}
                  >
                    <option value="median">Median (Outlier-robust)</option>
                    <option value="mean">Mean (Average)</option>
                    <option value="zero">Fill with Zero (0)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Categorical Columns Strategy</label>
                  <select
                    className="form-select"
                    value={categoricalStrategy}
                    onChange={(e) => setCategoricalStrategy(e.target.value)}
                  >
                    <option value="mode">Most Frequent Value (Mode)</option>
                    <option value="unknown">Fill with 'Unknown' placeholder</option>
                  </select>
                </div>
              </div>
            )}

            {/* Column Standardization */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={standardizeColumns}
                onChange={(e) => setStandardizeColumns(e.target.checked)}
                style={{ marginTop: '4px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Standardize Column Headers</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Normalizes headers to snake_case and removes artifact index columns (`Unnamed: 0`).
                </div>
              </div>
            </label>

            {/* Date Standardization */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={standardizeDates}
                onChange={(e) => setStandardizeDates(e.target.checked)}
                style={{ marginTop: '4px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Standardize Dates (ISO-8601)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Parses varying date representations into clean `YYYY-MM-DD`.
                </div>
              </div>
            </label>

            {/* Process Action */}
            <div style={{ marginTop: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={handleProcessUpload}
                disabled={selectedFiles.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="spinner"></span>
                    <span>{overallProgress}% • {stageStatusText || `Processing ${selectedFiles.length} file(s)...`}</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    <span>Clean & Ingest in Parallel ({selectedFiles.length} files)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {uploadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: '#ffe4e6',
          border: '1px solid #fecdd3',
          borderRadius: 'var(--radius-md)',
          color: '#be123c'
        }}>
          <AlertCircle size={20} color="#e11d48" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Post-Upload Transformation Report */}
      {finalSummary && processedDatasets.length > 0 && (
        <div className="glass-panel" style={{ padding: '28px', border: '1px solid #a7f3d0', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: '#0f172a' }}>Dynamic Warehouse Schema Created</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {processedDatasets.length} table(s) cleaned and stored in local SQLite database
                </p>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setActiveTab('schema')}>
              <span>Explore Star Schema & Tables</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Overall Metrics Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '28px'
          }}>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Initial Rows</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                {finalSummary.total_initial_rows.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Clean Rows Stored</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#059669' }}>
                {finalSummary.total_final_rows.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Duplicates Purged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#e11d48' }}>
                -{finalSummary.total_duplicates_removed.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Null Cells Repaired</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                +{finalSummary.total_nulls_filled.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Per-Table Cards */}
          <h4 style={{ fontSize: '1.05rem', marginBottom: '16px', color: '#0f172a' }}>Dynamically Generated Table Schemas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {processedDatasets.map((dataset, idx) => (
              <div key={idx} style={{
                padding: '20px',
                background: '#ffffff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '1.1rem', color: '#4f46e5' }}>
                      {dataset.table_name}
                    </span>
                    <span className={`badge ${dataset.table_type === 'fact' ? 'badge-fact' : 'badge-dimension'}`}>
                      {dataset.table_type.toUpperCase()} TABLE
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      from {dataset.original_filename} ({dataset.row_count.toLocaleString()} rows, {dataset.column_count} columns)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cleaned in {dataset.cleaning_summary.processing_time_ms}ms
                  </span>
                </div>

                {/* Transformations Log */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {dataset.cleaning_summary.column_transformations.map((t, tIdx) => (
                    <span key={tIdx} style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      color: '#475569',
                      fontWeight: '500'
                    }}>
                      ✓ {t}
                    </span>
                  ))}
                </div>

                {/* Inferred Column Schema */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {dataset.schema_info.map((col, cIdx) => (
                    <span key={cIdx} style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '4px 10px',
                      background: col.is_unique ? '#dcfce7' : '#e0e7ff',
                      border: col.is_unique ? '1px solid #bbf7d0' : '1px solid #c7d2fe',
                      borderRadius: '4px',
                      color: col.is_unique ? '#15803d' : '#4338ca',
                      fontWeight: '500'
                    }}>
                      {col.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({col.data_type})</span>
                      {col.is_unique && <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: '#15803d', fontWeight: '700' }}>[PK]</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
