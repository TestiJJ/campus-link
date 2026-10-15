import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const taskRegistryRef = useRef(new Map());

  // Dismiss a task manually
  const dismissTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    taskRegistryRef.current.delete(taskId);
  }, []);

  // Update a task's fields
  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...updates } : t)));
  }, []);

  // Run or re-run a background upload
  const executeUpload = useCallback(async (taskConfig) => {
    const { id, uploadFn, onSuccess, onError } = taskConfig;

    updateTask(id, {
      status: 'uploading',
      progress: 5,
      error: null
    });

    const onProgress = (percent) => {
      updateTask(id, {
        progress: Math.max(5, Math.min(99, percent)),
        status: percent >= 98 ? 'processing' : 'uploading'
      });
    };

    try {
      await uploadFn(onProgress);

      updateTask(id, {
        progress: 100,
        status: 'success'
      });

      if (typeof onSuccess === 'function') {
        try {
          onSuccess();
        } catch (callbackErr) {
          console.warn('[UploadContext] onSuccess callback error:', callbackErr);
        }
      }

      // Automatically remove successful task after 3.5 seconds
      setTimeout(() => {
        dismissTask(id);
      }, 3500);
    } catch (err) {
      console.error('[UploadContext] Background upload failed:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Upload failed. Please check your network.';
      updateTask(id, {
        status: 'error',
        error: errorMsg
      });

      if (typeof onError === 'function') {
        try {
          onError(err);
        } catch (callbackErr) {
          console.warn('[UploadContext] onError callback error:', callbackErr);
        }
      }
    }
  }, [dismissTask, updateTask]);

  // Start a new background upload
  const startUpload = useCallback(({
    id = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type = 'story',
    title = 'Uploading...',
    preview = null,
    uploadFn,
    onSuccess,
    onError
  }) => {
    const taskConfig = { id, type, title, preview, uploadFn, onSuccess, onError };
    taskRegistryRef.current.set(id, taskConfig);

    const initialTask = {
      id,
      type,
      title,
      preview,
      progress: 5,
      status: 'uploading',
      error: null,
      createdAt: Date.now()
    };

    // Prepend new task so latest is first
    setTasks(prev => [initialTask, ...prev.filter(t => t.id !== id)]);

    // Execute in background without blocking the UI
    setTimeout(() => {
      executeUpload(taskConfig);
    }, 50);

    return id;
  }, [executeUpload]);

  // Retry a failed upload
  const retryTask = useCallback((taskId) => {
    const taskConfig = taskRegistryRef.current.get(taskId);
    if (taskConfig) {
      executeUpload(taskConfig);
    }
  }, [executeUpload]);

  return (
    <UploadContext.Provider value={{ tasks, startUpload, retryTask, dismissTask }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      tasks: [],
      startUpload: async ({ uploadFn, onSuccess }) => {
        try {
          await uploadFn(() => {});
          if (onSuccess) onSuccess();
        } catch (e) {
          console.error(e);
        }
      },
      retryTask: () => {},
      dismissTask: () => {}
    };
  }
  return context;
}
