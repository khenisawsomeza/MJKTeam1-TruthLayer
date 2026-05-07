/**
 * TruthLayer - Background Service Worker
 * Handles communication between popup and backend API.
 */
importScripts(
    '../config.js',
    '../services/apiClient.js',
    './messageHandlers.js',
    './devReload.js'
);
