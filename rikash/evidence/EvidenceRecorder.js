/**
 * SheSafe — Evidence Audio Recording
 * Rikash's Domain: Silent ambient audio capture for evidence
 * 
 * Starts recording when risk score > 60
 * Stops and uploads to Firebase Storage when alert fires or "I'm Safe"
 */

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDING_STATE_KEY = 'shesafe_recording_state';

class EvidenceRecorder {
  constructor() {
    this.recording = null;
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordingUri = null;
    this.onRecordingStatusUpdate = null;
  }

  /**
   * Request audio permissions
   */
  async requestPermissions() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Microphone permission denied');
    }

    // Configure audio mode for background recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    console.log('[SheSafe Evidence] Audio permissions granted');
    return true;
  }

  /**
   * Start silent evidence recording
   * Called when risk score crosses 60
   */
  async startRecording() {
    if (this.isRecording) {
      console.log('[SheSafe Evidence] Already recording');
      return;
    }

    try {
      // Ensure permissions
      await this.requestPermissions();

      // Create and prepare recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await this.recording.startAsync();

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Save state
      await AsyncStorage.setItem(RECORDING_STATE_KEY, JSON.stringify({
        isRecording: true,
        startTime: this.recordingStartTime,
      }));

      console.log('[SheSafe Evidence] Recording started');

      // Monitor recording status
      this.recording.setOnRecordingStatusUpdate((status) => {
        if (this.onRecordingStatusUpdate) {
          this.onRecordingStatusUpdate({
            isRecording: status.isRecording,
            durationMs: status.durationMillis,
            metering: status.metering,
          });
        }
      });

      return true;
    } catch (e) {
      console.error('[SheSafe Evidence] Failed to start recording:', e.message);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop recording and return the file URI
   * Called when alert fires or "I'm Safe" pressed
   */
  async stopRecording() {
    if (!this.isRecording || !this.recording) {
      console.log('[SheSafe Evidence] Not recording');
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recordingUri = uri;
      this.isRecording = false;

      const duration = Date.now() - this.recordingStartTime;

      // Clear state
      await AsyncStorage.removeItem(RECORDING_STATE_KEY);

      console.log(`[SheSafe Evidence] Recording stopped — ${Math.round(duration / 1000)}s — ${uri}`);

      return {
        uri,
        durationMs: duration,
        startTime: this.recordingStartTime,
        endTime: Date.now(),
      };
    } catch (e) {
      console.error('[SheSafe Evidence] Failed to stop recording:', e.message);
      return null;
    } finally {
      this.recording = null;
      this.recordingStartTime = null;
    }
  }

  /**
   * Upload recording to Firebase Storage
   * @param {string} uri - Local file URI from stopRecording
   * @param {string} alertId - Alert ID for organizing files
   * @param {Object} firebaseStorage - Firebase Storage reference
   * @returns {string|null} Download URL or null on failure
   */
  async uploadToFirebase(uri, alertId, firebaseStorage) {
    if (!uri) {
      console.error('[SheSafe Evidence] No URI to upload');
      return null;
    }

    try {
      const filename = `evidence/${alertId}/audio_${Date.now()}.m4a`;
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      const storageRef = firebaseStorage.ref(filename);
      await storageRef.put(blob);

      // Get download URL
      const downloadUrl = await storageRef.getDownloadURL();
      console.log(`[SheSafe Evidence] Uploaded: ${downloadUrl}`);

      return downloadUrl;
    } catch (e) {
      console.error('[SheSafe Evidence] Upload failed:', e.message);
      return null;
    }
  }

  /**
   * Upload using fetch API (alternative without Firebase SDK)
   * Sends to Shakeeb's backend which handles Firebase upload
   */
  async uploadViaApi(uri, alertId, apiBaseUrl) {
    if (!uri) return null;

    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: `evidence_${alertId}_${Date.now()}.m4a`,
      });
      formData.append('alert_id', alertId);

      const response = await fetch(`${apiBaseUrl}/evidence/upload`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[SheSafe Evidence] Uploaded via API: ${data.url}`);
        return data.url;
      }
      return null;
    } catch (e) {
      console.error('[SheSafe Evidence] API upload failed:', e.message);
      return null;
    }
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      startTime: this.recordingStartTime,
      durationMs: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0,
      uri: this.recordingUri,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.isRecording) {
      await this.stopRecording();
    }
    this.recording = null;
    this.recordingUri = null;
  }
}

export const evidenceRecorder = new EvidenceRecorder();
export default EvidenceRecorder;
