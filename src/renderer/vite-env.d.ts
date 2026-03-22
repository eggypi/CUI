/// <reference types="vite/client" />

interface Window {
  electronAPI: import('../preload/preload').ElectronAPI
}
