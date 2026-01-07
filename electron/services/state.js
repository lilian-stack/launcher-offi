/**
 * Gestion centralisée de l'état global de l'application
 * Évite de passer les variables globales partout
 */

import { BrowserWindow } from 'electron'

export const state = {
  mainWindow: null,
  hiddenWindow: null,
  activeDownload: null,
  downloadDestinationPath: null,
  childProcesses: new Set(),
  backendServerProcess: null,
  willDownloadListener: null
}

/**
 * Getters
 */
export function getMainWindow() {
  return state.mainWindow
}

export function getHiddenWindow() {
  return state.hiddenWindow
}

export function getChildProcesses() {
  return state.childProcesses
}

export function getBackendServerProcess() {
  return state.backendServerProcess
}

export function getWillDownloadListener() {
  return state.willDownloadListener
}

export function getActiveDownload() {
  return state.activeDownload
}

export function getDownloadDestinationPath() {
  return state.downloadDestinationPath
}

/**
 * Setters
 */
export function setMainWindow(window) {
  state.mainWindow = window
}

export function setHiddenWindow(window) {
  state.hiddenWindow = window
}

export function setActiveDownload(download) {
  state.activeDownload = download
}

export function setDownloadDestinationPath(path) {
  state.downloadDestinationPath = path
}

export function addChildProcess(process) {
  state.childProcesses.add(process)
}

export function removeChildProcess(process) {
  state.childProcesses.delete(process)
}

export function clearChildProcesses() {
  state.childProcesses.clear()
}

export function setBackendServerProcess(process) {
  state.backendServerProcess = process
}

export function setWillDownloadListener(listener) {
  state.willDownloadListener = listener
}
